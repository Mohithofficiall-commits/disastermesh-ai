import { db, generateId } from '@/db/database';
import type {
  SyncEvent,
  ProcessedEvent,
  ConflictRecord,
  EntityKind,
  EventKind,
  Incident,
  RescueTask,
  InventoryItem,
  SpatialUpdate,
  Peer,
} from '@/types';

// ===== Sync Engine =====
// Event-based synchronization with:
// - Persistent outbox (syncEvents table)
// - Store-and-forward queues
// - Acknowledgements
// - Bounded retries
// - Duplicate prevention (processedEvents table)
// - Conflict detection
// - Idempotent event processing

const MAX_RETRIES = 5;

export async function createEvent(
  sourcePeerId: string,
  targetPeerId: string,
  entityKind: EntityKind,
  entityId: string,
  eventKind: EventKind,
  payload: Record<string, unknown>,
  version: number = 1,
  isDemo: boolean = false,
): Promise<SyncEvent> {
  const event: SyncEvent = {
    id: generateId('evt'),
    sourcePeerId,
    targetPeerId,
    entityKind,
    entityId,
    eventKind,
    payload,
    version,
    timestamp: Date.now(),
    status: 'pending',
    retries: 0,
    maxRetries: MAX_RETRIES,
    ackId: null,
    deliveredAt: null,
    failedAt: null,
    errorMessage: null,
    isDemo,
  };
  await db.syncEvents.put(event);
  return event;
}

export async function broadcastEvent(
  sourcePeerId: string,
  entityKind: EntityKind,
  entityId: string,
  eventKind: EventKind,
  payload: Record<string, unknown>,
  version: number = 1,
  isDemo: boolean = false,
): Promise<SyncEvent[]> {
  const peers = await db.peers.toArray();
  const otherPeers = peers.filter((p) => p.id !== sourcePeerId);
  const events: SyncEvent[] = [];
  for (const peer of otherPeers) {
    const evt = await createEvent(
      sourcePeerId,
      peer.id,
      entityKind,
      entityId,
      eventKind,
      payload,
      version,
      isDemo,
    );
    events.push(evt);
  }
  return events;
}

export async function isEventProcessed(
  eventId: string,
  byPeerId: string,
): Promise<boolean> {
  const existing = await db.processedEvents
    .where({ eventId, processedByPeerId: byPeerId })
    .first();
  return !!existing;
}

export async function markEventProcessed(
  eventId: string,
  byPeerId: string,
  sourcePeerId: string,
): Promise<void> {
  const record: ProcessedEvent = {
    id: generateId('proc'),
    eventId,
    processedByPeerId: byPeerId,
    sourcePeerId,
    processedAt: Date.now(),
  };
  await db.processedEvents.put(record);
}

export async function deliverEvent(
  event: SyncEvent,
  targetPeer: Peer,
): Promise<{ success: boolean; error?: string }> {
  if (targetPeer.status !== 'online') {
    return { success: false, error: 'Target peer is offline' };
  }

  // Dedup check
  const alreadyProcessed = await isEventProcessed(event.id, targetPeer.id);
  if (alreadyProcessed) {
    return { success: true };
  }

  try {
    await applyEvent(event, targetPeer.id);
    await markEventProcessed(event.id, targetPeer.id, event.sourcePeerId);

    // Send ACK back
    await db.syncEvents.update(event.id, {
      status: 'acknowledged',
      ackId: generateId('ack'),
      deliveredAt: Date.now(),
    });
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

export async function isLinkConnected(peerAId: string, peerBId: string): Promise<boolean> {
  const linkId = [peerAId, peerBId].sort().join('__');
  const link = await db.peerLinks.get(linkId);
  if (!link) return true;
  return link.status === 'connected';
}

export async function togglePeerLink(peerAId: string, peerBId: string): Promise<'connected' | 'disconnected'> {
  const linkId = [peerAId, peerBId].sort().join('__');
  const link = await db.peerLinks.get(linkId);
  const nextStatus = link?.status === 'connected' ? 'disconnected' : 'connected';
  if (link) {
    await db.peerLinks.update(linkId, { status: nextStatus, lastChanged: Date.now() });
  } else {
    await db.peerLinks.put({ id: linkId, peerAId, peerBId, status: nextStatus, lastChanged: Date.now() });
  }
  return nextStatus;
}

export async function applyEvent(
  event: SyncEvent,
  localPeerId: string,
): Promise<void> {
  const { entityKind, eventKind, payload, entityId } = event;

  switch (entityKind) {
    case 'incident':
      await applyIncidentEvent(entityId, eventKind, payload, event.sourcePeerId, localPeerId, event.version, event.timestamp, event.isDemo);
      break;
    case 'task':
      await applyTaskEvent(entityId, eventKind, payload, event.sourcePeerId, localPeerId, event.version, event.timestamp, event.isDemo);
      break;
    case 'inventory':
      await applyInventoryEvent(entityId, eventKind, payload, event.sourcePeerId, localPeerId, event.version, event.timestamp, event.isDemo);
      break;
    case 'spatial':
      await applySpatialEvent(entityId, eventKind, payload, event.sourcePeerId, localPeerId, event.version, event.timestamp, event.isDemo);
      break;
    case 'peer':
      await applyPeerEvent(entityId, eventKind, payload);
      break;
  }
}

async function applyPeerEvent(
  entityId: string,
  eventKind: EventKind,
  payload: Record<string, unknown>,
): Promise<void> {
  if (eventKind === 'delete') {
    await db.peers.delete(entityId);
    // Remove links connected to this peer
    const links = await db.peerLinks.toArray();
    for (const l of links) {
      if (l.peerAId === entityId || l.peerBId === entityId) {
        await db.peerLinks.delete(l.id);
      }
    }
    return;
  }

  const peerData = payload as unknown as Peer;
  const existing = await db.peers.get(entityId);
  const peerRecord: Peer = {
    id: entityId,
    name: peerData.name || existing?.name || entityId,
    status: (peerData.status as Peer['status']) || existing?.status || 'online',
    createdAt: peerData.createdAt || existing?.createdAt || Date.now(),
    lastSeen: Date.now(),
    color: peerData.color || existing?.color || '#176B67',
    isLocal: existing?.isLocal ?? false,
    role: peerData.role || existing?.role || 'Field Response Team',
  };
  await db.peers.put(peerRecord);

  // Automatically wire peer links between all known peers and the new peer
  const allPeers = await db.peers.toArray();
  for (const other of allPeers) {
    if (other.id !== entityId) {
      const linkId = [entityId, other.id].sort().join('__');
      const existingLink = await db.peerLinks.get(linkId);
      if (!existingLink) {
        await db.peerLinks.put({
          id: linkId,
          peerAId: [entityId, other.id].sort()[0],
          peerBId: [entityId, other.id].sort()[1],
          status: 'connected',
          lastChanged: Date.now(),
        });
      }
    }
  }
}

async function applyIncidentEvent(
  entityId: string,
  eventKind: EventKind,
  payload: Record<string, unknown>,
  sourcePeerId: string,
  localPeerId: string,
  version: number,
  timestamp: number,
  isDemo: boolean,
): Promise<void> {
  const targetId = `${localPeerId}_${entityId}`;
  if (eventKind === 'delete') {
    await db.incidents.delete(targetId);
    await db.incidents.delete(entityId);
    return;
  }

  const existing = (await db.incidents.get(targetId)) || (await db.incidents.get(entityId));
  const incidentData = payload as unknown as Partial<Incident>;

  if (existing) {
    // Conflict detection: same version, different content
    if (existing.version === version && existing.updatedAt !== timestamp) {
      await detectConflict('incident', entityId, existing, payload, sourcePeerId);
      return;
    }
    if (existing.version > version) {
      // Stale event, ignore
      return;
    }
  }

  const incident: Incident = {
    id: targetId,
    peerId: localPeerId,
    sourcePeerId: sourcePeerId,
    type: (incidentData.type as Incident['type']) || 'other',
    title: incidentData.title || '',
    description: incidentData.description || '',
    severity: incidentData.severity || 'medium',
    status: incidentData.status || 'active',
    lat: incidentData.lat ?? 0,
    lng: incidentData.lng ?? 0,
    locationLabel: incidentData.locationLabel || '',
    peopleAffected: incidentData.peopleAffected ?? 0,
    verified: incidentData.verified ?? false,
    version,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    isDemo,
  };
  await db.incidents.put(incident);
}

async function applyTaskEvent(
  entityId: string,
  eventKind: EventKind,
  payload: Record<string, unknown>,
  sourcePeerId: string,
  localPeerId: string,
  version: number,
  timestamp: number,
  isDemo: boolean,
): Promise<void> {
  const targetId = `${localPeerId}_${entityId}`;
  if (eventKind === 'delete') {
    await db.tasks.delete(targetId);
    await db.tasks.delete(entityId);
    return;
  }

  const existing = (await db.tasks.get(targetId)) || (await db.tasks.get(entityId));
  const taskData = payload as unknown as Partial<RescueTask>;

  if (existing) {
    if (existing.version === version && existing.updatedAt !== timestamp) {
      await detectConflict('task', entityId, existing, payload, sourcePeerId);
      return;
    }
    if (existing.version > version) return;
  }

  const task: RescueTask = {
    id: targetId,
    peerId: localPeerId,
    sourcePeerId: sourcePeerId,
    incidentId: taskData.incidentId || '',
    type: (taskData.type as RescueTask['type']) || 'rescue',
    title: taskData.title || '',
    description: taskData.description || '',
    priority: taskData.priority || 'medium',
    status: taskData.status || 'pending',
    assignedTo: taskData.assignedTo ?? null,
    lat: taskData.lat ?? 0,
    lng: taskData.lng ?? 0,
    version,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    isDemo,
  };
  await db.tasks.put(task);
}

async function applyInventoryEvent(
  entityId: string,
  eventKind: EventKind,
  payload: Record<string, unknown>,
  sourcePeerId: string,
  localPeerId: string,
  version: number,
  timestamp: number,
  isDemo: boolean,
): Promise<void> {
  const targetId = `${localPeerId}_${entityId}`;
  const existing = (await db.inventory.get(targetId)) || (await db.inventory.get(entityId));
  const invData = payload as unknown as Partial<InventoryItem>;

  if (eventKind === 'delete') {
    await db.inventory.delete(targetId);
    await db.inventory.delete(entityId);
    return;
  }

  if (eventKind === 'reserve') {
    // Reservation conflict detection
    if (existing) {
      const reserveQty = (payload.quantity as number) || 0;
      const available = existing.quantity - existing.reserved;
      if (reserveQty > available) {
        await detectConflict('inventory', entityId, existing, payload, sourcePeerId);
        return;
      }
      const updated: InventoryItem = {
        ...existing,
        reserved: existing.reserved + reserveQty,
        version: Math.max(existing.version, version),
        updatedAt: timestamp,
      };
      await db.inventory.put(updated);
    }
    return;
  }

  if (existing) {
    if (existing.version === version && existing.updatedAt !== timestamp) {
      await detectConflict('inventory', entityId, existing, payload, sourcePeerId);
      return;
    }
    if (existing.version > version) return;
  }

  const item: InventoryItem = {
    id: targetId,
    peerId: localPeerId,
    sourcePeerId: sourcePeerId,
    name: invData.name || '',
    category: (invData.category as InventoryItem['category']) || 'tools',
    quantity: invData.quantity ?? 0,
    unit: invData.unit || 'units',
    lat: invData.lat ?? 0,
    lng: invData.lng ?? 0,
    locationLabel: invData.locationLabel || '',
    reserved: invData.reserved ?? existing?.reserved ?? 0,
    version,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    isDemo,
  };
  await db.inventory.put(item);
}

async function applySpatialEvent(
  entityId: string,
  eventKind: EventKind,
  payload: Record<string, unknown>,
  sourcePeerId: string,
  localPeerId: string,
  version: number,
  timestamp: number,
  isDemo: boolean,
): Promise<void> {
  const targetId = `${localPeerId}_${entityId}`;
  if (eventKind === 'delete') {
    await db.spatial.delete(targetId);
    await db.spatial.delete(entityId);
    return;
  }

  const existing = (await db.spatial.get(targetId)) || (await db.spatial.get(entityId));
  const spatialData = payload as unknown as Partial<SpatialUpdate>;

  if (existing) {
    if (existing.version === version && existing.updatedAt !== timestamp) {
      await detectConflict('spatial', entityId, existing, payload, sourcePeerId);
      return;
    }
    if (existing.version > version) return;
  }

  const spatial: SpatialUpdate = {
    id: targetId,
    peerId: localPeerId,
    sourcePeerId: sourcePeerId,
    kind: (spatialData.kind as SpatialUpdate['kind']) || 'hazard',
    label: spatialData.label || '',
    description: spatialData.description || '',
    lat: spatialData.lat ?? 0,
    lng: spatialData.lng ?? 0,
    radius: spatialData.radius ?? 100,
    version,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    isDemo,
  };
  await db.spatial.put(spatial);
}

async function detectConflict(
  entityKind: EntityKind,
  entityId: string,
  existing: object,
  incomingPayload: Record<string, unknown>,
  incomingPeerId: string,
): Promise<void> {
  const conflict: ConflictRecord = {
    id: generateId('conflict'),
    entityKind,
    entityId,
    eventAId: generateId('evta'),
    eventBId: generateId('evtb'),
    peerAId: ((existing as { sourcePeerId?: string; peerId?: string }).sourcePeerId || (existing as { peerId?: string }).peerId) || 'unknown',
    peerBId: incomingPeerId,
    payloadA: existing as Record<string, unknown>,
    payloadB: incomingPayload,
    description: `Concurrent ${entityKind} update from peer ${incomingPeerId} conflicts with existing version`,
    status: 'unresolved',
    resolvedBy: null,
    resolvedAt: null,
    resolutionNote: null,
    createdAt: Date.now(),
  };
  await db.conflicts.put(conflict);
}

// ===== Sync delivery attempt =====
export async function attemptDelivery(): Promise<{
  delivered: number;
  failed: number;
  retried: number;
}> {
  const pendingEvents = await db.syncEvents
    .where('status')
    .anyOf(['pending', 'failed'])
    .toArray();

  let delivered = 0;
  let failed = 0;
  let retried = 0;

  for (const event of pendingEvents) {
    const targetPeer = await db.peers.get(event.targetPeerId);
    if (!targetPeer) {
      await db.syncEvents.update(event.id, {
        status: 'failed',
        failedAt: Date.now(),
        errorMessage: 'Target peer not found',
      });
      failed++;
      continue;
    }

    // Check link connectivity
    const linkConnected = await isLinkConnected(event.sourcePeerId, event.targetPeerId);
    if (!linkConnected) {
      // Link is disconnected, can't deliver now
      continue;
    }

    const sourcePeer = await db.peers.get(event.sourcePeerId);
    if (sourcePeer && sourcePeer.status !== 'online') {
      // Source peer offline, can't transmit
      continue;
    }

    if (targetPeer.status !== 'online') {
      // Target peer offline, can't deliver now
      continue;
    }

    // Check retry limit
    if (event.retries >= event.maxRetries) {
      await db.syncEvents.update(event.id, {
        status: 'failed',
        failedAt: Date.now(),
        errorMessage: 'Max retries exceeded',
      });
      failed++;
      continue;
    }

    const result = await deliverEvent(event, targetPeer);
    if (result.success) {
      delivered++;
    } else {
      retried++;
      await db.syncEvents.update(event.id, {
        retries: event.retries + 1,
        errorMessage: result.error || 'Delivery failed',
      });
    }
  }

  return { delivered, failed, retried };
}

export async function replayEvent(eventId: string): Promise<{
  replayed: boolean;
  deduplicated: boolean;
}> {
  const event = await db.syncEvents.get(eventId);
  if (!event) return { replayed: false, deduplicated: false };

  const targetPeer = await db.peers.get(event.targetPeerId);
  if (!targetPeer) return { replayed: false, deduplicated: false };

  // Check if already processed
  const alreadyProcessed = await isEventProcessed(event.id, targetPeer.id);
  if (alreadyProcessed) {
    return { replayed: true, deduplicated: true };
  }

  await deliverEvent(event, targetPeer);
  return { replayed: true, deduplicated: false };
}

export async function resolveConflict(
  conflictId: string,
  resolution: 'resolved_accept_a' | 'resolved_accept_b' | 'resolved_merge',
  resolvedBy: string,
  note: string,
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId);
  if (!conflict) return;

  await db.conflicts.update(conflictId, {
    status: resolution,
    resolvedBy,
    resolvedAt: Date.now(),
    resolutionNote: note,
  });

  // Apply the winning payload
  const winningPayload =
    resolution === 'resolved_accept_a' ? conflict.payloadA : conflict.payloadB;

  if (resolution !== 'resolved_merge') {
    const entityTable = getEntityTable(conflict.entityKind);
    const existing = await entityTable.get(conflict.entityId);
    if (existing) {
      await entityTable.put({
        ...existing,
        ...winningPayload,
        updatedAt: Date.now(),
      } as never);
    }
  }
}

function getEntityTable(kind: EntityKind) {
  switch (kind) {
    case 'incident': return db.incidents;
    case 'task': return db.tasks;
    case 'inventory': return db.inventory;
    case 'spatial': return db.spatial;
    default: return db.incidents;
  }
}
