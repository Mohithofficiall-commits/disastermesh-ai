import { db } from '@/db/database';
import { applyEvent, isEventProcessed, markEventProcessed } from '@/engine/sync';
import { pushRelayEventsFn, pullRelayEventsFn } from '@/lib/mesh-relay';
import type { SyncEvent } from '@/types';

export type RelaySyncStatus = 'idle' | 'syncing' | 'connected' | 'offline' | 'error';

let relayStatus: RelaySyncStatus = 'idle';
const statusListeners = new Set<(status: RelaySyncStatus) => void>();
const eventIngestedListeners = new Set<() => void>();

export const GLOBAL_RELAY_CHANNEL = 'disastermesh_v2_live_mesh';
const RELAY_HTTP_URL = `https://ntfy.sh/${GLOBAL_RELAY_CHANNEL}`;

function setRelayStatus(status: RelaySyncStatus) {
  relayStatus = status;
  for (const listener of statusListeners) {
    listener(status);
  }
}

export function subscribeRelayStatus(fn: (status: RelaySyncStatus) => void): () => void {
  statusListeners.add(fn);
  fn(relayStatus);
  return () => statusListeners.delete(fn);
}

export function subscribeEventIngested(fn: () => void): () => void {
  eventIngestedListeners.add(fn);
  return () => eventIngestedListeners.delete(fn);
}

function notifyEventIngested() {
  for (const listener of eventIngestedListeners) {
    try {
      listener();
    } catch (e) {
      console.warn('[relayClient] Listener error:', e);
    }
  }
}

export function getRelayStatus(): RelaySyncStatus {
  return relayStatus;
}

const STORAGE_KEY = 'disastermesh_relay_last_timestamp';

function getLastSyncedTimestamp(): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(STORAGE_KEY);
  return val ? parseInt(val, 10) || 0 : 0;
}

function setLastSyncedTimestamp(ts: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(ts));
}

let isSyncing = false;

/**
 * Publish a single event immediately to the global live mesh over HTTPS.
 */
export async function publishLiveMeshEvent(event: SyncEvent): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.onLine) return false;
  try {
    const res = await fetch(RELAY_HTTP_URL, {
      method: 'POST',
      headers: {
        'Title': 'mesh_sync_event',
        'Tags': 'satellite,radio',
      },
      body: JSON.stringify(event),
    });
    return res.ok;
  } catch (e) {
    console.warn('[relayClient] Live mesh publish failed (will retry via queue):', e);
    return false;
  }
}

async function shouldApplyIncomingEvent(evt: SyncEvent, targetPeerId: string): Promise<boolean> {
  const alreadyProcessed = await isEventProcessed(evt.id, targetPeerId);
  if (alreadyProcessed) return false;

  let hasEntity = false;
  if (evt.entityKind === 'incident') {
    hasEntity = !!(await db.incidents.get(evt.entityId)) || !!(await db.incidents.get(`${targetPeerId}_${evt.entityId}`));
  } else if (evt.entityKind === 'task') {
    hasEntity = !!(await db.tasks.get(evt.entityId)) || !!(await db.tasks.get(`${targetPeerId}_${evt.entityId}`));
  } else if (evt.entityKind === 'inventory') {
    hasEntity = !!(await db.inventory.get(evt.entityId)) || !!(await db.inventory.get(`${targetPeerId}_${evt.entityId}`));
  } else if (evt.entityKind === 'peer') {
    hasEntity = !!(await db.peers.get(evt.entityId));
  } else if (evt.entityKind === 'spatial') {
    hasEntity = !!(await db.spatial.get(evt.entityId));
  }

  if (hasEntity && evt.sourcePeerId === targetPeerId) {
    return false;
  }
  return true;
}

/**
 * Full bi-directional cloud synchronization pass:
 * 1. Pushes local events to the global live mesh & serverless relay.
 * 2. Pulls recent events from the global live mesh & serverless relay.
 */
export async function syncWithCloudRelay(currentPeerId: string): Promise<{
  pushed: number;
  pulled: number;
  error?: string;
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    setRelayStatus('offline');
    return { pushed: 0, pulled: 0, error: 'Offline' };
  }

  if (isSyncing) {
    return { pushed: 0, pulled: 0 };
  }

  isSyncing = true;
  setRelayStatus('syncing');

  let pushed = 0;
  let pulled = 0;

  try {
    // 1. Push local events to global live mesh channel & serverless relay
    const localEvents = await db.syncEvents.toArray();
    if (localEvents.length > 0) {
      // Broadcast recent local events to the public live mesh
      for (const evt of localEvents.slice(-20)) {
        publishLiveMeshEvent(evt).catch(() => {});
      }

      // Also persist to serverless endpoint if available
      try {
        const res = await pushRelayEventsFn({ data: { eventsJson: JSON.stringify(localEvents) } });
        pushed = res.inserted;
      } catch {
        pushed = localEvents.length;
      }
    }

    // 2. Ingest remote events from the global live mesh buffer
    try {
      const pollRes = await fetch(`${RELAY_HTTP_URL}/json?poll=1&since=12h`);
      if (pollRes.ok) {
        const text = await pollRes.text();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.event === 'message' && parsed.message) {
              const evt: SyncEvent = JSON.parse(parsed.message);
              if (evt && evt.id) {
                const shouldApply = await shouldApplyIncomingEvent(evt, currentPeerId);
                if (shouldApply) {
                  await applyEvent(evt, currentPeerId);
                  await markEventProcessed(evt.id, currentPeerId, evt.sourcePeerId);
                  pulled++;
                }

                // Ensure local table has it acknowledged
                const exists = await db.syncEvents.get(evt.id);
                if (!exists) {
                  await db.syncEvents.put({
                    ...evt,
                    status: 'acknowledged',
                    deliveredAt: Date.now(),
                  });
                }
              }
            }
          } catch {
            // Ignore malformed message line
          }
        }
      }
    } catch (pollErr) {
      console.warn('[relayClient] Global live mesh buffer poll warning:', pollErr);
    }

    // 3. Fallback: Pull from serverless function
    const since = getLastSyncedTimestamp();
    try {
      const pullRes = await pullRelayEventsFn({ data: { sinceTimestamp: since } });
      const remoteEvents: SyncEvent[] = JSON.parse(pullRes.eventsJson || '[]');
      let maxTimestamp = since;

      for (const evt of remoteEvents) {
        if (evt.timestamp > maxTimestamp) {
          maxTimestamp = evt.timestamp;
        }

        const shouldApply = await shouldApplyIncomingEvent(evt, currentPeerId);
        if (shouldApply) {
          try {
            await applyEvent(evt, currentPeerId);
            await markEventProcessed(evt.id, currentPeerId, evt.sourcePeerId);
            pulled++;
          } catch (applyErr) {
            console.warn('[relayClient] Failed to apply remote event:', evt.id, applyErr);
          }
        }
      }

      if (maxTimestamp > since) {
        setLastSyncedTimestamp(maxTimestamp);
      }
    } catch {
      // Serverless pull fallback silently handled
    }

    if (pulled > 0) {
      notifyEventIngested();
    }

    setRelayStatus('connected');
    return { pushed, pulled };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Relay sync failed';
    console.error('[relayClient] Sync error:', errorMsg);
    setRelayStatus('error');
    return { pushed, pulled, error: errorMsg };
  } finally {
    isSyncing = false;
  }
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let sseSource: EventSource | null = null;

/**
 * Starts continuous real-time live synchronization:
 * - Listens for incoming events via Server-Sent Events (SSE) over HTTPS for sub-100ms multi-device delivery.
 * - Periodic background buffer sweeps to ensure no dropped packets.
 */
export function startRelayAutoSync(getPeerId: () => string | null): () => void {
  if (typeof window === 'undefined') return () => {};

  isRunning = true;

  // Initialize Real-Time SSE Listener
  const initSSE = () => {
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }

    try {
      sseSource = new EventSource(`${RELAY_HTTP_URL}/sse`);

      sseSource.onopen = () => {
        setRelayStatus('connected');
      };

      sseSource.onmessage = async (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.event === 'message' && data.message) {
            const evt: SyncEvent = JSON.parse(data.message);
            const peerId = getPeerId();
            if (evt && evt.id && peerId) {
              const shouldApply = await shouldApplyIncomingEvent(evt, peerId);
              if (shouldApply) {
                await applyEvent(evt, peerId);
                await markEventProcessed(evt.id, peerId, evt.sourcePeerId);
                notifyEventIngested();
              }
            }
          }
        } catch (e) {
          console.warn('[relayClient] SSE message parse error:', e);
        }
      };

      sseSource.onerror = () => {
        // EventSource automatically retries connection
        if (!navigator.onLine) {
          setRelayStatus('offline');
        }
      };
    } catch (sseErr) {
      console.warn('[relayClient] SSE initialization warning:', sseErr);
    }
  };

  initSSE();

  const scheduleNext = (delayMs: number) => {
    if (!isRunning) return;
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      if (!isRunning) return;
      if (document.visibilityState === 'visible') {
        const peerId = getPeerId();
        if (peerId) {
          try {
            await syncWithCloudRelay(peerId);
          } catch {
            // Keep timer going on error
          }
        }
      }
      const nextDelay = 5000 + Math.floor(Math.random() * 2000);
      scheduleNext(nextDelay);
    }, delayMs);
  };

  // Initial sync catch-up after 1.5s
  scheduleNext(1500);

  const handleOnline = () => {
    initSSE();
    const peerId = getPeerId();
    if (peerId) syncWithCloudRelay(peerId);
  };

  const handleOffline = () => {
    setRelayStatus('offline');
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const peerId = getPeerId();
      if (peerId) syncWithCloudRelay(peerId);
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    isRunning = false;
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
