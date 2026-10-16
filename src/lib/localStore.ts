import Dexie, { type Table } from "dexie";
import type {
  ConnectivityStatus,
  EventEnvelope,
  Incident,
  IncidentStatus,
  IncidentType,
  Peer,
  SupplyItem,
} from "@/types/models";

const DB_NAME = "disastermesh_local_v1";
const ACTIVE_KEY = "disastermesh.activePeerId";

export const DEMO_PEERS: Peer[] = [
  {
    peerId: "peer_a_field",
    displayName: "Peer A — Field Response Team",
    role: "Field Response Team",
    connectivityStatus: "offline",
    lastSeenAt: new Date(0).toISOString(),
  },
  {
    peerId: "peer_b_supply",
    displayName: "Peer B — Relief Supply Unit",
    role: "Relief Supply Unit",
    connectivityStatus: "offline",
    lastSeenAt: new Date(0).toISOString(),
  },
  {
    peerId: "peer_c_coord",
    displayName: "Peer C — Regional Coordination Unit",
    role: "Regional Coordination Unit",
    connectivityStatus: "offline",
    lastSeenAt: new Date(0).toISOString(),
  },
];

class LocalMeshDB extends Dexie {
  peers!: Table<Peer, string>;
  incidents!: Table<Incident, string>;
  supplies!: Table<SupplyItem, string>;
  events!: Table<EventEnvelope, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      peers: "peerId, connectivityStatus",
      incidents: "incidentId, sourcePeerId, status, createdAt",
      supplies: "itemId, sourcePeerId, updatedAt",
      events: "eventId, sourcePeerId, eventType, entityId, createdAt",
    });
  }
}

const db = new LocalMeshDB();

function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  const rand = crypto.randomUUID();
  return `${prefix}_${rand}`;
}

async function writeEvent(
  sourcePeerId: string,
  eventType: EventEnvelope["eventType"],
  entityId: string,
  payload: unknown,
  observedAt: string,
): Promise<void> {
  const createdAt = nowIso();
  const event: EventEnvelope = {
    eventId: createId("evt"),
    eventType,
    sourcePeerId,
    entityId,
    observedAt,
    createdAt,
    version: 1,
    verificationStatus: "unverified",
    payload,
  };
  await db.events.add(event);
}

/** Insert demo peers only when their IDs are missing. Never reseeds user data. */
export async function ensureDemoPeers(): Promise<void> {
  const seededAt = nowIso();
  await db.transaction("rw", db.peers, async () => {
    for (const demo of DEMO_PEERS) {
      const existing = await db.peers.get(demo.peerId);
      if (!existing) {
        await db.peers.add({ ...demo, lastSeenAt: seededAt });
      }
    }
  });
}

export async function getPeers(): Promise<Peer[]> {
  await ensureDemoPeers();
  const peers = await db.peers.toArray();
  const order = DEMO_PEERS.map((p) => p.peerId);
  return peers.sort((a, b) => order.indexOf(a.peerId) - order.indexOf(b.peerId));
}

export function getActivePeerId(): string {
  const stored = localStorage.getItem(ACTIVE_KEY);
  if (stored && DEMO_PEERS.some((p) => p.peerId === stored)) return stored;
  return DEMO_PEERS[0].peerId;
}

export function setActivePeerId(peerId: string): void {
  localStorage.setItem(ACTIVE_KEY, peerId);
}

export async function getIncidentsByPeer(peerId: string): Promise<Incident[]> {
  const rows = await db.incidents.where("sourcePeerId").equals(peerId).toArray();
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getInventoryByPeer(peerId: string): Promise<SupplyItem[]> {
  const rows = await db.supplies.where("sourcePeerId").equals(peerId).toArray();
  return rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getLocalEvents(peerId?: string): Promise<EventEnvelope[]> {
  const rows = peerId
    ? await db.events.where("sourcePeerId").equals(peerId).toArray()
    : await db.events.toArray();
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createIncident(input: {
  sourcePeerId: string;
  title: string;
  incidentType: IncidentType;
  severity: Incident["severity"];
  description: string;
  locationName: string;
  latitude?: number;
  longitude?: number;
  reportedBy: string;
}): Promise<Incident> {
  const createdAt = nowIso();
  const incident: Incident = {
    incidentId: createId("inc"),
    title: input.title.trim(),
    description: input.description.trim(),
    incidentType: input.incidentType,
    severity: input.severity,
    location: {
      label: input.locationName.trim(),
      ...(input.latitude !== undefined && input.longitude !== undefined
        ? { latitude: input.latitude, longitude: input.longitude }
        : {}),
    },
    reportedBy: input.reportedBy.trim() || "Unspecified field team",
    sourcePeerId: input.sourcePeerId,
    createdAt,
    status: "open",
    verificationStatus: "unverified",
  };
  await db.transaction("rw", db.incidents, db.events, db.peers, async () => {
    await db.incidents.add(incident);
    await writeEvent(input.sourcePeerId, "create", incident.incidentId, incident, createdAt);
    await db.peers.update(input.sourcePeerId, { lastSeenAt: createdAt });
  });
  return incident;
}

export async function updateIncidentStatus(
  incidentId: string,
  status: IncidentStatus,
): Promise<void> {
  const existing = await db.incidents.get(incidentId);
  if (!existing) throw new Error("Incident not found on this device.");
  const createdAt = nowIso();
  const next: Incident = { ...existing, status };
  await db.transaction("rw", db.incidents, db.events, db.peers, async () => {
    await db.incidents.put(next);
    await writeEvent(existing.sourcePeerId, "update", incidentId, { status, title: existing.title }, createdAt);
    await db.peers.update(existing.sourcePeerId, { lastSeenAt: createdAt });
  });
}

export async function createSupplyItem(input: {
  sourcePeerId: string;
  itemName: string;
  quantityAvailable: number;
  unit: string;
  locationName: string;
}): Promise<SupplyItem> {
  const updatedAt = nowIso();
  const item: SupplyItem = {
    itemId: createId("sup"),
    itemName: input.itemName.trim(),
    quantityAvailable: input.quantityAvailable,
    unit: input.unit.trim(),
    location: { label: input.locationName.trim() },
    updatedAt,
    sourcePeerId: input.sourcePeerId,
  };
  await db.transaction("rw", db.supplies, db.events, db.peers, async () => {
    await db.supplies.add(item);
    await writeEvent(input.sourcePeerId, "create", item.itemId, item, updatedAt);
    await db.peers.update(input.sourcePeerId, { lastSeenAt: updatedAt });
  });
  return item;
}

export async function updateSupplyQuantity(itemId: string, quantityAvailable: number): Promise<void> {
  const existing = await db.supplies.get(itemId);
  if (!existing) throw new Error("Supply item not found on this device.");
  const updatedAt = nowIso();
  const next: SupplyItem = { ...existing, quantityAvailable, updatedAt };
  await db.transaction("rw", db.supplies, db.events, db.peers, async () => {
    await db.supplies.put(next);
    await writeEvent(
      existing.sourcePeerId,
      "update",
      itemId,
      { itemName: existing.itemName, quantityAvailable },
      updatedAt,
    );
    await db.peers.update(existing.sourcePeerId, { lastSeenAt: updatedAt });
  });
}

export async function updatePeerConnectivity(
  peerId: string,
  connectivityStatus: ConnectivityStatus,
): Promise<void> {
  const existing = await db.peers.get(peerId);
  if (!existing) throw new Error("Peer not found.");
  const createdAt = nowIso();
  await db.transaction("rw", db.peers, db.events, async () => {
    await db.peers.update(peerId, { connectivityStatus, lastSeenAt: createdAt });
    await writeEvent(
      peerId,
      "update",
      peerId,
      { connectivityStatus, displayName: existing.displayName },
      createdAt,
    );
  });
}
