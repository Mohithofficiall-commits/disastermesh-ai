import Dexie, { type Table } from 'dexie';
import type {
  Peer,
  PeerLink,
  Incident,
  RescueTask,
  InventoryItem,
  SpatialUpdate,
  SyncEvent,
  ProcessedEvent,
  ConflictRecord,
  AgentRecommendation,
} from '@/types';

export class DisasterMeshDB extends Dexie {
  peers!: Table<Peer, string>;
  peerLinks!: Table<PeerLink, string>;
  incidents!: Table<Incident, string>;
  tasks!: Table<RescueTask, string>;
  inventory!: Table<InventoryItem, string>;
  spatial!: Table<SpatialUpdate, string>;
  syncEvents!: Table<SyncEvent, string>;
  processedEvents!: Table<ProcessedEvent, string>;
  conflicts!: Table<ConflictRecord, string>;
  agentRecommendations!: Table<AgentRecommendation, string>;

  constructor() {
    super('disastermesh_ai');
    this.version(2).stores({
      peers: 'id, status, isLocal',
      peerLinks: 'id, peerAId, peerBId, status',
      incidents: 'id, peerId, status, severity, type, verified',
      tasks: 'id, peerId, incidentId, status, priority',
      inventory: 'id, peerId, category, name',
      spatial: 'id, peerId, kind',
      syncEvents: 'id, sourcePeerId, targetPeerId, status, entityKind, entityId',
      processedEvents: 'id, eventId, processedByPeerId, sourcePeerId',
      conflicts: 'id, entityKind, entityId, status',
      agentRecommendations: 'id, agentId, entityType, entityId',
    });
  }
}

export const db = new DisasterMeshDB();

export const DEFAULT_PEERS: Peer[] = [
  {
    id: 'peer_a',
    name: 'Peer A — Field Team',
    status: 'online',
    createdAt: 1729000000000,
    lastSeen: Date.now(),
    color: '#176B67',
    isLocal: true,
    role: 'Field Response Team',
  },
  {
    id: 'peer_b',
    name: 'Peer B — Relief Unit',
    status: 'online',
    createdAt: 1729000000000,
    lastSeen: Date.now(),
    color: '#D96552',
    isLocal: false,
    role: 'Relief Supply Unit',
  },
  {
    id: 'peer_c',
    name: 'Peer C — Regional Team',
    status: 'online',
    createdAt: 1729000000000,
    lastSeen: Date.now(),
    color: '#E7B85C',
    isLocal: false,
    role: 'Regional Coordination Unit',
  },
];

export const DEFAULT_LINKS: PeerLink[] = [
  { id: 'peer_a__peer_b', peerAId: 'peer_a', peerBId: 'peer_b', status: 'connected', lastChanged: Date.now() },
  { id: 'peer_b__peer_c', peerAId: 'peer_b', peerBId: 'peer_c', status: 'connected', lastChanged: Date.now() },
  { id: 'peer_a__peer_c', peerAId: 'peer_a', peerBId: 'peer_c', status: 'connected', lastChanged: Date.now() },
];

export async function ensureDbInitialized(): Promise<void> {
  const existingPeers = await db.peers.toArray();
  for (const peer of DEFAULT_PEERS) {
    if (!existingPeers.some((p) => p.id === peer.id)) {
      await db.peers.put(peer);
    }
  }
  const existingLinks = await db.peerLinks.toArray();
  for (const link of DEFAULT_LINKS) {
    if (!existingLinks.some((l) => l.id === link.id)) {
      await db.peerLinks.put(link);
    }
  }
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const PEER_COLORS = [
  '#176B67',
  '#D96552',
  '#E7B85C',
  '#1E8580',
  '#B84E3D',
  '#C99A40',
];
