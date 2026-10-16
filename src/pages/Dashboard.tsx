import { useEffect, useState, useCallback } from 'react';
import { db } from '@/db/database';
import { useApp } from '@/store/AppStore';
import { Card, StatCard, PageHeader, Badge, Button } from '@/components/ui';
import { runAllAgents } from '@/engine/agents';
import { attemptDelivery } from '@/engine/sync';
import type { Incident, RescueTask, InventoryItem, SyncEvent, Peer, AgentRecommendation } from '@/types';
import {
  AlertTriangle,
  ClipboardList,
  Package,
  Users,
  RefreshCw,
  Brain,
  Activity,
  Wifi,
  WifiOff,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export function Dashboard() {
  const { currentPeerId, setCurrentPage, toast } = useApp();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tasks, setTasks] = useState<RescueTask[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentPeerId) return;
    const incs = await db.incidents.where('peerId').equals(currentPeerId).toArray();
    const tsk = await db.tasks.where('peerId').equals(currentPeerId).toArray();
    const inv = await db.inventory.where('peerId').equals(currentPeerId).toArray();
    const evts = await db.syncEvents.toArray();
    const prs = await db.peers.toArray();
    const recs = await db.agentRecommendations.toArray();
    setIncidents(incs);
    setTasks(tsk);
    setInventory(inv);
    setEvents(evts);
    setPeers(prs);
    setRecommendations(recs);
  }, [currentPeerId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activeIncidents = incidents.filter((i) => i.status === 'active');
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress');
  const totalInventory = inventory.reduce((s, i) => s + i.quantity, 0);
  const pendingEvents = events.filter((e) => e.status === 'pending').length;
  const failedEvents = events.filter((e) => e.status === 'failed').length;
  const ackedEvents = events.filter((e) => e.status === 'acknowledged').length;
  const onlinePeers = peers.filter((p) => p.status === 'online').length;

  const handleSync = async () => {
    setLoading(true);
    const result = await attemptDelivery();
    await loadData();
    setLoading(false);
    if (result.delivered > 0) {
      toast(`Synced ${result.delivered} events successfully`, 'success');
    } else if (result.retried > 0) {
      toast(`Retried ${result.retried} events — some peers may be offline`, 'warning');
    } else {
      toast('No pending events to sync', 'info');
    }
  };

  const handleRunAgents = async () => {
    setLoading(true);
    await runAllAgents(currentPeerId);
    await loadData();
    setLoading(false);
    toast('AI agents completed analysis', 'success');
  };

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="Operations Overview"
        subtitle="Real-time snapshot of incidents, tasks, inventory, and network status"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleRunAgents} disabled={loading}>
              <Brain className="w-4 h-4" />
              Run Agents
            </Button>
            <Button onClick={handleSync} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Incidents"
          value={activeIncidents.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          accent="coral"
          sublabel={`${incidents.filter((i) => !i.verified).length} unverified`}
        />
        <StatCard
          label="Active Tasks"
          value={pendingTasks.length}
          icon={<ClipboardList className="w-5 h-5" />}
          accent="amber"
          sublabel={`${tasks.filter((t) => t.status === 'completed').length} completed`}
        />
        <StatCard
          label="Inventory Items"
          value={inventory.length}
          icon={<Package className="w-5 h-5" />}
          accent="teal"
          sublabel={`${totalInventory} total units`}
        />
        <StatCard
          label="Peers Online"
          value={`${onlinePeers}/${peers.length}`}
          icon={<Users className="w-5 h-5" />}
          accent="mint"
          sublabel={pendingEvents > 0 ? `${pendingEvents} events queued` : 'All synced'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-teal" />
            <h3 className="font-semibold text-slate-forest text-sm">Sync Status</h3>
          </div>
          <div className="space-y-2">
            <SyncBar label="Acknowledged" count={ackedEvents} total={events.length} color="bg-teal" />
            <SyncBar label="Pending" count={pendingEvents} total={events.length} color="bg-amber" />
            <SyncBar label="Failed" count={failedEvents} total={events.length} color="bg-coral" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-teal" />
            <h3 className="font-semibold text-slate-forest text-sm">Network Status</h3>
          </div>
          <div className="space-y-2">
            {peers.slice(0, 5).map((peer) => (
              <div key={peer.id} className="flex items-center gap-2 text-sm">
                {peer.status === 'online' ? (
                  <Wifi className="w-3.5 h-3.5 text-teal" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-slate-muted" />
                )}
                <span className="flex-1 truncate text-slate-forest">{peer.name}</span>
                <Badge color={peer.status === 'online' ? 'mint' : 'slate'} size="sm">
                  {peer.status}
                </Badge>
              </div>
            ))}
            {peers.length === 0 && (
              <p className="text-xs text-slate-muted">No peers registered yet</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-teal" />
            <h3 className="font-semibold text-slate-forest text-sm">Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <QuickAction label="Report New Incident" page="incidents" setPage={setCurrentPage} />
            <QuickAction label="Create Rescue Task" page="tasks" setPage={setCurrentPage} />
            <QuickAction label="Add Inventory" page="inventory" setPage={setCurrentPage} />
            <QuickAction label="View Map" page="map" setPage={setCurrentPage} />
            <QuickAction label="Run System Tests" page="systemtest" setPage={setCurrentPage} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-forest text-sm">Recent Incidents</h3>
            <button onClick={() => setCurrentPage('incidents')} className="text-xs text-teal hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {activeIncidents.slice(0, 5).map((inc) => (
              <div key={inc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-mint-pale/30 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  inc.severity === 'critical' ? 'bg-coral' :
                  inc.severity === 'high' ? 'bg-amber' : 'bg-teal'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-forest truncate">{inc.title}</p>
                  <p className="text-xs text-slate-muted">{inc.locationLabel} · {inc.peopleAffected} people</p>
                </div>
                {!inc.verified && <Badge color="amber" size="sm">Unverified</Badge>}
                {inc.isDemo && <Badge color="slate" size="sm">DEMO</Badge>}
              </div>
            ))}
            {activeIncidents.length === 0 && (
              <p className="text-xs text-slate-muted py-4 text-center">No active incidents</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-forest text-sm">Agent Recommendations</h3>
            <button onClick={() => setCurrentPage('agents')} className="text-xs text-teal hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 5).map((rec, idx) => (
              <div key={idx} className="p-2 rounded-lg hover:bg-mint-pale/30 transition-colors">
                <div className="flex items-start gap-2">
                  <Brain className="w-3.5 h-3.5 text-teal mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-forest truncate">{rec.agentName}</p>
                    <p className="text-xs text-slate-muted truncate">{rec.recommendation}</p>
                  </div>
                  <span className="text-xs text-slate-muted">{Math.round(rec.confidence * 100)}%</span>
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <p className="text-xs text-slate-muted py-4 text-center">No recommendations yet — run agents to generate</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SyncBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-muted">{label}</span>
        <span className="text-slate-forest font-medium">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-sand overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickAction({ label, page, setPage }: { label: string; page: string; setPage: (p: string) => void }) {
  return (
    <button
      onClick={() => setPage(page)}
      className="w-full flex items-center justify-between text-sm text-slate-forest px-3 py-2 rounded-lg hover:bg-mint-pale/40 transition-colors"
    >
      <span>{label}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-muted" />
    </button>
  );
}
