import { useEffect, useState, useCallback } from 'react';
import { db } from '@/db/database';
import { useApp } from '@/store/AppStore';
import {
  Card, PageHeader, Button, Badge, EmptyState, formatTime,
} from '@/components/ui';
import { resolveConflict } from '@/engine/sync';
import type { ConflictRecord, Peer } from '@/types';
import {
  GitMerge, Check, AlertTriangle, User, ArrowRight,
} from 'lucide-react';

export function Conflicts() {
  const { peers, toast } = useApp();
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);

  const loadData = useCallback(async () => {
    const confl = await db.conflicts.toArray();
    confl.sort((a, b) => b.createdAt - a.createdAt);
    setConflicts(confl);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const peerMap = new Map(peers.map((p) => [p.id, p] as const));
  const unresolved = conflicts.filter((c) => c.status === 'unresolved');
  const resolved = conflicts.filter((c) => c.status !== 'unresolved');

  const handleResolve = async (conflict: ConflictRecord, resolution: 'resolved_accept_a' | 'resolved_accept_b' | 'resolved_merge', note: string) => {
    await resolveConflict(conflict.id, resolution, 'operator', note);
    await loadData();
    const labels = {
      resolved_accept_a: 'Accepted Peer A version',
      resolved_accept_b: 'Accepted Peer B version',
      resolved_merge: 'Merged both versions',
    };
    toast(`Conflict resolved: ${labels[resolution]}`, 'success');
  };

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Conflict Resolution"
        subtitle="Competing updates require human-reviewed reconciliation"
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-dark" />
            <div>
              <p className="text-xs text-slate-muted">Unresolved</p>
              <p className="text-2xl font-bold text-slate-forest">{unresolved.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-teal" />
            <div>
              <p className="text-xs text-slate-muted">Resolved</p>
              <p className="text-2xl font-bold text-slate-forest">{resolved.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {unresolved.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-forest mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-dark" />
          Awaiting Human Review
          </h3>
          <div className="space-y-4">
            {unresolved.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                peerMap={peerMap}
                onResolve={(resolution, note) => handleResolve(conflict, resolution, note)}
              />
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-forest mb-3">Resolved Conflicts</h3>
          <div className="space-y-3">
            {resolved.map((conflict) => {
              const peerA = peerMap.get(conflict.peerAId);
              const peerB = peerMap.get(conflict.peerBId);
              return (
                <Card key={conflict.id} className="p-4 opacity-75">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-teal" />
                    <Badge color="mint" size="sm">{conflict.status.replace('_', ' ')}</Badge>
                    <Badge color="slate" size="sm">{conflict.entityKind}</Badge>
                    <span className="text-xs text-slate-muted ml-auto">{formatTime(conflict.resolvedAt || conflict.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-forest">{conflict.description}</p>
                  <div className="text-xs text-slate-muted mt-2">
                    <span>{peerA?.name || conflict.peerAId}</span>
                    <ArrowRight className="w-3 h-3 inline mx-1" />
                    <span>{peerB?.name || conflict.peerBId}</span>
                    {conflict.resolutionNote && <p className="mt-1 italic">Note: {conflict.resolutionNote}</p>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {conflicts.length === 0 && (
        <Card className="p-6">
          <EmptyState message="No conflicts detected. Conflicts arise when peers make competing updates to the same entity." icon={<GitMerge className="w-8 h-8" />} />
        </Card>
      )}
    </div>
  );
}

function ConflictCard({
  conflict, peerMap, onResolve,
}: {
  conflict: ConflictRecord;
  peerMap: Map<string, Peer>;
  onResolve: (resolution: 'resolved_accept_a' | 'resolved_accept_b' | 'resolved_merge', note: string) => void;
}) {
  const [note, setNote] = useState('');
  const peerA = peerMap.get(conflict.peerAId);
  const peerB = peerMap.get(conflict.peerBId);

  return (
    <Card className="p-5 border-amber/30">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-dark" />
        <Badge color="amber" size="sm">Unresolved</Badge>
        <Badge color="slate" size="sm">{conflict.entityKind}</Badge>
        <span className="text-xs text-slate-muted ml-auto">{formatTime(conflict.createdAt)}</span>
      </div>

      <p className="text-sm text-slate-forest mb-4">{conflict.description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-coral/5 border border-coral/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-coral/15 flex items-center justify-center text-coral-dark text-xs font-bold">
              A
            </div>
            <span className="text-sm font-medium text-slate-forest">{peerA?.name || conflict.peerAId}</span>
          </div>
          <pre className="text-xs text-slate-muted overflow-x-auto bg-white/50 rounded p-2 max-h-32 overflow-y-auto">
            {JSON.stringify(conflict.payloadA, null, 2)}
          </pre>
        </div>
        <div className="bg-teal/5 border border-teal/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-teal/15 flex items-center justify-center text-teal text-xs font-bold">
              B
            </div>
            <span className="text-sm font-medium text-slate-forest">{peerB?.name || conflict.peerBId}</span>
          </div>
          <pre className="text-xs text-slate-muted overflow-x-auto bg-white/50 rounded p-2 max-h-32 overflow-y-auto">
            {JSON.stringify(conflict.payloadB, null, 2)}
          </pre>
        </div>
      </div>

      <div className="space-y-3">
        <input
          className="w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm text-slate-forest focus:outline-none focus:border-teal"
          placeholder="Resolution note (required for audit trail)..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="danger" onClick={() => onResolve('resolved_accept_a', note || 'Accepted Peer A')}>
            <Check className="w-3 h-3" /> Accept A
          </Button>
          <Button size="sm" variant="primary" onClick={() => onResolve('resolved_accept_b', note || 'Accepted Peer B')}>
            <Check className="w-3 h-3" /> Accept B
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onResolve('resolved_merge', note || 'Merged manually')}>
            <GitMerge className="w-3 h-3" /> Merge
          </Button>
        </div>
        <p className="text-xs text-slate-muted flex items-center gap-1">
          <User className="w-3 h-3" />
          Human approval required for consequential decisions. Resolution is logged with timestamp and operator ID.
        </p>
      </div>
    </Card>
  );
}
