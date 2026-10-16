import { useMesh } from "@/lib/mesh-context";
import type { ConnectivityStatus } from "@/types/models";

const STATUSES: ConnectivityStatus[] = ["online", "offline", "degraded"];

function statusClass(status: ConnectivityStatus): string {
  if (status === "online") return "bg-mint text-teal-deep";
  if (status === "degraded") return "bg-amber/30 text-slate-forest";
  return "bg-sand text-slate-muted";
}

export function PeersPage() {
  const { peers, activePeer, setActivePeerId, updatePeerConnectivity } = useMesh();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Peer Network</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-muted">
          These are simulated identities in this browser, not separate devices. Setting a peer Online does not open a connection or copy records.
        </p>
      </div>
      <ul className="space-y-3">
        {peers.map((peer) => {
          const active = peer.peerId === activePeer?.peerId;
          return (
            <li key={peer.peerId} className={`rounded-2xl border bg-panel p-4 ${active ? "border-teal" : "border-sand"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{peer.displayName}</h2>
                  <p className="text-sm text-slate-muted">{peer.role} · {peer.peerId}</p>
                  <p className="text-xs text-slate-muted">Last activity {new Date(peer.lastSeenAt).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(peer.connectivityStatus)}`}>
                  {peer.connectivityStatus}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => setActivePeerId(peer.peerId)} disabled={active}>
                  {active ? "Selected" : "Use this peer"}
                </button>
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn-secondary capitalize"
                    aria-pressed={peer.connectivityStatus === status}
                    onClick={() => void updatePeerConnectivity(peer.peerId, status)}
                  >
                    Mark {status}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
