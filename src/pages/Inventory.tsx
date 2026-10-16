import { useEffect, useState, useCallback } from 'react';
import { db, generateId } from '@/db/database';
import { useApp } from '@/store/AppStore';
import {
  Card, PageHeader, Button, Badge, Modal, FormField, inputClass,
  formatTime, EmptyState,
} from '@/components/ui';
import { broadcastEvent } from '@/engine/sync';
import type { InventoryItem, InventoryCategory } from '@/types';
import {
  Package, Plus, MapPin, Clock, Trash2, Boxes, TrendingDown,
} from 'lucide-react';

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'water', label: 'Water' },
  { value: 'food', label: 'Food' },
  { value: 'medical', label: 'Medical' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'tools', label: 'Tools' },
  { value: 'communication', label: 'Communication' },
  { value: 'fuel', label: 'Fuel' },
];

const CATEGORY_COLORS: Record<InventoryCategory, 'teal' | 'coral' | 'amber' | 'mint' | 'slate'> = {
  water: 'teal',
  food: 'amber',
  medical: 'coral',
  shelter: 'mint',
  tools: 'slate',
  communication: 'teal',
  fuel: 'amber',
};

export function Inventory() {
  const { currentPeerId, peers, toast } = useApp();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('all');

  const loadData = useCallback(async () => {
    if (!currentPeerId) return;
    const inv = await db.inventory.where('peerId').equals(currentPeerId).toArray();
    inv.sort((a, b) => b.updatedAt - a.updatedAt);
    setItems(inv);
  }, [currentPeerId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filtered = filterCat === 'all' ? items : items.filter((i) => i.category === filterCat);

  const handleCreate = async (data: Partial<InventoryItem>) => {
    if (!currentPeerId) return;
    const item: InventoryItem = {
      id: generateId('inv'),
      peerId: currentPeerId,
      sourcePeerId: currentPeerId,
      name: data.name || '',
      category: data.category || 'tools',
      quantity: data.quantity ?? 0,
      unit: data.unit || 'units',
      lat: data.lat ?? 34.0522,
      lng: data.lng ?? -118.2437,
      locationLabel: data.locationLabel || '',
      reserved: 0,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDemo: false,
    };
    await db.inventory.put(item);
    await broadcastEvent(currentPeerId, 'inventory', item.id, 'create', item as unknown as Record<string, unknown>, 1, false);
    await loadData();
    setShowForm(false);
    toast('Inventory item added', 'success');
  };

  const handleUpdateQty = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    const updated = { ...item, quantity: newQty, version: item.version + 1, updatedAt: Date.now() };
    await db.inventory.put(updated);
    await broadcastEvent(item.peerId, 'inventory', item.id, 'update', updated as unknown as Record<string, unknown>, updated.version, item.isDemo);
    await loadData();
  };

  const handleDelete = async (item: InventoryItem) => {
    await db.inventory.delete(item.id);
    await broadcastEvent(item.peerId, 'inventory', item.id, 'delete', {}, item.version + 1, item.isDemo);
    await loadData();
    toast('Item deleted', 'info');
  };

  const peerMap = new Map(peers.map((p) => [p.id, p] as const));
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalReserved = items.reduce((s, i) => s + i.reserved, 0);

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Relief Inventory"
        subtitle="Track supplies, quantities, and locations"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-teal" />
            <div>
              <p className="text-xs text-slate-muted">Total Items</p>
              <p className="text-xl font-bold text-slate-forest">{items.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-teal" />
            <div>
              <p className="text-xs text-slate-muted">Total Units</p>
              <p className="text-xl font-bold text-slate-forest">{totalQty}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-dark" />
            <div>
              <p className="text-xs text-slate-muted">Reserved</p>
              <p className="text-xl font-bold text-slate-forest">{totalReserved}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-mint" />
            <div>
              <p className="text-xs text-slate-muted">Available</p>
              <p className="text-xl font-bold text-slate-forest">{totalQty - totalReserved}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            filterCat === 'all' ? 'bg-teal text-white' : 'bg-white text-slate-muted border border-sand hover:bg-mint-pale/30'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilterCat(c.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filterCat === c.value ? 'bg-teal text-white' : 'bg-white text-slate-muted border border-sand hover:bg-mint-pale/30'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const available = item.quantity - item.reserved;
          const peer = peerMap.get(item.peerId);
          return (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-teal/10 flex items-center justify-center text-teal">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-forest text-sm">{item.name}</h3>
                    <Badge color={CATEGORY_COLORS[item.category]} size="sm">{item.category}</Badge>
                  </div>
                </div>
                {item.isDemo && <Badge color="slate" size="sm">DEMO</Badge>}
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-slate-forest">{item.quantity}</span>
                <span className="text-sm text-slate-muted">{item.unit}</span>
                {item.reserved > 0 && (
                  <span className="text-xs text-amber-dark ml-auto">{item.reserved} reserved</span>
                )}
              </div>

              <div className="w-full h-2 rounded-full bg-sand overflow-hidden mb-3">
                <div className="h-full bg-teal rounded-full" style={{ width: `${item.quantity > 0 ? (available / item.quantity) * 100 : 0}%` }} />
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-muted mb-3">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.locationLabel || `${item.lat.toFixed(3)}, ${item.lng.toFixed(3)}`}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(item.createdAt)}</span>
              </div>
              {peer && <p className="text-xs text-slate-muted mb-2">Source: {peer.name}</p>}

              <div className="flex items-center gap-2 pt-2 border-t border-sand">
                <Button size="sm" variant="secondary" onClick={() => handleUpdateQty(item, -1)}>-1</Button>
                <Button size="sm" variant="secondary" onClick={() => handleUpdateQty(item, 1)}>+1</Button>
                <Button size="sm" variant="secondary" onClick={() => handleUpdateQty(item, 10)}>+10</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(item)} className="ml-auto">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-6">
          <EmptyState message="No inventory items yet. Click 'Add Item' to record supplies." icon={<Package className="w-8 h-8" />} />
        </Card>
      )}

      <InventoryFormModal open={showForm} onClose={() => setShowForm(false)} onCreate={handleCreate} />
    </div>
  );
}

function InventoryFormModal({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: Partial<InventoryItem>) => void;
}) {
  const [form, setForm] = useState<Partial<InventoryItem>>({
    name: '',
    category: 'water',
    quantity: 0,
    unit: 'units',
    locationLabel: '',
    lat: 34.0522,
    lng: -118.2437,
  });

  const handleSubmit = () => {
    if (!form.name?.trim()) return;
    onCreate(form);
    setForm({ name: '', category: 'water', quantity: 0, unit: 'units', locationLabel: '', lat: 34.0522, lng: -118.2437 });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Inventory Item"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.name?.trim()}>Add Item</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Item Name" required>
          <input className={inputClass} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Water Packs 1L" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category" required>
            <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Unit">
            <input className={inputClass} value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g., packs, kits" />
          </FormField>
        </div>
        <FormField label="Quantity" required>
          <input type="number" min={0} className={inputClass} value={form.quantity || 0} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Location Label">
          <input className={inputClass} value={form.locationLabel || ''} onChange={(e) => setForm({ ...form, locationLabel: e.target.value })} placeholder="e.g., Supply Depot North" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude">
            <input type="number" step="0.0001" className={inputClass} value={form.lat || 0} onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Longitude">
            <input type="number" step="0.0001" className={inputClass} value={form.lng || 0} onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
