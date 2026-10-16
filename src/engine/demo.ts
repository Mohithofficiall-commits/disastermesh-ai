import { db, generateId } from '@/db/database';
import { broadcastEvent } from '@/engine/sync';
import type {
  Peer,
  Incident,
  SpatialUpdate,
  InventoryItem,
} from '@/types';

// ===== Demo Scenario Generator =====
// Creates a repeatable synthetic disaster scenario with labeled DEMO data.
// All data is clearly marked isDemo=true.

export async function createDemoPeers(): Promise<Peer[]> {
  const { ensureDbInitialized } = await import('@/db/database');
  await ensureDbInitialized();
  return db.peers.toArray();
}

// Demo coordinates — fictional Riverside City
const DEMO_COORDS = {
  floodCenter: { lat: 34.0522, lng: -118.2437 },
  bridge: { lat: 34.0489, lng: -118.2501 },
  supplyDepot: { lat: 34.0551, lng: -118.2389 },
};

export async function resetDemoData(): Promise<void> {
  await db.incidents.filter((i) => i.isDemo).delete();
  await db.inventory.filter((i) => i.isDemo).delete();
  await db.spatial.filter((s) => s.isDemo).delete();
  await db.tasks.filter((t) => t.isDemo).delete();
  await db.syncEvents.filter((e) => e.isDemo).delete();
  await db.conflicts.filter((c) => c.description.includes('[DEMO]')).delete();
  await db.agentRecommendations.clear();
}

export async function runDemoScenario(
  _activePeerId: string,
  onProgress?: (step: string) => void,
): Promise<void> {
  const peers = await createDemoPeers();
  const peerA = peers.find((p) => p.id === 'peer_a') || peers[0];
  const peerB = peers.find((p) => p.id === 'peer_b') || peers[1];
  const peerC = peers.find((p) => p.id === 'peer_c') || peers[2];

  // Step 1: Peer A reports a flood with 15 people needing rescue
  if (onProgress) onProgress('Step 1: Peer A reports flood with 15 people needing rescue...');
  const floodIncident: Incident = {
    id: generateId('inc_demo_flood'),
    peerId: peerA.id,
    type: 'flood',
    title: '[DEMO] Riverside Flood — 15 people trapped',
    description: 'DEMO DATA: Flash flood has trapped 15 people at the Riverside community center. Water level rising rapidly. Evacuation needed.',
    severity: 'critical',
    status: 'active',
    lat: DEMO_COORDS.floodCenter.lat,
    lng: DEMO_COORDS.floodCenter.lng,
    locationLabel: '[DEMO] Riverside Community Center',
    peopleAffected: 15,
    verified: false,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: true,
  };
  await db.incidents.put(floodIncident);
  await broadcastEvent(peerA.id, 'incident', floodIncident.id, 'create', floodIncident as unknown as Record<string, unknown>, 1, true);

  // Step 2: Peer B records a blocked bridge while disconnected
  if (onProgress) onProgress('Step 2: Peer B records blocked bridge (offline)...');
  const blockedBridge: SpatialUpdate = {
    id: generateId('spatial_demo_bridge'),
    peerId: peerB.id,
    kind: 'blocked_route',
    label: '[DEMO] Main Street Bridge — BLOCKED',
    description: 'DEMO DATA: Main Street bridge is structurally compromised due to flood water. No vehicle or foot crossing.',
    lat: DEMO_COORDS.bridge.lat,
    lng: DEMO_COORDS.bridge.lng,
    radius: 200,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: true,
  };
  await db.spatial.put(blockedBridge);
  await broadcastEvent(peerB.id, 'spatial', blockedBridge.id, 'create', blockedBridge as unknown as Record<string, unknown>, 1, true);

  // Step 3: Peer C records 100 water packs and 40 first-aid kits
  if (onProgress) onProgress('Step 3: Peer C records 100 water packs and 40 first-aid kits...');
  const waterPacks: InventoryItem = {
    id: generateId('inv_demo_water'),
    peerId: peerC.id,
    name: '[DEMO] Water Packs (1L)',
    category: 'water',
    quantity: 100,
    unit: 'packs',
    lat: DEMO_COORDS.supplyDepot.lat,
    lng: DEMO_COORDS.supplyDepot.lng,
    locationLabel: '[DEMO] Supply Depot North',
    reserved: 0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: true,
  };
  await db.inventory.put(waterPacks);
  await broadcastEvent(peerC.id, 'inventory', waterPacks.id, 'create', waterPacks as unknown as Record<string, unknown>, 1, true);

  const firstAidKits: InventoryItem = {
    id: generateId('inv_demo_medical'),
    peerId: peerC.id,
    name: '[DEMO] First-Aid Kits',
    category: 'medical',
    quantity: 40,
    unit: 'kits',
    lat: DEMO_COORDS.supplyDepot.lat,
    lng: DEMO_COORDS.supplyDepot.lng,
    locationLabel: '[DEMO] Supply Depot North',
    reserved: 0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: true,
  };
  await db.inventory.put(firstAidKits);
  await broadcastEvent(peerC.id, 'inventory', firstAidKits.id, 'create', firstAidKits as unknown as Record<string, unknown>, 1, true);

  if (onProgress) onProgress('Demo scenario created. Steps 5-8 (sync, replay, conflict) can be demonstrated from the System Test page.');
}

export async function createConflictingReservations(_activePeerId: string): Promise<void> {
  const waterItem = await db.inventory
    .where('category')
    .equals('water')
    .filter((i) => i.isDemo)
    .first();

  if (!waterItem) return;

  // Two different peers try to reserve most of the same stock
  const reserve1Payload = {
    quantity: 80,
    peerId: 'peer_a',
    note: '[DEMO] Peer A reserves 80 water packs for flood rescue',
  };
  const reserve2Payload = {
    quantity: 70,
    peerId: 'peer_c',
    note: '[DEMO] Peer C reserves 70 water packs for shelter',
  };

  // Create conflicting reservation events (80 + 70 > 100 available)
  await broadcastEvent('peer_a', 'inventory', waterItem.id, 'reserve', reserve1Payload, 2, true);
  await broadcastEvent('peer_c', 'inventory', waterItem.id, 'reserve', reserve2Payload, 2, true);

  // Also directly create a conflict record for demonstration
  const { detectConflictDirect } = await import('@/engine/syncHelpers');
  await detectConflictDirect(
    'inventory',
    waterItem.id,
    'peer_a',
    'peer_c',
    reserve1Payload,
    reserve2Payload,
    '[DEMO] Competing supply reservation: Peer A wants 80 water packs, Peer C wants 70. Only 100 available — 80+70 exceeds stock.',
  );
}
