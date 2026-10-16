// ===== Core Types for DisasterMesh AI =====

export type EntityKind =
  | 'incident'
  | 'task'
  | 'inventory'
  | 'spatial'
  | 'peer';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'active' | 'monitoring' | 'resolved' | 'false_alarm';
export type IncidentType =
  | 'flood'
  | 'fire'
  | 'earthquake'
  | 'landslide'
  | 'structural_collapse'
  | 'medical'
  | 'hazard'
  | 'blocked_route'
  | 'other';

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'rescue' | 'medical' | 'supply_delivery' | 'evacuation' | 'assessment';

export type InventoryCategory =
  | 'water'
  | 'food'
  | 'medical'
  | 'shelter'
  | 'tools'
  | 'communication'
  | 'fuel';

export type EventKind = 'create' | 'update' | 'delete' | 'reserve';
export type SyncStatus = 'pending' | 'delivered' | 'failed' | 'acknowledged';
export type ConflictStatus = 'unresolved' | 'resolved_accept_a' | 'resolved_accept_b' | 'resolved_merge';

export type PeerStatus = 'online' | 'offline';

export interface Peer {
  id: string;
  name: string;
  status: PeerStatus;
  createdAt: number;
  lastSeen: number;
  color: string;
  isLocal: boolean;
  role: string;
}

export interface PeerLink {
  id: string;
  peerAId: string;
  peerBId: string;
  status: 'connected' | 'disconnected';
  lastChanged: number;
}

export interface Incident {
  id: string;
  peerId: string;
  sourcePeerId?: string;
  type: IncidentType;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  lat: number;
  lng: number;
  locationLabel: string;
  peopleAffected: number;
  verified: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDemo: boolean;
}

export interface RescueTask {
  id: string;
  peerId: string;
  sourcePeerId?: string;
  incidentId: string;
  type: TaskType;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string | null;
  lat: number;
  lng: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDemo: boolean;
}

export interface InventoryItem {
  id: string;
  peerId: string;
  sourcePeerId?: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  lat: number;
  lng: number;
  locationLabel: string;
  reserved: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDemo: boolean;
}

export interface SpatialUpdate {
  id: string;
  peerId: string;
  sourcePeerId?: string;
  kind: 'hazard' | 'blocked_route' | 'safe_zone' | 'shelter';
  label: string;
  description: string;
  lat: number;
  lng: number;
  radius: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDemo: boolean;
}

export interface SyncEvent {
  id: string;
  sourcePeerId: string;
  targetPeerId: string;
  entityKind: EntityKind;
  entityId: string;
  eventKind: EventKind;
  payload: Record<string, unknown>;
  version: number;
  timestamp: number;
  status: SyncStatus;
  retries: number;
  maxRetries: number;
  ackId: string | null;
  deliveredAt: number | null;
  failedAt: number | null;
  errorMessage: string | null;
  isDemo: boolean;
}

export interface ProcessedEvent {
  id: string;
  eventId: string;
  processedByPeerId: string;
  sourcePeerId: string;
  processedAt: number;
}

export interface ConflictRecord {
  id: string;
  entityKind: EntityKind;
  entityId: string;
  eventAId: string;
  eventBId: string;
  peerAId: string;
  peerBId: string;
  payloadA: Record<string, unknown>;
  payloadB: Record<string, unknown>;
  description: string;
  status: ConflictStatus;
  resolvedBy: string | null;
  resolvedAt: number | null;
  resolutionNote: string | null;
  createdAt: number;
}

export interface AgentRecommendation {
  id: string;
  agentId: string;
  agentName: string;
  entityType: EntityKind;
  entityId: string;
  recommendation: string;
  reasoning: string[];
  confidence: number;
  action: string;
  createdAt: number;
}
