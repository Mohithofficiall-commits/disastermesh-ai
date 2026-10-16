import { useMemo, useState } from "react";
import { useMesh } from "@/lib/mesh-context";
import type { EventEnvelope } from "@/types/models";

function summary(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Local change";
  const record = payload as Record<string, unknown>;
  if (typeof record.title === "string") return record.title;
  if (typeof record.itemName === "string") return `${record.itemName}${typeof record.quantityAvailable === "number" ? ` (${record.quantityAvailable})` : ""}`;
  if (typeof record.connectivityStatus === "string") return `Connectivity ${record.connectivityStatus}`;
  if (typeof record.status === "string" && typeof record.title === "string") return record.title;
  return "Local change";
}

export function EventsPage() {
  const { events, peers } = useMesh();
  const [type, setType] = useState<"all" | EventEnvelope["eventType"]>("all");
  const [peerId, setPeerId] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      events.filter((event) => (type === "all" || event.eventType === type) && (peerId === "all" || event.sourcePeerId === peerId)),
    [events, type, peerId],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Event Log</h1>
        <p className="mt-1 text-sm text-slate-muted">
          Locally recorded only. Nothing here is synchronized or delivered to another peer.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Event type
          <select className="field" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">All</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
          </select>
        </label>
        <label className="text-sm">
          Source peer
          <select className="field" value={peerId} onChange={(e) => setPeerId(e.target.value)}>
            <option value="all">All local peers</option>
            {peers.map((peer) => (
              <option key={peer.peerId} value={peer.peerId}>{peer.displayName}</option>
            ))}
          </select>
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand bg-panel px-4 py-8 text-sm text-slate-muted">No local events match this filter.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((event) => (
            <li key={event.eventId} className="rounded-2xl border border-sand bg-panel p-4">
              <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === event.eventId ? null : event.eventId)}>
                <p className="font-semibold">{event.eventType} · {summary(event.payload)}</p>
                <p className="text-sm text-slate-muted">
                  Source {peers.find((p) => p.peerId === event.sourcePeerId)?.displayName ?? event.sourcePeerId}
                  {" · "}recorded {new Date(event.createdAt).toLocaleString()}
                  {" · "}observed {new Date(event.observedAt).toLocaleString()}
                </p>
                <p className="text-xs text-teal">Local record · not synchronized</p>
              </button>
              {openId === event.eventId && (
                <pre className="mt-3 overflow-auto rounded-xl bg-ivory p-3 text-xs">{JSON.stringify(event, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
