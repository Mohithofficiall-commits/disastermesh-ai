import { useEffect, useState, useRef, useCallback } from 'react';
import type * as Leaflet from 'leaflet';
import { db } from '@/db/database';
import { Card, PageHeader, Badge } from '@/components/ui';
import type { Incident, SpatialUpdate, InventoryItem } from '@/types';
import { Layers, AlertTriangle, Package, Ban, Shield } from 'lucide-react';

const DEFAULT_CENTER: [number, number] = [34.0522, -118.2437];

function createIcon(L: typeof Leaflet, color: string, glyph: string, pulse: boolean = false): Leaflet.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;width:32px;height:32px;">
      ${pulse ? '<div class="pulse-ring" style="color:' + color + ';position:absolute;inset:0;"></div>' : ''}
      <div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">${glyph}</div>
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
  const [spatial, setSpatial] = useState<SpatialUpdate[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [layers, setLayers] = useState({ incidents: true, hazards: true, inventory: true, routes: true });
  const [selectedItem, setSelectedItem] = useState<{ type: string; data: Incident | SpatialUpdate | InventoryItem } | null>(null);
  const [mapReady, setMapReady] = useState(0);

  const loadData = useCallback(async () => {
    setIncidents(await db.incidents.toArray());
    setSpatial(await db.spatial.toArray());
    setInventory(await db.inventory.toArray());
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 8000);
    return () => clearInterval(interval);
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

    if (layers.incidents) {
      for (const inc of incidents) {
        const color = inc.severity === 'critical' ? '#D96552' : inc.severity === 'high' ? '#E7B85C' : '#176B67';
        const marker = L.marker([inc.lat, inc.lng], { icon: createIcon(L, color, '!', inc.status === 'active' && inc.severity === 'critical') });
        marker.bindPopup(`<b>${inc.title}</b><br/>${inc.locationLabel}<br/>Severity: ${inc.severity} · ${inc.peopleAffected} people${inc.isDemo ? '<br/><i>DEMO DATA</i>' : ''}`);
        marker.on('click', () => setSelectedItem({ type: 'incident', data: inc }));
        marker.addTo(layer);
      }
    }

    // Hazards
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
            fillOpacity: 0.1,
            weight: 1,
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
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '5,5',
        }).addTo(layer);
      }
    }

    // Inventory
    if (layers.inventory) {
      for (const item of inventory) {
        const marker = L.marker([item.lat, item.lng], { icon: createIcon(L, '#E7B85C', 'P') });
        marker.bindPopup(`<b>${item.name}</b><br/>${item.quantity} ${item.unit} available<br/>${item.locationLabel}${item.isDemo ? '<br/><i>DEMO DATA</i>' : ''}`);
        marker.on('click', () => setSelectedItem({ type: 'inventory', data: item }));
        marker.addTo(layer);
      }
    }
  }, [incidents, spatial, inventory, layers, mapReady]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Operations Map"
        subtitle="Incidents, hazards, blocked routes, and supply locations"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-4 lg:col-span-1 order-2 lg:order-1">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-teal" />
            <h3 className="font-semibold text-slate-forest text-sm">Map Layers</h3>
          </div>
          <div className="space-y-2">
            <LayerToggle label="Incidents" icon={<AlertTriangle className="w-4 h-4 text-coral" />} active={layers.incidents} onClick={() => toggleLayer('incidents')} />
            <LayerToggle label="Hazards & Zones" icon={<Shield className="w-4 h-4 text-teal" />} active={layers.hazards} onClick={() => toggleLayer('hazards')} />
            <LayerToggle label="Blocked Routes" icon={<Ban className="w-4 h-4 text-coral-dark" />} active={layers.routes} onClick={() => toggleLayer('routes')} />
            <LayerToggle label="Inventory" icon={<Package className="w-4 h-4 text-amber-dark" />} active={layers.inventory} onClick={() => toggleLayer('inventory')} />
          </div>

          <div className="mt-4 pt-4 border-t border-sand">
            <h4 className="text-xs font-semibold text-slate-muted mb-2">Legend</h4>
            <div className="space-y-1.5 text-xs">
              <LegendItem color="#D96552" label="Critical incident" />
              <LegendItem color="#E7B85C" label="High severity" />
              <LegendItem color="#176B67" label="Medium / supply" />
              <LegendItem color="#B84E3D" label="Blocked route" dashed />
              <LegendItem color="#A9DCD0" label="Safe zone" />
            </div>
          </div>

          {selectedItem && (
            <div className="mt-4 pt-4 border-t border-sand">
              <h4 className="text-xs font-semibold text-slate-muted mb-2">Selected</h4>
              <div className="bg-mint-pale/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-slate-forest">{(selectedItem.data as { title?: string; label?: string; name?: string }).title || (selectedItem.data as { label?: string }).label || (selectedItem.data as { name?: string }).name}</p>
                <p className="text-xs text-slate-muted mt-1">
                  Lat: {(selectedItem.data as { lat: number }).lat.toFixed(4)}, Lng: {(selectedItem.data as { lng: number }).lng.toFixed(4)}
                </p>
                {selectedItem.type === 'incident' && (
                  <div className="mt-2 flex gap-1">
                    <Badge color="coral" size="sm">{(selectedItem.data as Incident).severity}</Badge>
                    <Badge color="amber" size="sm">{(selectedItem.data as Incident).status}</Badge>
                  </div>
                )}
                {(selectedItem.data as { isDemo?: boolean }).isDemo && <Badge color="slate" size="sm">DEMO</Badge>}
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3 order-1 lg:order-2 overflow-hidden">
          <div ref={containerRef} style={{ height: '600px', width: '100%' }} />
        </Card>
      </div>

      <p className="text-xs text-slate-muted mt-4">
        Map tiles from OpenStreetMap. Markers represent locally stored incident, hazard, and inventory data. All DEMO data is synthetic.
      </p>
    </div>
  );
}

function LayerToggle({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
        active ? 'bg-teal/10 text-slate-forest' : 'bg-sand/30 text-slate-muted'
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <div className={`w-4 h-4 rounded border-2 ${active ? 'bg-teal border-teal' : 'border-slate-muted'}`} />
    </button>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full ${dashed ? 'border-2' : ''}`}
        style={dashed ? { borderColor: color, borderStyle: 'dashed' } : { backgroundColor: color }}
      />
      <span className="text-slate-muted">{label}</span>
    </div>
  );
}
