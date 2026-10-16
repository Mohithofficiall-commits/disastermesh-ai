import { useEffect, useState, useCallback } from 'react';
import { db } from '@/db/database';
import { useApp } from '@/store/AppStore';
import {
  Card, PageHeader, Badge, EmptyState, formatTime,
} from '@/components/ui';
import type { SyncEvent } from '@/types';
import {
  ScrollText, ArrowRight, CheckCircle2, Clock, AlertCircle, XCircle,
} from 'lucide-react';

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  delivered: ArrowRight,
  failed: XCircle,
  acknowledged: CheckCircle2,
};

const STATUS_COLORS: Record<string, 'amber' | 'teal' | 'coral' | 'mint'> = {
  pending: 'amber',
  delivered: 'teal',
  failed: 'coral',
  acknowledged: 'mint',
};

export function EventLog() {
  const { peers } = useApp();
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [processedEvents, setProcessedEvents] = useState<{ eventId: string; processedByPeerId: string; sourcePeerId: string; processedAt: number }[]>([]);
  const [filter, setFilter] = useState('all');

  const loadData = useCallback(async () => {
    const evts = await db.syncEvents.toArray();
    evts.sort((a, b) => b.timestamp - a.timestamp);
    setEvents(evts);
    const processed = await db.processedEvents.toArray();
    processed.sort((a, b) => b.processedAt - a.processedAt);
    setProcessedEvents(processed.map((p) => ({ eventId: p.eventId, processedByPeerId: p.processedByPeerId, sourcePeerId: p.sourcePeerId, processedAt: p.processedAt })));
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filtered = filter === 'all' ? events : events.filter((e) => e.status === filter);
  const peerMap = new Map(peers.map((p) => [p.id, p] as const));

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Event Log"
        subtitle="Complete event history with provenance, timestamps, and delivery status"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatBadge label="Total Events" count={events.length} icon={<ScrollText className="w-4 h-4" />} color="teal" />
        <StatBadge label="Processed" count={processedEvents.length} icon={<CheckCircle2 className="w-4 h-4" />} color="mint" />
        <StatBadge label="Pending" count={events.filter((e) => e.status === 'pending').length} icon={<Clock className="w-4 h-4" />} color="amber" />
        <StatBadge label="Failed" count={events.filter((e) => e.status === 'failed').length} icon={<XCircle className="w-4 h-4" />} color="coral" />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {['all', 'pending', 'delivered', 'acknowledged', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === s ? 'bg-teal text-white' : 'bg-white text-slate-muted border border-sand hover:bg-mint-pale/30'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <h3 className="text-sm font-semibold text-slate-forest mb-2">Outbox Events</h3>
          {filtered.slice(0, 50).map((evt) => {
            const StatusIcon = STATUS_ICONS[evt.status] || AlertCircle;
            const sourcePeer = peerMap.get(evt.sourcePeerId);
            const targetPeer = peerMap.get(evt.targetPeerId);
            return (
              <Card key={evt.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    evt.status === 'acknowledged' ? 'bg-mint/20 text-teal-deep' :
                    evt.status === 'failed' ? 'bg-coral/15 text-coral-dark' :
                    evt.status === 'pending' ? 'bg-amber/15 text-amber-dark' :
                    'bg-teal/10 text-teal'
                  }`}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={STATUS_COLORS[evt.status]} size="sm">{evt.status}</Badge>
                      <Badge color="slate" size="sm">{evt.entityKind}</Badge>
                      <Badge color="slate" size="sm">{evt.eventKind}</Badge>
                      {evt.isDemo && <Badge color="slate" size="sm">DEMO</Badge>}
                      <span className="text-xs text-slate-muted">v{evt.version}</span>
                    </div>
                    <div className="text-xs text-slate-muted mt-1 font-mono">
                      {evt.id}
                    </div>
                    <div className="text-xs text-slate-muted mt-0.5 flex items-center gap-1">
                      <span>{sourcePeer?.name || evt.sourcePeerId}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{targetPeer?.name || evt.targetPeerId}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-muted mt-1">
                      <span>Created: {formatTime(evt.timestamp)}</span>
                      {evt.deliveredAt && <span>Delivered: {formatTime(evt.deliveredAt)}</span>}
                      {evt.retries > 0 && <span className="text-amber-dark">Retries: {evt.retries}/{evt.maxRetries}</span>}
                      {evt.errorMessage && <span className="text-coral-dark">Error: {evt.errorMessage}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card className="p-6">
              <EmptyState message="No events in the log." icon={<ScrollText className="w-8 h-8" />} />
            </Card>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-forest mb-2">Processed Events (Dedup Log)</h3>
          <Card className="p-3 max-h-[600px] overflow-y-auto">
            <div className="space-y-1.5">
              {processedEvents.slice(0, 50).map((p, idx) => {
                const procPeer = peerMap.get(p.processedByPeerId);
                const srcPeer = peerMap.get(p.sourcePeerId);
                return (
                  <div key={idx} className="text-xs p-2 rounded-lg bg-mint-pale/20">
                    <div className="flex items-center gap-1 text-slate-forest">
                      <CheckCircle2 className="w-3 h-3 text-teal" />
                      <span className="font-medium truncate">{p.eventId.slice(0, 24)}...</span>
                    </div>
                    <div className="text-slate-muted mt-0.5">
                      {srcPeer?.name || p.sourcePeerId} → {procPeer?.name || p.processedByPeerId}
                    </div>
                    <div className="text-slate-muted">{formatTime(p.processedAt)}</div>
                  </div>
                );
              })}
              {processedEvents.length === 0 && (
                <p className="text-xs text-slate-muted text-center py-4">No processed events yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, count, icon, color }: { label: string; count: number; icon: React.ReactNode; color: 'teal' | 'mint' | 'amber' | 'coral' }) {
  const colors = {
    teal: 'bg-teal/10 text-teal',
    mint: 'bg-mint/20 text-teal-deep',
    amber: 'bg-amber/15 text-amber-dark',
    coral: 'bg-coral/10 text-coral-dark',
  };
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-muted">{label}</p>
          <p className="text-lg font-bold text-slate-forest">{count}</p>
        </div>
      </div>
    </Card>
  );
}
