import { useEffect, useState, useRef, useCallback } from 'react';
import type * as Leaflet from 'leaflet';
import { db } from '@/db/database';
import { Card, PageHeader, Badge } from '@/components/ui';
import type { Incident, SpatialUpdate, InventoryItem, RescueTask } from '@/types';
import { CITIES, TACTICAL_LOCATIONS } from '@/lib/locations';
import { subscribeEventIngested } from '@/engine/relayClient';
import {
  Layers, AlertTriangle, Package, Ban, Shield, ClipboardList, MapPin, Navigation, Crosshair,
} from 'lucide-react';

const DEFAULT_CENTER: [number, number] = [34.0522, -118.2437];

function createIcon(L: typeof Leaflet, color: string, glyph: string, pulse: boolean = false): Leaflet.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;width:32px;height:32px;">
      ${pulse ? '<div class="pulse-ring" style="color:' + color + ';position:absolute;inset:0;"></div>' : ''}
      <div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:bold;">${glyph}</div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function MapView() {
  const mapRef = useRef<Leaflet.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tasks, setTasks] = useState<RescueTask[]>([]);
  const [spatial, setSpatial] = useState<SpatialUpdate[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('Central Metro');

  const [layers, setLayers] = useState({
    incidents: true,
    tasks: true,
    hazards: true,
    inventory: true,
    routes: true,
  });

  const [selectedItem, setSelectedItem] = useState<{
    type: 'incident' | 'task' | 'spatial' | 'inventory';
    data: Incident | RescueTask | SpatialUpdate | InventoryItem;
  } | null>(null);

  const [mapReady, setMapReady] = useState(0);

  const loadData = useCallback(async () => {
    setIncidents(await db.incidents.toArray());
    setTasks(await db.tasks.toArray());
    setSpatial(await db.spatial.toArray());
    setInventory(await db.inventory.toArray());
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeEventIngested(loadData);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 4000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadData]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 13,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady((n) => n + 1);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !layerRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const layer = layerRef.current;
    layer.clearLayers();

    // Incidents
    if (layers.incidents) {
      for (const inc of incidents) {
        const color = inc.severity === 'critical' ? '#D96552' : inc.severity === 'high' ? '#E7B85C' : '#176B67';
        const marker = L.marker([inc.lat, inc.lng], {
          icon: createIcon(L, color, '!', inc.status === 'active' && inc.severity === 'critical'),
        });
        marker.bindPopup(
          `<b>⚠️ ${inc.title}</b><br/>${inc.locationLabel || 'Incident Area'}<br/>Severity: <b>${inc.severity.toUpperCase()}</b> · Status: ${inc.status}<br/>Affected: ${inc.peopleAffected} civilians<br/><i>Peer: ${inc.sourcePeerId || inc.peerId}</i>`,
        );
        marker.on('click', () => setSelectedItem({ type: 'incident', data: inc }));
        marker.addTo(layer);
      }
    }

    // Rescue Tasks
    if (layers.tasks) {
      for (const tsk of tasks) {
        const color = tsk.priority === 'critical' ? '#D96552' : tsk.priority === 'high' ? '#E7B85C' : '#2563EB';
        const marker = L.marker([tsk.lat, tsk.lng], {
          icon: createIcon(L, color, 'T', tsk.status === 'in_progress'),
        });
        marker.bindPopup(
          `<b>📋 ${tsk.title}</b><br/>Type: ${tsk.type} · Priority: <b>${tsk.priority.toUpperCase()}</b><br/>Status: <b>${tsk.status.replace('_', ' ')}</b><br/>Assigned: ${tsk.assignedTo || 'Unassigned'}<br/><i>Peer: ${tsk.sourcePeerId || tsk.peerId}</i>`,
        );
        marker.on('click', () => setSelectedItem({ type: 'task', data: tsk }));
        marker.addTo(layer);

        // Highlight radius for rescue operations
        if (tsk.status !== 'completed') {
          L.circle([tsk.lat, tsk.lng], {
            radius: 200,
            color: color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: '3,3',
          }).addTo(layer);
        }
      }
    }

    // Hazards & Zones
    if (layers.hazards) {
      for (const s of spatial.filter((s) => s.kind === 'hazard' || s.kind === 'safe_zone' || s.kind === 'shelter')) {
        const color = s.kind === 'hazard' ? '#D96552' : s.kind === 'safe_zone' ? '#A9DCD0' : '#176B67';
        const glyph = s.kind === 'hazard' ? 'H' : s.kind === 'safe_zone' ? 'S' : 'R';
        const marker = L.marker([s.lat, s.lng], { icon: createIcon(L, color, glyph) });
        marker.bindPopup(`<b>${s.label}</b><br/>${s.description}${s.isDemo ? '<br/><i>DEMO DATA</i>' : ''}`);
        marker.on('click', () => setSelectedItem({ type: 'spatial', data: s }));
        marker.addTo(layer);
        if (s.radius > 0) {
          L.circle([s.lat, s.lng], {
            radius: s.radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 1.5,
          }).addTo(layer);
        }
      }
    }

    // Blocked routes
    if (layers.routes) {
      for (const s of spatial.filter((s) => s.kind === 'blocked_route')) {
        const marker = L.marker([s.lat, s.lng], { icon: createIcon(L, '#B84E3D', 'X') });
        marker.bindPopup(`<b>${s.label}</b><br/>${s.description}${s.isDemo ? '<br/><i>DEMO DATA</i>' : ''}`);
        marker.on('click', () => setSelectedItem({ type: 'spatial', data: s }));
        marker.addTo(layer);
        L.circle([s.lat, s.lng], {
          radius: s.radius || 150,
          color: '#B84E3D',
          fillColor: '#B84E3D',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5,5',
        }).addTo(layer);
      }
    }

    // Inventory depots
    if (layers.inventory) {
      for (const item of inventory) {
        const marker = L.marker([item.lat, item.lng], { icon: createIcon(L, '#059669', 'P') });
        marker.bindPopup(`<b>📦 ${item.name}</b><br/>${item.quantity} ${item.unit} available<br/>${item.locationLabel}${item.isDemo ? '<br/><i>DEMO DATA</i>' : ''}`);
        marker.on('click', () => setSelectedItem({ type: 'inventory', data: item }));
        marker.addTo(layer);
      }
    }
  }, [incidents, tasks, spatial, inventory, layers, mapReady]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const jumpToCity = (cityName: string) => {
    setSelectedCity(cityName);
    const loc = TACTICAL_LOCATIONS.find((l) => l.city === cityName);
    if (loc && mapRef.current) {
      mapRef.current.flyTo([loc.lat, loc.lng], 14, { duration: 1.2 });
    }
  };

  const focusItem = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 16, { duration: 1 });
    }
  };

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Tactical Operations Map"
        subtitle="Real-time multi-peer mapping of incidents, rescue operations, hazards, and relief depots"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-muted hidden sm:inline">Sector Jump:</span>
            <select
              value={selectedCity}
              onChange={(e) => jumpToCity(e.target.value)}
              className="text-xs rounded-lg border border-sand bg-white px-2.5 py-1.5 text-slate-forest font-medium shadow-xs"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-4 lg:col-span-1 order-2 lg:order-1 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-sand">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal" />
                <h3 className="font-semibold text-slate-forest text-sm">Tactical Layers</h3>
              </div>
              <span className="text-xs font-mono text-slate-muted">
                {incidents.length + tasks.length + inventory.length} markers
              </span>
            </div>

            <div className="space-y-2">
              <LayerToggle
                label="Incidents"
                count={incidents.length}
                icon={<AlertTriangle className="w-4 h-4 text-coral" />}
                active={layers.incidents}
                onClick={() => toggleLayer('incidents')}
              />
              <LayerToggle
                label="Rescue Tasks"
                count={tasks.length}
                icon={<ClipboardList className="w-4 h-4 text-blue-600" />}
                active={layers.tasks}
                onClick={() => toggleLayer('tasks')}
              />
              <LayerToggle
                label="Hazards & Zones"
                count={spatial.filter((s) => s.kind !== 'blocked_route').length}
                icon={<Shield className="w-4 h-4 text-teal" />}
                active={layers.hazards}
                onClick={() => toggleLayer('hazards')}
              />
              <LayerToggle
                label="Blocked Routes"
                count={spatial.filter((s) => s.kind === 'blocked_route').length}
                icon={<Ban className="w-4 h-4 text-coral-dark" />}
                active={layers.routes}
                onClick={() => toggleLayer('routes')}
              />
              <LayerToggle
                label="Supplies & Depots"
                count={inventory.length}
                icon={<Package className="w-4 h-4 text-emerald-600" />}
                active={layers.inventory}
                onClick={() => toggleLayer('inventory')}
              />
            </div>

            <div className="pt-3 border-t border-sand">
              <h4 className="text-xs font-semibold text-slate-muted mb-2">Tactical Legend</h4>
              <div className="space-y-1.5 text-xs">
                <LegendItem color="#D96552" label="Critical Incident / Danger" />
                <LegendItem color="#2563EB" label="Rescue Task Operation" />
                <LegendItem color="#E7B85C" label="High Priority / Warning" />
                <LegendItem color="#059669" label="Supply Depot Station" />
                <LegendItem color="#B84E3D" label="Blocked Route" dashed />
                <LegendItem color="#A9DCD0" label="Verified Safe Zone" />
              </div>
            </div>
          </div>

          {selectedItem && (
            <div className="mt-4 pt-3 border-t border-sand">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-semibold text-slate-forest uppercase tracking-wider">
                  Selected {selectedItem.type}
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    focusItem(
                      (selectedItem.data as { lat: number }).lat,
                      (selectedItem.data as { lng: number }).lng,
                    )
                  }
                  className="text-[11px] text-teal hover:underline flex items-center gap-1"
                >
                  <Crosshair className="w-3 h-3" /> Zoom
                </button>
              </div>

              <div className="bg-sand/30 rounded-lg p-3 text-xs space-y-1.5">
                <p className="font-semibold text-slate-forest text-sm">
                  {(selectedItem.data as { title?: string; label?: string; name?: string }).title ||
                    (selectedItem.data as { label?: string }).label ||
                    (selectedItem.data as { name?: string }).name}
                </p>

                <p className="text-slate-muted text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {(selectedItem.data as { locationLabel?: string }).locationLabel ||
                    `${(selectedItem.data as { lat: number }).lat.toFixed(4)}, ${(selectedItem.data as { lng: number }).lng.toFixed(4)}`}
                </p>

                {selectedItem.type === 'incident' && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    <Badge color="coral" size="sm">
                      {(selectedItem.data as Incident).severity.toUpperCase()}
                    </Badge>
                    <Badge color="amber" size="sm">
                      {(selectedItem.data as Incident).status}
                    </Badge>
                    <Badge color="slate" size="sm">
                      {(selectedItem.data as Incident).peopleAffected} People
                    </Badge>
                  </div>
                )}

                {selectedItem.type === 'task' && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    <Badge color="coral" size="sm">
                      {(selectedItem.data as RescueTask).priority.toUpperCase()}
                    </Badge>
                    <Badge color="mint" size="sm">
                      {(selectedItem.data as RescueTask).status.replace('_', ' ')}
                    </Badge>
                    {(selectedItem.data as RescueTask).assignedTo && (
                      <Badge color="slate" size="sm">
                        Assigned: {(selectedItem.data as RescueTask).assignedTo}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3 order-1 lg:order-2 overflow-hidden relative shadow-sm">
          <div ref={containerRef} style={{ height: '640px', width: '100%' }} />
          <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-sand shadow-xs text-xs text-slate-forest font-medium flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-forest" />
            <span>Active Sector: <b>{selectedCity}</b></span>
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-muted mt-3">
        Map tiles via OpenStreetMap. Pins reflect synchronized IndexedDB spatial records across all active peers.
      </p>
    </div>
  );
}

function LayerToggle({
  label,
  count,
  icon,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all border ${
        active
          ? 'bg-mint/20 border-mint/60 text-slate-forest font-medium'
          : 'bg-sand/20 border-transparent text-slate-muted hover:border-sand'
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {typeof count === 'number' && (
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white text-slate-forest border border-sand">
            {count}
          </span>
        )}
        <div
          className={`w-3.5 h-3.5 rounded-sm border transition-colors flex items-center justify-center ${
            active ? 'bg-forest border-forest text-white' : 'border-slate-muted'
          }`}
        >
          {active && <span className="text-[10px] leading-none">✓</span>}
        </div>
      </div>
    </button>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2.5 h-2.5 rounded-full ${dashed ? 'border-2' : ''}`}
        style={dashed ? { borderColor: color, borderStyle: 'dashed' } : { backgroundColor: color }}
      />
      <span className="text-slate-muted text-[11px]">{label}</span>
    </div>
  );
}
