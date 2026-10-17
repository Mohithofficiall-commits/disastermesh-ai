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
import type { RescueTask, TaskType, TaskPriority, TaskStatus, Incident } from '@/types';
import {
  ClipboardList, Plus, MapPin, User, Clock, Trash2, CheckCircle2, AlertCircle,
} from 'lucide-react';

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'rescue', label: 'Rescue' },
  { value: 'medical', label: 'Medical' },
  { value: 'supply_delivery', label: 'Supply Delivery' },
  { value: 'evacuation', label: 'Evacuation' },
  { value: 'assessment', label: 'Assessment' },
];

const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

export function Tasks() {
  const { currentPeerId, peers, toast } = useApp();
  const [tasks, setTasks] = useState<RescueTask[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = useCallback(async () => {
    if (!currentPeerId) return;
    const tsk = await db.tasks.where('peerId').equals(currentPeerId).toArray();
    const incs = await db.incidents.where('peerId').equals(currentPeerId).toArray();
    tsk.sort((a, b) => b.updatedAt - a.updatedAt);
    setTasks(tsk);
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

  const filtered = filterStatus === 'all' ? tasks : tasks.filter((t) => t.status === filterStatus);

  const handleCreate = async (data: Partial<RescueTask>) => {
    if (!currentPeerId) return;
    const task: RescueTask = {
      id: generateId('task'),
      peerId: currentPeerId,
      sourcePeerId: currentPeerId,
      incidentId: data.incidentId || '',
      type: data.type || 'rescue',
      title: data.title || '',
      description: data.description || '',
      priority: data.priority || 'medium',
      status: 'pending',
      assignedTo: data.assignedTo ?? null,
      lat: data.lat ?? 34.0522,
      lng: data.lng ?? -118.2437,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDemo: false,
    };
    await db.tasks.put(task);
    await broadcastEvent(currentPeerId, 'task', task.id, 'create', task as unknown as Record<string, unknown>, 1, false);
    await loadData();
    setShowForm(false);
    toast('Rescue task created', 'success');
  };

  const handleStatusChange = async (task: RescueTask, status: TaskStatus) => {
    const updated = { ...task, status, version: task.version + 1, updatedAt: Date.now() };
    await db.tasks.put(updated);
    await broadcastEvent(task.peerId, 'task', task.id, 'update', updated as unknown as Record<string, unknown>, updated.version, task.isDemo);
    await loadData();
    toast(`Task status changed to ${status}`, 'success');
  };

  const handleAssign = async (task: RescueTask, assignee: string) => {
    const updated = { ...task, assignedTo: assignee || null, status: 'assigned' as TaskStatus, version: task.version + 1, updatedAt: Date.now() };
    await db.tasks.put(updated);
    await broadcastEvent(task.peerId, 'task', task.id, 'update', updated as unknown as Record<string, unknown>, updated.version, task.isDemo);
    await loadData();
    toast(`Task assigned to ${assignee}`, 'success');
  };

  const handleDelete = async (task: RescueTask) => {
    await db.tasks.delete(task.id);
    await broadcastEvent(task.peerId, 'task', task.id, 'delete', {}, task.version + 1, task.isDemo);
    await loadData();
    toast('Task deleted', 'info');
  };

  const incidentMap = new Map(incidents.map((i) => [i.id, i]));

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Rescue Tasks"
        subtitle="Create, prioritize, and assign rescue operations"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Create Task
          </Button>
        }
      />

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {['all', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filterStatus === s ? 'bg-teal text-white' : 'bg-white text-slate-muted border border-sand hover:bg-mint-pale/30'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((task) => {
          const inc = task.incidentId ? incidentMap.get(task.incidentId) : null;
          const assigneePeer = task.assignedTo ? peers.find((p) => p.id === task.assignedTo) : null;
          return (
            <Card key={task.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  task.priority === 'critical' ? 'bg-coral/15 text-coral-dark' :
                  task.priority === 'high' ? 'bg-amber/15 text-amber-dark' :
                  'bg-teal/10 text-teal'
                }`}>
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-slate-forest text-sm">{task.title}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge color={severityColor(task.priority)}>{task.priority}</Badge>
                      <Badge color={statusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-muted mb-2">{task.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-muted mb-2">
                    {inc && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {inc.title}</span>}
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {task.lat.toFixed(4)}, {task.lng.toFixed(4)}</span>
                    {assigneePeer && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {assigneePeer.name}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(task.createdAt)}</span>
                    {task.isDemo && <Badge color="slate">DEMO</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sand">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                      className="text-xs rounded-lg border border-sand bg-white px-2 py-1.5 text-slate-forest"
                    >
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                      value={task.assignedTo || ''}
                      onChange={(e) => handleAssign(task, e.target.value)}
                      className="text-xs rounded-lg border border-sand bg-white px-2 py-1.5 text-slate-forest"
                    >
                      <option value="">Unassigned</option>
                      {peers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-teal" />}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(task)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-6">
          <EmptyState message="No tasks created yet. Click 'Create Task' to assign a rescue operation." icon={<ClipboardList className="w-8 h-8" />} />
        </Card>
      )}

      <TaskFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreate={handleCreate}
        incidents={incidents}
        peers={peers}
      />
    </div>
  );
}

function TaskFormModal({
  open, onClose, onCreate, incidents, peers,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: Partial<RescueTask>) => void;
  incidents: Incident[];
  peers: { id: string; name: string }[];
}) {
  const [selectedCity, setSelectedCity] = useState<string>('Central Metro');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [form, setForm] = useState<Partial<RescueTask>>({
    type: 'rescue',
    priority: 'medium',
    title: '',
    description: '',
    incidentId: '',
    assignedTo: null,
    lat: 34.0522,
    lng: -118.2437,
  });

  const handleSelectPreset = (loc: TacticalLocation) => {
    setSelectedPresetId(loc.id);
    setSelectedCity(loc.city);
    setForm((prev) => ({
      ...prev,
      lat: loc.lat,
      lng: loc.lng,
      title: prev.title || `Rescue Operation at ${loc.label.split('&')[0]}`,
      description: prev.description || `Tactical mission dispatched to ${loc.label} (${loc.street}). ${loc.description}`,
    }));
  };

  const handleIncidentChange = (incId: string) => {
    const inc = incidents.find((i) => i.id === incId);
    if (inc) {
      setForm((prev) => ({
        ...prev,
        incidentId: incId,
        lat: inc.lat,
        lng: inc.lng,
        title: prev.title || `Respond to: ${inc.title}`,
        priority: inc.severity === 'critical' ? 'critical' : inc.severity === 'high' ? 'high' : 'medium',
      }));
    } else {
      setForm((prev) => ({ ...prev, incidentId: '' }));
    }
  };

  const handleSubmit = () => {
    if (!form.title?.trim()) return;
    onCreate(form);
    setForm({
      type: 'rescue',
      priority: 'medium',
      title: '',
      description: '',
      incidentId: '',
      assignedTo: null,
      lat: 34.0522,
      lng: -118.2437,
    });
    setSelectedPresetId('');
  };

  const cityLocations = TACTICAL_LOCATIONS.filter((l) => l.city === selectedCity);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Rescue Task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.title?.trim()}>Create Task</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Linked Incident Selector */}
        <FormField label="Linked Incident (Auto-Coordinates)">
          <select
            className={inputClass}
            value={form.incidentId || ''}
            onChange={(e) => handleIncidentChange(e.target.value)}
          >
            <option value="">None (Standalone Task / Custom Location)</option>
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title} — {i.locationLabel} [{i.severity.toUpperCase()}]
              </option>
            ))}
          </select>
        </FormField>

        {/* Location Presets Header (if not tied to an existing incident) */}
        {!form.incidentId && (
          <div className="bg-sand/30 p-3 rounded-xl border border-sand">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-forest flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-forest" /> Deployment Location (City & Street)
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
              <span>Target GPS: <b>{form.lat?.toFixed(4)}, {form.lng?.toFixed(4)}</b></span>
              <span>District: <b>{TACTICAL_LOCATIONS.find((l) => l.id === selectedPresetId)?.district || 'Custom'}</b></span>
            </div>
          </div>
        )}

        <FormField label="Task Title" required>
          <input className={inputClass} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Evacuate trapped civilians from river crossing" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type" required>
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}>
              {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Priority" required>
            <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Description & Action Orders">
          <textarea className={`${inputClass} min-h-[70px]`} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Task tactical orders, required equipment, hazards" />
        </FormField>
        <FormField label="Assign Unit">
          <select className={inputClass} value={form.assignedTo || ''} onChange={(e) => setForm({ ...form, assignedTo: e.target.value || null })}>
            <option value="">Unassigned (Open Dispatch)</option>
            {peers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude">
            <input type="number" step="0.0001" className={inputClass} value={form.lat || 0} onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Longitude">
            <input type="number" step="0.0001" className={inputClass} value={form.lng || 0} onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })} />
          </FormField>
        </div>
        <p className="text-xs text-slate-muted">Rescue tasks are broadcasted live across the tactical mesh.</p>
      </div>
    </Modal>
  );
}
