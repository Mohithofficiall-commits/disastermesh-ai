import { db } from '@/db/database';
import { applyEvent, isEventProcessed, markEventProcessed } from '@/engine/sync';
import { pushRelayEventsFn, pullRelayEventsFn } from '@/lib/mesh-relay';
import type { SyncEvent } from '@/types';

export type RelaySyncStatus = 'idle' | 'syncing' | 'connected' | 'offline' | 'error';

let relayStatus: RelaySyncStatus = 'idle';
const statusListeners = new Set<(status: RelaySyncStatus) => void>();

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
    // 1. Push local events to server relay
    const localEvents = await db.syncEvents.toArray();
    if (localEvents.length > 0) {
      // Send events created by this local device
      const res = await pushRelayEventsFn({ data: { eventsJson: JSON.stringify(localEvents) } });
      pushed = res.inserted;
    }

    // 2. Pull remote events from other devices
    const since = getLastSyncedTimestamp();
    const pullRes = await pullRelayEventsFn({ data: { sinceTimestamp: since } });
    let remoteEvents: SyncEvent[] = [];
    try {
      remoteEvents = JSON.parse(pullRes.eventsJson || '[]');
    } catch {
      remoteEvents = [];
    }

    let maxTimestamp = since;

    for (const evt of remoteEvents) {
      if (evt.timestamp > maxTimestamp) {
        maxTimestamp = evt.timestamp;
      }

      // Check if this peer already processed this event
      const alreadyProcessed = await isEventProcessed(evt.id, currentPeerId);
      if (!alreadyProcessed) {
        try {
          await applyEvent(evt, currentPeerId);
          await markEventProcessed(evt.id, currentPeerId, evt.sourcePeerId);
          pulled++;
        } catch (applyErr) {
          console.warn('[relayClient] Failed to apply remote event:', evt.id, applyErr);
        }
      }

      // Ensure the event exists in local outbox/inbox list as acknowledged
      const existingInDb = await db.syncEvents.get(evt.id);
      if (!existingInDb) {
        await db.syncEvents.put({
          ...evt,
          status: 'acknowledged',
          deliveredAt: Date.now(),
        });
      }
    }

    if (maxTimestamp > since) {
      setLastSyncedTimestamp(maxTimestamp);
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

export function startRelayAutoSync(getPeerId: () => string | null): () => void {
  if (typeof window === 'undefined') return () => {};

  isRunning = true;

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
      // Schedule next poll with jitter (7s to 9s)
      const nextDelay = 7000 + Math.floor(Math.random() * 2000);
      scheduleNext(nextDelay);
    }, delayMs);
  };

  // Run initial sync after page has finished loading (3 seconds)
  scheduleNext(3000);

  const handleOnline = () => {
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
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
