import { useEffect, useState, useCallback } from 'react';
import { db } from '@/db/database';
import { useApp } from '@/store/AppStore';
import {
  Card, PageHeader, Button, Badge, EmptyState,
} from '@/components/ui';
import {
  runIncidentPrioritization,
  runRescueTaskRecommendation,
  runReliefSupplyAllocation,
  runSpatialRiskAnalysis,
  runAllAgents,
  clearAgentRecommendations,
} from '@/engine/agents';
import type { AgentRecommendation } from '@/types';
import {
  Brain, BrainCircuit, AlertTriangle, ClipboardList, Package, Map as MapIcon,
  RefreshCw, ChevronRight, Lightbulb, ShieldAlert,
} from 'lucide-react';

const AGENTS = [
  {
    id: 'incident_prioritization',
    name: 'Incident Prioritization Agent',
    description: 'Scores and ranks active incidents by severity, people affected, and verification status using deterministic rules.',
    icon: AlertTriangle,
    color: 'coral' as const,
    run: (peerId: string | null) => runIncidentPrioritization(peerId),
  },
  {
    id: 'rescue_task_recommendation',
    name: 'Rescue Task Recommendation Agent',
    description: 'Analyzes incidents for task coverage gaps and recommends task creation with appropriate type and priority.',
    icon: ClipboardList,
    color: 'amber' as const,
    run: (peerId: string | null) => runRescueTaskRecommendation(peerId),
  },
  {
    id: 'relief_supply_allocation',
    name: 'Relief Supply Allocation Agent',
    description: 'Estimates supply needs per incident and compares against available inventory, flagging shortfalls.',
    icon: Package,
    color: 'teal' as const,
    run: (peerId: string | null) => runReliefSupplyAllocation(peerId),
  },
  {
    id: 'spatial_risk_analysis',
    name: 'Spatial Risk Analysis Agent',
    description: 'Computes proximity between incidents and hazards/blocked routes to recommend safe approach paths.',
    icon: MapIcon,
    color: 'mint' as const,
    run: (peerId: string | null) => runSpatialRiskAnalysis(peerId),
  },
];

export function Agents() {
  const { currentPeerId, toast } = useApp();
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([]);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const recs = await db.agentRecommendations.toArray();
    recs.sort((a, b) => b.createdAt - a.createdAt);
    setRecommendations(recs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunAll = async () => {
    setRunning(true);
    await clearAgentRecommendations();
    await runAllAgents(currentPeerId);
    await loadData();
    setRunning(false);
    toast('All agents completed analysis', 'success');
  };

  const handleRunOne = async (agentId: string) => {
    setRunning(true);
    const agent = AGENTS.find((a) => a.id === agentId);
    if (agent) {
      await agent.run(currentPeerId);
      await loadData();
      toast(`${agent.name} completed`, 'success');
    }
    setRunning(false);
  };

  const handleClear = async () => {
    await clearAgentRecommendations();
    await loadData();
    toast('Recommendations cleared', 'info');
  };

  const recsByAgent = recommendations.reduce((acc, rec) => {
    if (!acc[rec.agentId]) acc[rec.agentId] = [];
    acc[rec.agentId].push(rec);
    return acc;
  }, {} as Record<string, AgentRecommendation[]>);

  return (
    <div className="pt-14 lg:pt-0">
      <PageHeader
        title="AI Agents"
        subtitle="Four explainable local agents with deterministic rules and human-in-the-loop decisions"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClear}>
              Clear
            </Button>
            <Button onClick={handleRunAll} disabled={running}>
              {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              Run All Agents
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-6 bg-amber/10 border-amber/30">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-dark flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-forest">Safety Constraint</p>
            <p className="text-xs text-slate-muted mt-1">
              All agents use deterministic local rules and produce advisory recommendations only.
              Agents NEVER autonomously dispatch emergency services. Human operator approval is required for all consequential actions.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const recs = recsByAgent[agent.id] || [];
          return (
            <Card key={agent.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    agent.color === 'coral' ? 'bg-coral/15 text-coral-dark' :
                    agent.color === 'amber' ? 'bg-amber/15 text-amber-dark' :
                    agent.color === 'teal' ? 'bg-teal/10 text-teal' :
                    'bg-mint/20 text-teal-deep'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-forest text-sm">{agent.name}</h3>
                    <p className="text-xs text-slate-muted">{recs.length} recommendations</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => handleRunOne(agent.id)} disabled={running}>
                  Run
                </Button>
              </div>
              <p className="text-xs text-slate-muted mb-2">{agent.description}</p>
              {recs.length > 0 && (
                <button
                  onClick={() => setExpanded(expanded === agent.id ? null : agent.id)}
                  className="text-xs text-teal hover:underline flex items-center gap-1"
                >
                  {expanded === agent.id ? 'Hide' : 'Show'} recommendations
                  <ChevronRight className={`w-3 h-3 transition-transform ${expanded === agent.id ? 'rotate-90' : ''}`} />
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {expanded && recsByAgent[expanded] && (
        <div className="space-y-3 animate-slide-in">
          <h3 className="text-sm font-semibold text-slate-forest flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-dark" />
            {AGENTS.find((a) => a.id === expanded)?.name} — Detailed Recommendations
          </h3>
          {recsByAgent[expanded].map((rec, idx) => (
            <Card key={idx} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-slate-forest">{rec.recommendation}</p>
                <Badge color="teal" size="sm">{Math.round(rec.confidence * 100)}%</Badge>
              </div>
              <div className="bg-mint-pale/30 rounded-lg p-3 mt-2">
                <p className="text-xs font-semibold text-slate-muted mb-1">Reasoning:</p>
                <ul className="text-xs text-slate-forest space-y-1 list-disc list-inside">
                  {rec.reasoning.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge color="slate" size="sm">Action: {rec.action}</Badge>
                <span className="text-xs text-slate-muted">Entity: {rec.entityType}:{rec.entityId.slice(0, 16)}...</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!expanded && recommendations.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold text-slate-forest text-sm mb-3">All Recent Recommendations</h3>
          <div className="space-y-2">
            {recommendations.slice(0, 10).map((rec, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-mint-pale/20">
                <Brain className="w-4 h-4 text-teal mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-forest">{rec.agentName}</p>
                  <p className="text-xs text-slate-muted truncate">{rec.recommendation}</p>
                </div>
                <span className="text-xs text-slate-muted flex-shrink-0">{Math.round(rec.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recommendations.length === 0 && (
        <Card className="p-6">
          <EmptyState message="No recommendations yet. Run agents to generate explainable analysis." icon={<Brain className="w-8 h-8" />} />
        </Card>
      )}
    </div>
  );
}
