import { useEffect, useState, useCallback } from 'react';
import { db, generateId } from '@/db/database';
import { useApp } from '@/store/AppStore';
import {
  Card, PageHeader, Button, Badge, Modal, FormField, inputClass,
  severityColor, statusColor, formatTime, EmptyState,
} from '@/components/ui';
import { broadcastEvent } from '@/engine/sync';
import { subscribeEventIngested } from '@/engine/relayClient';
import { TACTICAL_LOCATIONS, CITIES, type TacticalLocation } from '@/lib/locations';
import type { Incident, IncidentType, IncidentSeverity, IncidentStatus } from '@/types';
import {
  AlertTriangle, Plus, MapPin, Users, CheckCircle2, Clock, Trash2,
} from 'lucide-react';

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'flood', label: 'Flood' },
  { value: 'fire', label: 'Fire' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'structural_collapse', label: 'Structural Collapse' },
  { value: 'medical', label: 'Medical Emergency' },
  { value: 'hazard', label: 'Hazard' },
  { value: 'blocked_route', label: 'Blocked Route' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES: IncidentSeverity[] = ['critical', 'high', 'medium', 'low'];

export function Incidents() {
  const { currentPeerId, peers, toast } = useApp();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadData = useCallback(async () => {
    if (!currentPeerId) return;
    const incs = await db.incidents.where('peerId').equals(currentPeerId).toArray();
    incs.sort((a, b) => b.updatedAt - a.updatedAt);
    setIncidents(incs);
  }, [currentPeerId]);

  useEffect(() => {
    loadData();
    const unsub = subscribeEventIngested(loadData);
    const interval = setInterval(loadData, 3000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadData]);

  const filtered = filterStatus === 'all'
    ? incidents
    : incidents.filter((i) => i.status === filterStatus);

  const handleCreate = async (data: Partial<Incident>) => {
    if (!currentPeerId) return;
    const inc: Incident = {
      id: generateId('inc'),
      peerId: currentPeerId,
      sourcePeerId: currentPeerId,
      type: data.type || 'other',
      title: data.title || '',
      description: data.description || '',
      severity: data.severity || 'medium',
      status: 'active',
      lat: data.lat ?? 34.0522,
      lng: data.lng ?? -118.2437,
      locationLabel: data.locationLabel || '',
      peopleAffected: data.peopleAffected ?? 0,
      verified: false,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDemo: false,
    };
    await db.incidents.put(inc);
    await broadcastEvent(currentPeerId, 'incident', inc.id, 'create', inc as unknown as Record<string, unknown>, 1, false);
    await loadData();
    setShowForm(false);
    toast('Incident reported successfully and queued to outbox', 'success');
  };

  const handleEdit = async (data: Partial<Incident>) => {
    if (!editingIncident) return;
    const updated: Incident = {
      ...editingIncident,
      ...data,
      version: editingIncident.version + 1,
      updatedAt: Date.now(),
    };
    await db.incidents.put(updated);
    await broadcastEvent(editingIncident.peerId, 'incident', editingIncident.id, 'update', updated as unknown as Record<string, unknown>, updated.version, editingIncident.isDemo);
    await loadData();
    setEditingIncident(null);
    toast('Incident updated and change queued to outbox', 'success');
  };

  const handleVerify = async (inc: Incident) => {
    const updated = { ...inc, verified: !inc.verified, version: inc.version + 1, updatedAt: Date.now() };
    await db.incidents.put(updated);
    await broadcastEvent(inc.peerId, 'incident', inc.id, 'update', updated as unknown as Record<string, unknown>, updated.version, inc.isDemo);
    await loadData();
    toast(`Incident ${updated.verified ? 'verified' : 'unverified'}`, 'success');
  };

  const handleStatusChange = async (inc: Incident, status: IncidentStatus) => {
    const updated = { ...inc, status, version: inc.version + 1, updatedAt: Date.now() };
    await db.incidents.put(updated);
    await broadcastEvent(inc.peerId, 'incident', inc.id, 'update', updated as unknown as Record<string, unknown>, updated.version, inc.isDemo);
    await loadData();
    toast(`Status changed to ${status}`, 'success');
  };

  const handleDelete = async (inc: Incident) => {
    await db.incidents.delete(inc.id);
    await broadcastEvent(inc.peerId, 'incident', inc.id, 'delete', {}, inc.version + 1, inc.isDemo);
    await loadData();
    toast('Incident deleted', 'info');
  };

  const peerMap = new Map(peers.map((p) => [p.id, p]));

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Incidents"
        subtitle={`Viewing incidents on ${peerMap.get(currentPeerId || '')?.name || 'current peer'} (${filtered.length} stored)`}
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Report Incident
          </Button>
        }
      />

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {['all', 'active', 'monitoring', 'resolved', 'false_alarm'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filterStatus === s
                ? 'bg-teal text-white'
                : 'bg-white text-slate-muted border border-sand hover:bg-mint-pale/30'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((inc) => {
          const sourcePeer = inc.sourcePeerId ? peerMap.get(inc.sourcePeerId) : null;
          const isRemoteProvenance = inc.sourcePeerId && inc.sourcePeerId !== currentPeerId;
          return (
            <Card key={inc.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    inc.severity === 'critical' ? 'bg-coral/15 text-coral-dark' :
                    inc.severity === 'high' ? 'bg-amber/15 text-amber-dark' :
                    inc.severity === 'medium' ? 'bg-teal/10 text-teal' :
                    'bg-mint/20 text-teal-deep'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-forest text-sm">{inc.title}</h3>
                    <p className="text-xs text-slate-muted">{INCIDENT_TYPES.find((t) => t.value === inc.type)?.label}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {isRemoteProvenance ? (
                    <Badge color="teal" size="sm">Source: {sourcePeer?.name || inc.sourcePeerId}</Badge>
                  ) : (
                    <Badge color="slate" size="sm">Local Record</Badge>
                  )}
                  <Badge color={severityColor(inc.severity)} size="sm">{inc.severity}</Badge>
                  <Badge color={statusColor(inc.status)} size="sm">{inc.status.replace('_', ' ')}</Badge>
                </div>
              </div>

              <p className="text-sm text-slate-forest mb-3 line-clamp-2">{inc.description}</p>

              <div className="flex flex-wrap gap-3 text-xs text-slate-muted mb-3">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {inc.locationLabel || `${inc.lat.toFixed(4)}, ${inc.lng.toFixed(4)}`}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {inc.peopleAffected} affected
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatTime(inc.createdAt)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-sand">
                <Button size="sm" variant={inc.verified ? 'secondary' : 'amber'} onClick={() => handleVerify(inc)}>
                  <CheckCircle2 className="w-3 h-3" />
                  {inc.verified ? 'Verified' : 'Verify'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingIncident(inc)}>
                  Edit
                </Button>
                <select
                  value={inc.status}
                  onChange={(e) => handleStatusChange(inc, e.target.value as IncidentStatus)}
                  className="text-xs rounded-lg border border-sand bg-white px-2 py-1.5 text-slate-forest"
                >
                  <option value="active">Active</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved</option>
                  <option value="false_alarm">False Alarm</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(inc)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                {inc.isDemo && <Badge color="slate">DEMO</Badge>}
                {!inc.verified && <Badge color="amber">Unverified</Badge>}
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-6">
          <EmptyState message="No incidents reported yet. Click 'Report Incident' to create one." icon={<AlertTriangle className="w-8 h-8" />} />
        </Card>
      )}

      <IncidentFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        title="Report New Incident"
      />

      <IncidentFormModal
        open={!!editingIncident}
        onClose={() => setEditingIncident(null)}
        onSubmit={handleEdit}
        title="Edit Incident"
        initialData={editingIncident}
      />
    </div>
  );
}

function IncidentFormModal({
  open,
  onClose,
  onSubmit,
  title = "Report New Incident",
  initialData = null,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Incident>) => void;
  title?: string;
  initialData?: Partial<Incident> | null;
}) {
  const [selectedCity, setSelectedCity] = useState<string>('Central Metro');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [form, setForm] = useState<Partial<Incident>>({
    type: 'flood',
    severity: 'medium',
    title: '',
    description: '',
    locationLabel: '',
    peopleAffected: 0,
    lat: 34.0522,
    lng: -118.2437,
  });

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
      setSelectedPresetId('');
    } else {
      const defaultLoc = TACTICAL_LOCATIONS[0];
      setForm({
        type: 'flood',
        severity: 'medium',
        title: '',
        description: '',
        locationLabel: `${defaultLoc.label} (${defaultLoc.street}, ${defaultLoc.city})`,
        peopleAffected: 0,
        lat: defaultLoc.lat,
        lng: defaultLoc.lng,
      });
      setSelectedCity(defaultLoc.city);
      setSelectedPresetId(defaultLoc.id);
    }
  }, [initialData, open]);

  const handleSelectPreset = (loc: TacticalLocation) => {
    setSelectedPresetId(loc.id);
    setSelectedCity(loc.city);
    setForm((prev) => ({
      ...prev,
      locationLabel: `${loc.label} (${loc.street}, ${loc.city})`,
      lat: loc.lat,
      lng: loc.lng,
      title: prev.title || `${loc.label} Incident`,
      description: prev.description || loc.description,
    }));
  };

  const handleSubmit = () => {
    if (!form.title || !form.title.trim()) return;
    onSubmit(form);
  };

  const cityLocations = TACTICAL_LOCATIONS.filter((l) => l.city === selectedCity);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.title?.trim()}>Save Incident</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Location Presets Header */}
        <div className="bg-sand/30 p-3 rounded-xl border border-sand">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-forest flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-forest" /> Location Preset (City & Street)
            </label>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                const first = TACTICAL_LOCATIONS.find((l) => l.city === e.target.value);
                if (first) handleSelectPreset(first);
              }}
              className="text-xs rounded-lg border border-sand bg-white px-2 py-1 text-slate-forest font-medium"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {cityLocations.map((loc) => {
              const active = selectedPresetId === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSelectPreset(loc)}
                  className={`text-xs px-2.5 py-1 rounded-lg border text-left transition-all ${
                    active
                      ? 'bg-forest text-white border-forest shadow-xs'
                      : 'bg-white border-sand text-slate-forest hover:border-forest/40'
                  }`}
                >
                  <span className="font-semibold">{loc.label.split('&')[0]}</span>
                  <span className={`block text-[10px] ${active ? 'text-white/80' : 'text-slate-muted'}`}>
                    {loc.street}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-muted flex items-center justify-between pt-1 border-t border-sand/50">
            <span>GPS Pin: <b>{form.lat?.toFixed(4)}, {form.lng?.toFixed(4)}</b></span>
            <span>District: <b>{TACTICAL_LOCATIONS.find((l) => l.id === selectedPresetId)?.district || 'Custom'}</b></span>
          </div>
        </div>

        <FormField label="Incident Title" required>
          <input className={inputClass} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Flash Flood at River Crossing" />
        </FormField>
        <FormField label="Type" required>
          <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IncidentType })}>
            {INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormField>
        <FormField label="Description">
          <textarea className={`${inputClass} min-h-[70px]`} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed tactical situation assessment" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Severity" required>
            <select className={inputClass} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as IncidentSeverity })}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="People Affected">
            <input type="number" min={0} className={inputClass} value={form.peopleAffected || 0} onChange={(e) => setForm({ ...form, peopleAffected: parseInt(e.target.value) || 0 })} />
          </FormField>
        </div>
        <FormField label="Street & Location Label">
          <input className={inputClass} value={form.locationLabel || ''} onChange={(e) => setForm({ ...form, locationLabel: e.target.value })} placeholder="e.g., Riverside Community Center" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude">
            <input type="number" step="0.0001" className={inputClass} value={form.lat || 0} onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Longitude">
            <input type="number" step="0.0001" className={inputClass} value={form.lng || 0} onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })} />
          </FormField>
        </div>
        <p className="text-xs text-slate-muted">Reports are created as unverified. Verify after field confirmation.</p>
      </div>
    </Modal>
  );
}
