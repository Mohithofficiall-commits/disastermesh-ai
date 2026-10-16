import { useState } from 'react';
import { db } from '@/db/database';
import { useApp } from '@/store/AppStore';
import { Card, PageHeader, Button, Badge } from '@/components/ui';
import { createDemoPeers, runDemoScenario, createConflictingReservations, resetDemoData } from '@/engine/demo';
import { attemptDelivery, replayEvent } from '@/engine/sync';
import { TestTube, Play, Users, RefreshCw, GitMerge, RotateCcw } from 'lucide-react';

export function SystemTest() {
  const { currentPeerId, toast, refreshPeers } = useApp();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const push = (line: string) => setLog((prev) => [`${new Date().toLocaleTimeString()} — ${line}`, ...prev].slice(0, 40));

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    push(`Start: ${label}`);
    try {
      await fn();
      push(`Done: ${label}`);
      toast(`${label} finished`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      push(`Failed: ${label} — ${msg}`);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="System Test"
        subtitle="Repeatable synthetic scenario. Every record is marked DEMO. Nothing here dispatches real responders."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <TestTube className="w-4 h-4 text-teal" />
            <h2 className="font-semibold text-slate-forest">Scenario steps</h2>
          </div>
          <ol className="text-sm text-slate-muted space-y-2 mb-4 list-decimal pl-4">
            <li>Create three labeled demo peers (Alpha, Bravo, Charlie), starting offline.</li>
            <li>Peer A reports a flood; link A-B is severed; events queue in outbox.</li>
            <li>Bravo records a blocked bridge; Charlie logs water and medical supplies.</li>
            <li>Reconnect link A-B and sync: verify delivery, acks, and sourcePeerId provenance.</li>
            <li>Replay latest event: verify deduplication in processedEvents table.</li>
            <li>Create competing water reservations: verify conflict detection.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => run('Reset Demo Data', async () => {
                await resetDemoData();
                await refreshPeers();
                push('All DEMO incidents, inventory, tasks, sync events, conflicts, and recommendations cleared.');
              })}
            >
              <RotateCcw className="w-4 h-4 text-rose-600" /> Reset Demo
            </Button>
            <Button disabled={busy} onClick={() => run('Create demo peers', async () => {
              const peers = await createDemoPeers();
              await refreshPeers();
              push(`${peers.length} peers in the mesh (Peer A, Peer B, Peer C)`);
            })}>
              <Users className="w-4 h-4" /> Setup Peers
            </Button>
            <Button disabled={busy || !currentPeerId} onClick={() => run('Demo scenario', async () => {
              await createDemoPeers();
              await runDemoScenario(currentPeerId!, (step) => push(step));
              await refreshPeers();
            })}>
              <Play className="w-4 h-4" /> Run 10-Step Scenario
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => run('Bring peers online + deliver', async () => {
              const peers = await db.peers.toArray();
              for (const p of peers) {
                await db.peers.update(p.id, { status: 'online', lastSeen: Date.now() });
              }
              // Connect all links
              const links = await db.peerLinks.toArray();
              for (const l of links) {
                await db.peerLinks.update(l.id, { status: 'connected', lastChanged: Date.now() });
              }
              await refreshPeers();
              const result = await attemptDelivery();
              push(`Delivered ${result.delivered}, retried ${result.retried}, failed ${result.failed}`);
            })}>
              <RefreshCw className="w-4 h-4" /> Sync Now (Online)
            </Button>
            <Button variant="amber" disabled={busy} onClick={() => run('Conflicting reservations', async () => {
              await createConflictingReservations(currentPeerId ?? 'peer_a');
              push('Open Conflicts to accept A, accept B, or merge.');
            })}>
              <GitMerge className="w-4 h-4" /> Force Conflict
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => run('Replay one event', async () => {
              const events = await db.syncEvents.toArray();
              const evt = events.sort((a, b) => b.timestamp - a.timestamp)[0];
              if (!evt) {
                push('No events to replay');
                return;
              }
              const result = await replayEvent(evt.id);
              push(`Replay ${evt.id.slice(0, 18)}… replayed=${result.replayed} dedup=${result.deduplicated}`);
            })}>
              <RotateCcw className="w-4 h-4" /> Replay Latest
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-forest">Run log</h2>
            <Badge color="slate">DEMO</Badge>
          </div>
          {log.length === 0 ? (
            <p className="text-sm text-slate-muted">No steps yet. Start with Peers, then Run scenario.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-auto font-mono text-xs text-slate-forest">
              {log.map((line, i) => (
                <li key={i} className="border-b border-sand/80 pb-2">{line}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
