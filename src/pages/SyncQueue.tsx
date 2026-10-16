import { useEffect, useState, useCallback } from 'react';
import { db } from '@/db/database';
import { useApp } from '@/store/AppStore';
import {
  Card, PageHeader, Button, Badge, EmptyState, formatTime,
} from '@/components/ui';
import { attemptDelivery, replayEvent } from '@/engine/sync';
import type { SyncEvent } from '@/types';
import {
  RefreshCw, ArrowRight, CheckCircle2, Clock, XCircle, RotateCw,
  Play,
} from 'lucide-react';

export function SyncQueue() {
  const { peers, toast } = useApp();
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    const evts = await db.syncEvents.toArray();
    evts.sort((a, b) => b.timestamp - a.timestamp);
    setEvents(evts);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    const result = await attemptDelivery();
    await loadData();
    setSyncing(false);
    toast(`Delivered: ${result.delivered}, Retried: ${result.retried}, Failed: ${result.failed}`, result.delivered > 0 ? 'success' : 'info');
  };

  const handleReplay = async (eventId: string) => {
    const result = await replayEvent(eventId);
    await loadData();
    if (result.deduplicated) {
      toast('Event replay was deduplicated — already processed', 'info');
    } else {
      toast('Event replayed and delivered', 'success');
    }
  };

  const peerMap = new Map(peers.map((p) => [p.id, p] as const));

  const pending = events.filter((e) => e.status === 'pending');
  const delivered = events.filter((e) => e.status === 'delivered' || e.status === 'acknowledged');
  const failed = events.filter((e) => e.status === 'failed');

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Sync Queue"
        subtitle="Store-and-forward event queue with retries, acknowledgements, and deduplication"
        action={
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Attempt Delivery
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-dark" />
            <div>
              <p className="text-xs text-slate-muted">Pending</p>
              <p className="text-2xl font-bold text-slate-forest">{pending.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal" />
            <div>
              <p className="text-xs text-slate-muted">Delivered/ACKed</p>
              <p className="text-2xl font-bold text-slate-forest">{delivered.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-coral-dark" />
            <div>
              <p className="text-xs text-slate-muted">Failed</p>
              <p className="text-2xl font-bold text-slate-forest">{failed.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        {events.slice(0, 50).map((evt) => {
          const sourcePeer = peerMap.get(evt.sourcePeerId);
          const targetPeer = peerMap.get(evt.targetPeerId);
          const canReplay = evt.status === 'acknowledged' || evt.status === 'delivered';
          return (
            <Card key={evt.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  evt.status === 'acknowledged' ? 'bg-mint/20 text-teal-deep' :
                  evt.status === 'failed' ? 'bg-coral/15 text-coral-dark' :
                  evt.status === 'pending' ? 'bg-amber/15 text-amber-dark' :
                  'bg-teal/10 text-teal'
                }`}>
                  {evt.status === 'pending' ? <Clock className="w-4 h-4" /> :
                   evt.status === 'failed' ? <XCircle className="w-4 h-4" /> :
                   evt.status === 'acknowledged' ? <CheckCircle2 className="w-4 h-4" /> :
                   <ArrowRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge color={
                      evt.status === 'acknowledged' ? 'mint' :
                      evt.status === 'failed' ? 'coral' :
                      evt.status === 'pending' ? 'amber' : 'teal'
                    } size="sm">{evt.status}</Badge>
                    <Badge color="slate" size="sm">{evt.entityKind} · {evt.eventKind}</Badge>
                    <span className="text-xs text-slate-muted">v{evt.version}</span>
                    {evt.isDemo && <Badge color="slate" size="sm">DEMO</Badge>}
                    {evt.retries > 0 && <Badge color="amber" size="sm">retry {evt.retries}/{evt.maxRetries}</Badge>}
                  </div>
                  <div className="text-xs text-slate-muted font-mono mb-1">{evt.id}</div>
                  <div className="text-xs text-slate-muted flex items-center gap-1 mb-1">
                    {sourcePeer?.name || evt.sourcePeerId}
                    <ArrowRight className="w-3 h-3" />
                    {targetPeer?.name || evt.targetPeerId}
                    {targetPeer && (
                      <span className={`ml-1 ${targetPeer.status === 'online' ? 'text-teal' : 'text-slate-muted'}`}>
                        ({targetPeer.status})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-muted">
                    Created: {formatTime(evt.timestamp)}
                    {evt.deliveredAt && ` · Delivered: ${formatTime(evt.deliveredAt)}`}
                    {evt.errorMessage && ` · Error: ${evt.errorMessage}`}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {canReplay && (
                    <Button size="sm" variant="ghost" onClick={() => handleReplay(evt.id)}>
                      <Play className="w-3 h-3" />
                      Replay
                    </Button>
                  )}
                  {evt.status === 'failed' && evt.retries < evt.maxRetries && (
                    <Button size="sm" variant="secondary" onClick={handleSync}>
                      <RotateCw className="w-3 h-3" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {events.length === 0 && (
        <Card className="p-6">
          <EmptyState message="No events in the sync queue. Create incidents, tasks, or inventory to generate events." icon={<RefreshCw className="w-8 h-8" />} />
        </Card>
      )}
    </div>
  );
}
