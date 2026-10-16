import { db, generateId } from '@/db/database';
import type {
  AgentRecommendation,
  TaskPriority,
} from '@/types';

// ===== Four Explainable Local Agents =====
// Each agent runs deterministic local rules, explains its reasoning,
// and NEVER autonomously dispatches emergency services.

// --- Agent 1: Incident Prioritization ---
export async function runIncidentPrioritization(peerId: string | null): Promise<AgentRecommendation[]> {
  let incidents = await db.incidents.toArray();
  if (peerId) {
    incidents = incidents.filter((i) => i.peerId === peerId);
  }
  incidents = incidents.filter((i) => i.status === 'active');

  // Deterministic scoring
  const severityScore: Record<string, number> = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
  };

  const scored = incidents.map((inc) => {
    let score = severityScore[inc.severity] ?? 50;
    // People affected weighting
    if (inc.peopleAffected >= 10) score += 30;
    else if (inc.peopleAffected >= 5) score += 20;
    else if (inc.peopleAffected >= 1) score += 10;
    // Unverified reports get reduced confidence
    if (!inc.verified) score -= 15;
    // Type urgency
    if (inc.type === 'flood' || inc.type === 'structural_collapse') score += 10;
    if (inc.type === 'medical') score += 15;
    return { inc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const recs: AgentRecommendation[] = [];
  for (let i = 0; i < scored.length; i++) {
    const { inc, score } = scored[i];
    const reasoning: string[] = [];
    reasoning.push(`Severity "${inc.severity}" contributes ${severityScore[inc.severity]} base points.`);
    if (inc.peopleAffected > 0) {
      reasoning.push(`${inc.peopleAffected} people affected adds urgency weighting.`);
    }
    if (!inc.verified) {
      reasoning.push('Report is UNVERIFIED — confidence reduced. Field verification recommended before committing resources.');
    }
    reasoning.push(`Overall priority score: ${score}/145.`);

    const rec: AgentRecommendation = {
      id: generateId('rec'),
      agentId: 'incident_prioritization',
      agentName: 'Incident Prioritization Agent',
      entityType: 'incident',
      entityId: inc.id,
      recommendation: `Priority ${i + 1}: "${inc.title}" — ${inc.severity.toUpperCase()} severity, ${inc.peopleAffected} people affected`,
      reasoning,
      confidence: inc.verified ? Math.min(score / 145, 1) : Math.min(score / 145, 0.8),
      action: i === 0 ? 'Recommend immediate task creation and resource assessment' : 'Queue for resource allocation',
      createdAt: Date.now(),
    };
    recs.push(rec);
    await db.agentRecommendations.put(rec);
  }

  return recs;
}

// --- Agent 2: Rescue Task Recommendation ---
export async function runRescueTaskRecommendation(peerId: string | null): Promise<AgentRecommendation[]> {
  let incidents = await db.incidents.toArray();
  let tasks = await db.tasks.toArray();
  if (peerId) {
    incidents = incidents.filter((i) => i.peerId === peerId);
    tasks = tasks.filter((t) => t.peerId === peerId);
  }
  incidents = incidents.filter((i) => i.status === 'active');

  const recs: AgentRecommendation[] = [];

  for (const inc of incidents) {
    const existingTasks = tasks.filter((t) => t.incidentId === inc.id);
    const activeTasks = existingTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

    const reasoning: string[] = [];
    let recommendation = '';
    let action = '';
    let confidence = 0.7;

    if (activeTasks.length === 0) {
      const taskType = inc.type === 'medical' ? 'medical' : inc.type === 'flood' ? 'rescue' : 'assessment';
      const priority: TaskPriority = inc.severity === 'critical' ? 'critical' : inc.severity === 'high' ? 'high' : 'medium';

      reasoning.push(`Incident "${inc.title}" has no active tasks assigned.`);
      reasoning.push(`Incident type "${inc.type}" suggests task type "${taskType}".`);
      reasoning.push(`Severity "${inc.severity}" maps to priority "${priority}".`);
      reasoning.push(`People affected: ${inc.peopleAffected}.`);

      recommendation = `Create ${taskType} task with ${priority} priority for "${inc.title}"`;
      action = 'recommend_create_task';
      confidence = inc.verified ? 0.85 : 0.6;
      reasoning.push('NOTE: This is a recommendation only. Human operator must approve task creation and dispatch.');
    } else if (activeTasks.length === 1) {
      reasoning.push(`Incident "${inc.title}" has 1 active task.`);
      reasoning.push('Consider adding a secondary task for supply delivery if people affected > 5.');
      recommendation = inc.peopleAffected > 5
        ? `Consider adding supply_delivery task for "${inc.title}" — ${inc.peopleAffected} people need supplies`
        : `Current task coverage is adequate for "${inc.title}"`;
      action = inc.peopleAffected > 5 ? 'recommend_create_task' : 'no_action';
      confidence = 0.75;
    } else {
      reasoning.push(`Incident "${inc.title}" has ${activeTasks.length} active tasks — coverage is good.`);
      recommendation = `No additional tasks needed for "${inc.title}"`;
      action = 'no_action';
      confidence = 0.9;
    }

    const rec: AgentRecommendation = {
      id: generateId('rec'),
      agentId: 'rescue_task_recommendation',
      agentName: 'Rescue Task Recommendation Agent',
      entityType: 'incident',
      entityId: inc.id,
      recommendation,
      reasoning,
      confidence,
      action,
      createdAt: Date.now(),
    };
    recs.push(rec);
    await db.agentRecommendations.put(rec);
  }

  return recs;
}

// --- Agent 3: Relief Supply Allocation ---
export async function runReliefSupplyAllocation(peerId: string | null): Promise<AgentRecommendation[]> {
  let inventory = await db.inventory.toArray();
  let incidents = await db.incidents.toArray();
  if (peerId) {
    inventory = inventory.filter((i) => i.peerId === peerId);
    incidents = incidents.filter((i) => i.peerId === peerId);
  }
  incidents = incidents.filter((i) => i.status === 'active');

  const recs: AgentRecommendation[] = [];

  for (const inc of incidents) {
    const reasoning: string[] = [];
    let recommendation = '';
    let confidence = 0.7;

    const people = inc.peopleAffected;
    if (people === 0) continue;

    // Deterministic allocation rules
    const waterNeeded = Math.ceil(people * 3); // 3 liters per person
    const medicalKitsNeeded = Math.ceil(people / 10); // 1 kit per 10 people
    const foodNeeded = Math.ceil(people * 2); // 2 meals per person

    const waterAvailable = inventory.filter((i) => i.category === 'water');
    const medicalAvailable = inventory.filter((i) => i.category === 'medical');
    const foodAvailable = inventory.filter((i) => i.category === 'food');

    const totalWater = waterAvailable.reduce((s, i) => i.quantity - i.reserved, 0);
    const totalMedical = medicalAvailable.reduce((s, i) => i.quantity - i.reserved, 0);
    const totalFood = foodAvailable.reduce((s, i) => i.quantity - i.reserved, 0);

    reasoning.push(`Incident "${inc.title}" has ${people} people affected.`);
    reasoning.push(`Estimated needs: ${waterNeeded} water units, ${medicalKitsNeeded} medical kits, ${foodNeeded} food units.`);

    const gaps: string[] = [];
    if (totalWater < waterNeeded) gaps.push(`water shortfall of ${waterNeeded - totalWater} units`);
    if (totalMedical < medicalKitsNeeded) gaps.push(`medical kit shortfall of ${medicalKitsNeeded - totalMedical} units`);
    if (totalFood < foodNeeded) gaps.push(`food shortfall of ${foodNeeded - totalFood} units`);

    if (gaps.length > 0) {
      reasoning.push(`Supply gaps detected: ${gaps.join(', ')}.`);
      recommendation = `Allocate available supplies to "${inc.title}" and flag gaps for resupply. Shortfalls: ${gaps.join('; ')}.`;
      confidence = 0.6;
    } else {
      reasoning.push('Available inventory covers all estimated needs.');
      recommendation = `Allocate ${waterNeeded} water, ${medicalKitsNeeded} medical kits, ${foodNeeded} food to "${inc.title}".`;
      confidence = 0.85;
    }

    reasoning.push('Allocation must be confirmed by human operator. Reservations are advisory only.');

    const rec: AgentRecommendation = {
      id: generateId('rec'),
      agentId: 'relief_supply_allocation',
      agentName: 'Relief Supply Allocation Agent',
      entityType: 'incident',
      entityId: inc.id,
      recommendation,
      reasoning,
      confidence,
      action: 'recommend_reserve_supplies',
      createdAt: Date.now(),
    };
    recs.push(rec);
    await db.agentRecommendations.put(rec);
  }

  return recs;
}

// --- Agent 4: Spatial Risk Analysis ---
export async function runSpatialRiskAnalysis(peerId: string | null): Promise<AgentRecommendation[]> {
  let spatial = await db.spatial.toArray();
  let incidents = await db.incidents.toArray();
  if (peerId) {
    spatial = spatial.filter((s) => s.peerId === peerId);
    incidents = incidents.filter((i) => i.peerId === peerId);
  }
  incidents = incidents.filter((i) => i.status === 'active');

  const recs: AgentRecommendation[] = [];

  function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  for (const inc of incidents) {
    const reasoning: string[] = [];
    const nearbyHazards: { label: string; distance: number; kind: string }[] = [];
    const blockedRoutes: { label: string; distance: number }[] = [];

    for (const s of spatial) {
      const dist = haversineMeters(inc.lat, inc.lng, s.lat, s.lng);
      if (s.kind === 'hazard' && dist < 2000) {
        nearbyHazards.push({ label: s.label, distance: Math.round(dist), kind: s.kind });
      }
      if (s.kind === 'blocked_route' && dist < 2000) {
        blockedRoutes.push({ label: s.label, distance: Math.round(dist) });
      }
    }

    nearbyHazards.sort((a, b) => a.distance - b.distance);
    blockedRoutes.sort((a, b) => a.distance - b.distance);

    let recommendation = '';
    let confidence = 0.7;
    let action = 'no_action';

    if (nearbyHazards.length > 0 && blockedRoutes.length > 0) {
      reasoning.push(`Incident "${inc.title}" is near ${nearbyHazards.length} hazard(s) and ${blockedRoutes.length} blocked route(s).`);
      reasoning.push(`Closest hazard: "${nearbyHazards[0].label}" at ${nearbyHazards[0].distance}m.`);
      reasoning.push(`Closest blocked route: "${blockedRoutes[0].label}" at ${blockedRoutes[0].distance}m.`);
      recommendation = `Reroute rescue teams away from hazards and blocked routes for "${inc.title}". Use alternate access path.`;
      confidence = 0.85;
      action = 'recommend_reroute';
    } else if (nearbyHazards.length > 0) {
      reasoning.push(`Incident "${inc.title}" is near ${nearbyHazards.length} hazard(s).`);
      reasoning.push(`Closest: "${nearbyHazards[0].label}" at ${nearbyHazards[0].distance}m.`);
      recommendation = `Approach "${inc.title}" from direction away from nearby hazard. Maintain safety perimeter.`;
      confidence = 0.8;
      action = 'recommend_caution';
    } else if (blockedRoutes.length > 0) {
      reasoning.push(`Incident "${inc.title}" is near ${blockedRoutes.length} blocked route(s).`);
      reasoning.push(`Closest: "${blockedRoutes[0].label}" at ${blockedRoutes[0].distance}m.`);
      recommendation = `Use alternate route for "${inc.title}" — primary access blocked.`;
      confidence = 0.8;
      action = 'recommend_reroute';
    } else {
      reasoning.push(`No hazards or blocked routes detected within 2km of "${inc.title}".`);
      recommendation = `Access to "${inc.title}" appears clear. Standard approach acceptable.`;
      confidence = 0.9;
      action = 'no_action';
    }

    const rec: AgentRecommendation = {
      id: generateId('rec'),
      agentId: 'spatial_risk_analysis',
      agentName: 'Spatial Risk Analysis Agent',
      entityType: 'incident',
      entityId: inc.id,
      recommendation,
      reasoning,
      confidence,
      action,
      createdAt: Date.now(),
    };
    recs.push(rec);
    await db.agentRecommendations.put(rec);
  }

  return recs;
}

export async function runAllAgents(peerId: string | null): Promise<AgentRecommendation[]> {
  const r1 = await runIncidentPrioritization(peerId);
  const r2 = await runRescueTaskRecommendation(peerId);
  const r3 = await runReliefSupplyAllocation(peerId);
  const r4 = await runSpatialRiskAnalysis(peerId);
  return [...r1, ...r2, ...r3, ...r4];
}

export async function clearAgentRecommendations(): Promise<void> {
  await db.agentRecommendations.clear();
}
