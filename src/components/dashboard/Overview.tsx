import { AlertTriangle, Map, Radio, Users } from "lucide-react";
import { useMesh } from "@/lib/mesh-context";
import type { AppSection } from "@/types/models";

export function Overview({ onNavigate }: { onNavigate: (section: AppSection) => void }) {
  const { activePeer, incidents, supplies, events, ready } = useMesh();
  const localEvents = events.filter((event) => event.sourcePeerId === activePeer?.peerId);
  const critical = incidents.filter((incident) => incident.severity === "critical" && incident.status !== "resolved");

  const cards = [
    { title: "This peer", detail: ready ? (activePeer?.displayName ?? "No peer selected") : "Opening local database…" },
    { title: "Local incidents", detail: ready ? `${incidents.length} stored on this peer only` : "—" },
    { title: "Local supplies", detail: ready ? `${supplies.length} items on this peer only` : "—" },
    { title: "Local events", detail: ready ? `${localEvents.length} events recorded by this peer` : "—" },
    { title: "Connectivity (simulated)", detail: activePeer ? `${activePeer.connectivityStatus} — not a live link` : "—" },
    { title: "Critical incidents", detail: critical.length === 0 ? "None stored on this peer." : critical.map((c) => c.title).join(", ") },
    { title: "Other peers", detail: "Switching peers does not merge or copy their records." },
    { title: "Synchronization", detail: "Not implemented. No event is delivered to another peer." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-muted">
            Counts are this simulated peer's IndexedDB records, not a shared network picture.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => onNavigate("incidents")}>
            <AlertTriangle className="size-4" aria-hidden />
            Report Incident
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigate("peers")}>
            <Users className="size-4" aria-hidden />
            View Network
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigate("map")}>
            <Map className="size-4" aria-hidden />
            Open Map
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <section key={card.title} className="rounded-2xl border border-sand bg-panel p-4 shadow-sm">
            <h2 className="text-sm font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-muted">{card.detail}</p>
          </section>
        ))}
      </div>
      <section className="rounded-2xl border border-sand bg-mint-pale/60 p-4">
        <div className="flex items-start gap-3">
          <Radio className="mt-0.5 size-4 text-teal" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">SIMULATED NETWORK</h2>
            <p className="mt-1 text-sm text-slate-muted">
              Peer A, B, and C share this browser only as separate databases. Online, offline, and degraded are labels. They do not transfer data.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
