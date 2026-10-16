import { useEffect, useState } from 'react';
import { db, generateId, PEER_COLORS } from '@/db/database';
import { useApp } from '@/store/AppStore';
import {
  Card, PageHeader, Button, Badge, Modal, FormField, inputClass,
  formatTime, EmptyState,
} from '@/components/ui';
import { attemptDelivery, broadcastEvent } from '@/engine/sync';
import type { Peer, PeerStatus } from '@/types';
import {
  Users, Plus, Wifi, WifiOff, Trash2, Radio, Clock, User, Check, Smartphone, Sparkles,
} from 'lucide-react';

const PRESET_ROLES = [
  'Field Response Team',
  'Medical Evac',
  'Search & Rescue',
  'Drone Recon',
  'Logistics & Supply',
  'Shelter Ops',
  'Command Post',
  'Hazard Assessment',
];

const EXTENDED_PALETTE = [
  '#176B67', // Deep Teal
  '#D96552', // Rescue Coral
  '#E7B85C', // Warning Amber
  '#059669', // Emerald
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#0891B2', // Cyan
  '#B84E3D', // Rust
];

export function Peers() {
  const {
    peers,
    refreshPeers,
    peerLinks,
    togglePeerLink,
    currentPeerId,
    setCurrentPeerId,
    triggerCloudSync,
    toast,
  } = useApp();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    refreshPeers();
    const interval = setInterval(refreshPeers, 3000);
    return () => clearInterval(interval);
  }, [refreshPeers]);

  const toggleStatus = async (peer: Peer) => {
    const newStatus: PeerStatus = peer.status === 'online' ? 'offline' : 'online';
    const updated: Peer = { ...peer, status: newStatus, lastSeen: Date.now() };
    await db.peers.put(updated);

    const sourcePeer = currentPeerId || peer.id;
    await broadcastEvent(sourcePeer, 'peer', peer.id, 'update', updated as unknown as Record<string, unknown>, 2, false);
    await triggerCloudSync();
    await refreshPeers();

    if (newStatus === 'online') {
      const result = await attemptDelivery();
      if (result.delivered > 0) {
        toast(`${peer.name} reconnected — ${result.delivered} events delivered`, 'success');
      } else {
        toast(`${peer.name} is now online`, 'success');
      }
    } else {
      toast(`${peer.name} disconnected — events will queue`, 'warning');
    }
  };

  const handleCreate = async (data: {
    name: string;
    role: string;
    color: string;
    status: PeerStatus;
    setActive: boolean;
  }) => {
    const peerId = generateId('peer');
    const peer: Peer = {
      id: peerId,
      name: data.name.trim(),
      status: data.status,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      color: data.color || PEER_COLORS[peers.length % PEER_COLORS.length],
      isLocal: data.setActive,
      role: data.role.trim() || 'Field Response Team',
    };

    if (data.setActive) {
      for (const p of peers) {
        if (p.isLocal) {
          await db.peers.update(p.id, { isLocal: false });
        }
      }
    }

    await db.peers.put(peer);

    // Wire peer links between all other existing peers and the new peer
    for (const other of peers) {
      if (other.id !== peer.id) {
        const linkId = [peer.id, other.id].sort().join('__');
        const existingLink = await db.peerLinks.get(linkId);
        if (!existingLink) {
          await db.peerLinks.put({
            id: linkId,
            peerAId: [peer.id, other.id].sort()[0],
            peerBId: [peer.id, other.id].sort()[1],
            status: 'connected',
            lastChanged: Date.now(),
          });
        }
      }
    }

    // Broadcast creation over mesh
    const sourcePeer = currentPeerId || peer.id;
    await broadcastEvent(sourcePeer, 'peer', peer.id, 'create', peer as unknown as Record<string, unknown>, 1, false);

    if (data.setActive) {
      setCurrentPeerId(peer.id);
    }

    await triggerCloudSync();
    await refreshPeers();
    setShowForm(false);
    toast(`Peer "${peer.name}" successfully added to mesh`, 'success');
  };

  const handleDelete = async (peer: Peer) => {
    if (peer.isLocal || peer.id === currentPeerId) {
      toast('Cannot delete the active local peer. Switch to another peer first.', 'error');
      return;
    }
    await db.peers.delete(peer.id);
    const links = await db.peerLinks.toArray();
    for (const l of links) {
      if (l.peerAId === peer.id || l.peerBId === peer.id) {
        await db.peerLinks.delete(l.id);
      }
    }

    const sourcePeer = currentPeerId || peer.id;
    await broadcastEvent(sourcePeer, 'peer', peer.id, 'delete', {}, 1, false);
    await triggerCloudSync();
    await refreshPeers();
    toast(`Peer "${peer.name}" removed from mesh`, 'info');
  };

  const handleSyncAll = async () => {
    await triggerCloudSync();
    const result = await attemptDelivery();
    await refreshPeers();
    if (result.delivered > 0) {
      toast(`Synced ${result.delivered} events across network`, 'success');
    } else {
      toast('Network synchronized', 'info');
    }
  };

  const onlineCount = peers.filter((p) => p.status === 'online').length;

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Peer Network & Mesh Connections"
        subtitle={`${onlineCount} of ${peers.length} peers online · Multi-device distributed mesh`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSyncAll}>
              <Radio className="w-4 h-4" />
              Sync All
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Add Peer
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {peers.map((peer) => {
          const isActive = peer.id === currentPeerId;
          return (
            <Card key={peer.id} className={`p-5 transition-all ${isActive ? 'ring-2 ring-forest shadow-md' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                    style={{ backgroundColor: peer.color }}
                  >
                    {peer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-forest text-sm flex items-center gap-2">
                      {peer.name}
                      {isActive && <Badge color="mint" size="sm">This Device</Badge>}
                    </h3>
                    <p className="text-xs text-slate-muted">{peer.role}</p>
                  </div>
                </div>
                <Badge color={peer.status === 'online' ? 'mint' : 'slate'}>
                  {peer.status === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {peer.status}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-slate-muted mb-3 bg-sand/30 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-muted" />
                  <span className="font-mono text-[11px] truncate">{peer.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-muted" />
                  <span>Last active: {formatTime(peer.lastSeen)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-slate-muted" />
                  <span>Created: {formatTime(peer.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-sand">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={peer.status === 'online' ? 'secondary' : 'primary'}
                    onClick={() => toggleStatus(peer)}
                  >
                    {peer.status === 'online' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                    {peer.status === 'online' ? 'Set Offline' : 'Set Online'}
                  </Button>
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCurrentPeerId(peer.id);
                        toast(`Active peer switched to ${peer.name}`, 'info');
                      }}
                      title="Operate as this peer on this device"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Switch
                    </Button>
                  )}
                </div>
                {!peer.isLocal && peer.id !== currentPeerId && (
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(peer)} title="Delete peer">
                    <Trash2 className="w-3.5 h-3.5 text-coral" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Switchable Peer Links Matrix */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-base font-semibold text-slate-forest">Simulated Peer Links</h3>
            <p className="text-xs text-slate-muted">
              Independently toggle links between peers. When disconnected, changes queue locally. Reconnecting allows queue delivery.
            </p>
          </div>
          <Badge color="mint" size="sm">
            {peerLinks.filter((l) => l.status === 'connected').length} Active Links
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {peerLinks.map((link) => {
            const pA = peers.find((p) => p.id === link.peerAId);
            const pB = peers.find((p) => p.id === link.peerBId);
            const isConnected = link.status === 'connected';
            return (
              <Card key={link.id} className="p-4 flex flex-col justify-between hover:border-mint/50 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-forest truncate max-w-[180px]">
                      {pA?.name.split('—')[0] || link.peerAId} ⟷ {pB?.name.split('—')[0] || link.peerBId}
                    </span>
                    <Badge color={isConnected ? 'mint' : 'coral'} size="sm">
                      {isConnected ? 'Connected' : 'Severed'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-muted mb-3">
                    {isConnected ? 'Link open; sync delivers live' : 'Link severed; sync queues locally'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isConnected ? 'secondary' : 'primary'}
                  onClick={() => togglePeerLink(link.id)}
                >
                  {isConnected ? 'Sever Link' : 'Connect Link'}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {peers.length === 0 && (
        <Card className="p-6">
          <EmptyState message="No peers in the network yet." icon={<Users className="w-8 h-8" />} />
        </Card>
      )}

      <PeerFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreate={handleCreate}
        peersCount={peers.length}
      />
    </div>
  );
}

function PeerFormModal({
  open,
  onClose,
  onCreate,
  peersCount,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    role: string;
    color: string;
    status: PeerStatus;
    setActive: boolean;
  }) => void;
  peersCount: number;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Field Response Team');
  const [color, setColor] = useState(EXTENDED_PALETTE[peersCount % EXTENDED_PALETTE.length] || '#176B67');
  const [status, setStatus] = useState<PeerStatus>('online');
  const [setActive, setSetActive] = useState(false);

  useEffect(() => {
    if (open) {
      setColor(EXTENDED_PALETTE[peersCount % EXTENDED_PALETTE.length] || '#176B67');
    }
  }, [open, peersCount]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate({
      name,
      role,
      color,
      status,
      setActive,
    });
    setName('');
    setRole('Field Response Team');
    setStatus('online');
    setSetActive(false);
  };

  const handleQuickName = (suggested: string, suggestedRole: string) => {
    setName(suggested);
    setRole(suggestedRole);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Peer to Mesh Network"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            Add Peer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Quick Suggestion Pills */}
        <div>
          <label className="text-xs font-medium text-slate-muted mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-forest" /> Quick Templates
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { n: 'Drone Recon Alpha', r: 'Drone Recon' },
              { n: 'SAR Unit Echo', r: 'Search & Rescue' },
              { n: 'MedEvac Mobile', r: 'Medical Evac' },
              { n: 'Supply Convoy 2', r: 'Logistics & Supply' },
              { n: 'Shelter Hub West', r: 'Shelter Ops' },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => handleQuickName(s.n, s.r)}
                className="text-xs px-2.5 py-1 rounded-full bg-sand/60 hover:bg-sand border border-sand hover:border-forest/30 text-slate-forest transition-colors"
              >
                + {s.n}
              </button>
            ))}
          </div>
        </div>

        <FormField label="Peer Name" required>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Drone Recon Unit 4"
          />
        </FormField>

        {/* Role Presets */}
        <div>
          <label className="text-xs font-medium text-slate-muted mb-1.5 block">Role Preset</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  role === r
                    ? 'bg-forest text-white border-forest shadow-xs'
                    : 'bg-panel border-sand text-slate-muted hover:border-forest/40'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Or type custom role..."
          />
        </div>

        {/* Color Palette Swatches */}
        <div>
          <label className="text-xs font-medium text-slate-muted mb-1.5 block">Badge Color</label>
          <div className="flex items-center gap-2">
            {EXTENDED_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                style={{ backgroundColor: c }}
                title={c}
              >
                {color === c && <Check className="w-4 h-4 text-white stroke-[3]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Initial Status */}
        <div>
          <label className="text-xs font-medium text-slate-muted mb-1.5 block">Initial Connection State</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus('online')}
              className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                status === 'online'
                  ? 'bg-mint/30 border-forest text-forest shadow-xs'
                  : 'bg-panel border-sand text-slate-muted'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Online (Sync Live)
            </button>
            <button
              type="button"
              onClick={() => setStatus('offline')}
              className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                status === 'offline'
                  ? 'bg-coral/20 border-coral text-coral shadow-xs'
                  : 'bg-panel border-sand text-slate-muted'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              Offline (Queued)
            </button>
          </div>
        </div>

        {/* Active Device Toggle */}
        <div className="pt-2 border-t border-sand">
          <label className="flex items-center gap-2 text-xs text-slate-forest cursor-pointer">
            <input
              type="checkbox"
              checked={setActive}
              onChange={(e) => setSetActive(e.target.checked)}
              className="rounded border-sand text-forest focus:ring-forest"
            />
            <span>Set as active operating peer for this device immediately</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
