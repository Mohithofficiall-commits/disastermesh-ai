import { db, generateId } from '@/db/database';
import type { EntityKind, ConflictRecord } from '@/types';

export async function detectConflictDirect(
  entityKind: EntityKind,
  entityId: string,
  peerAId: string,
  peerBId: string,
  payloadA: Record<string, unknown>,
  payloadB: Record<string, unknown>,
  description: string,
): Promise<ConflictRecord> {
  const conflict: ConflictRecord = {
    id: generateId('conflict'),
    entityKind,
    entityId,
    eventAId: generateId('evta'),
    eventBId: generateId('evtb'),
    peerAId,
    peerBId,
    payloadA,
    payloadB,
    description,
    status: 'unresolved',
    resolvedBy: null,
    resolvedAt: null,
    resolutionNote: null,
    createdAt: Date.now(),
  };
  await db.conflicts.put(conflict);
  return conflict;
}
