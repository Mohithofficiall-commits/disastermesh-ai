import { useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  GitMerge,
  LayoutDashboard,
  Map,
  Menu,
  Package,
  Radio,
  Cloud,
  RefreshCw,
  ScrollText,
  TestTube,
  Users,
  X,
} from "lucide-react";
import { useApp } from "@/store/AppStore";

export const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "tasks", label: "Rescue Tasks", icon: ClipboardList },
  { id: "supplies", label: "Supplies", icon: Package },
  { id: "map", label: "Spatial Map", icon: Map },
  { id: "peers", label: "Peer Network", icon: Users },
  { id: "agents", label: "Local AI Agents", icon: Activity },
  { id: "sync", label: "Sync Queue", icon: RefreshCw },
  { id: "events", label: "Event Log", icon: ScrollText },
  { id: "conflicts", label: "Conflict Resolution", icon: GitMerge },
  { id: "tests", label: "System Tests", icon: TestTube },
];

export function AppShell({
  section,
  onNavigate,
  children,
}: {
  section: string;
  onNavigate: (section: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { peers, currentPeerId, setCurrentPeerId, relayStatus, triggerCloudSync } = useApp();
  const activePeer = peers.find((p) => p.id === currentPeerId);

  const go = (id: string) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-ivory text-slate-forest topo-wash">
      <header className="sticky top-0 z-40 border-b border-sand bg-panel/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sand bg-ivory text-teal hover:bg-mint-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal lg:hidden"
            aria-expanded={open}
            aria-controls="app-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal text-panel">
              <Radio className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">DisasterMesh AI</p>
              <p className="truncate text-xs text-slate-muted">
                Resilient coordination. Even when connectivity fails.
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => triggerCloudSync()}
              title="Click to trigger manual cloud sync with other devices"
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors cursor-pointer border-sand bg-ivory hover:bg-mint-pale text-slate-forest"
            >
              <Cloud className={`size-3.5 ${relayStatus === 'connected' ? 'text-teal' : relayStatus === 'syncing' ? 'text-amber animate-spin' : 'text-slate-muted'}`} />
              <span>
                {relayStatus === 'connected' ? 'Cloud: Live' : relayStatus === 'syncing' ? 'Syncing...' : relayStatus === 'offline' ? 'Cloud: Offline' : 'Cloud Sync'}
              </span>
              <span
                className={`size-1.5 rounded-full ${relayStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : relayStatus === 'syncing' ? 'bg-amber' : 'bg-slate-400'}`}
              />
            </button>
            <label className="text-xs text-slate-muted">
              <span className="sr-only">Active simulated peer</span>
              <select
                className="max-w-[15rem] rounded-xl border border-sand bg-ivory px-3 py-2 text-sm text-slate-forest font-medium focus:outline-none focus:ring-2 focus:ring-teal/30"
                value={currentPeerId ?? ""}
                onChange={(e) => setCurrentPeerId(e.target.value)}
              >
                {peers.map((peer) => (
                  <option key={peer.id} value={peer.id}>
                    {peer.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="hidden items-center gap-2 rounded-full border border-sand bg-ivory px-3 py-1 text-xs text-slate-muted sm:inline-flex">
              <span className="size-2 rounded-full" style={{ backgroundColor: activePeer?.color || '#176B67' }} aria-hidden />
              {activePeer?.role || "Simulated peer"}
            </span>
            <span className="rounded-full border border-amber/50 bg-amber/20 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-forest">
              SIMULATED NETWORK
            </span>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[16.5rem_1fr]">
        <aside
          id="app-nav"
          className={`${open ? "block" : "hidden"} border-b border-sand bg-teal-deep text-panel lg:block lg:min-h-[calc(100vh-4.25rem)] lg:border-b-0`}
        >
          <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint ${
                    active ? "bg-teal text-panel font-semibold shadow-sm" : "text-mint hover:bg-teal/60"
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <p className="px-5 pb-5 text-xs text-mint/80">Phase 2: Persistent local store-and-forward sync with explainable AI.</p>
        </aside>
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
