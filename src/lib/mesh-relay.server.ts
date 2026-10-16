import { getSql, type Sql } from "@/lib/db";
import type { SyncEvent, EntityKind, EventKind } from "@/types";

export interface RelayRow {
  id: string;
  source_peer_id: string;
  target_peer_id: string;
  entity_kind: string;
  entity_id: string;
  event_kind: string;
  payload: Record<string, unknown> | string;
  version: number;
  timestamp: number | string;
  created_at: string;
}

let tableInitPromise: Promise<void> | null = null;

async function ensureRelayTable(sql: Sql): Promise<void> {
  tableInitPromise ??= (async () => {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS mesh_relay_events (
        id TEXT PRIMARY KEY,
        source_peer_id TEXT NOT NULL,
        target_peer_id TEXT NOT NULL,
        entity_kind TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_kind TEXT NOT NULL,
        payload JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_mesh_relay_events_timestamp ON mesh_relay_events (timestamp ASC)
    `);
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_mesh_relay_events_entity ON mesh_relay_events (entity_kind, entity_id)
    `);
  })().catch((err) => {
    tableInitPromise = null;
    throw err;
  });
  return tableInitPromise;
}

export async function pushRelayEvents(events: SyncEvent[]): Promise<{ inserted: number }> {
  if (!events || events.length === 0) return { inserted: 0 };
  const sql = await getSql();
  await ensureRelayTable(sql);

  let inserted = 0;
  for (const evt of events) {
    try {
      const payloadJson = JSON.stringify(evt.payload ?? {});
      await sql`
        INSERT INTO mesh_relay_events (
          id, source_peer_id, target_peer_id, entity_kind, entity_id, event_kind, payload, version, timestamp
        ) VALUES (
          ${evt.id},
          ${evt.sourcePeerId},
          ${evt.targetPeerId},
          ${evt.entityKind},
          ${evt.entityId},
          ${evt.eventKind},
          ${payloadJson}::jsonb,
          ${evt.version ?? 1},
          ${evt.timestamp}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (e) {
      console.error("[mesh-relay] Failed to insert event:", evt.id, e);
    }
  }
  return { inserted };
}

export async function pullRelayEvents(sinceTimestamp: number): Promise<SyncEvent[]> {
  const sql = await getSql();
  await ensureRelayTable(sql);

  const rows = await sql<RelayRow>`
    SELECT id, source_peer_id, target_peer_id, entity_kind, entity_id, event_kind, payload, version, timestamp
    FROM mesh_relay_events
    WHERE timestamp > ${sinceTimestamp}
    ORDER BY timestamp ASC
    LIMIT 200
  `;
  return rows.map((r) => {
    let parsedPayload: Record<string, unknown> = {};
    if (typeof r.payload === "string") {
      try {
        parsedPayload = JSON.parse(r.payload);
      } catch {
        parsedPayload = {};
      }
    } else if (r.payload && typeof r.payload === "object") {
      parsedPayload = r.payload;
    }

    const isDemo = Boolean(
      parsedPayload.isDemo ||
      (typeof parsedPayload.title === 'string' && parsedPayload.title.includes('[DEMO]'))
    );

    return {
      id: r.id,
      sourcePeerId: r.source_peer_id,
      targetPeerId: r.target_peer_id,
      entityKind: r.entity_kind as EntityKind,
      entityId: r.entity_id,
      eventKind: r.event_kind as EventKind,
      payload: parsedPayload,
      version: Number(r.version) || 1,
      timestamp: Number(r.timestamp),
      status: "pending",
      retries: 0,
      maxRetries: 5,
      ackId: null,
      deliveredAt: null,
      failedAt: null,
      errorMessage: null,
      isDemo,
    };
  });
}
