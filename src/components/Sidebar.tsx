import { useApp } from '@/store/AppStore';
import {
  LayoutDashboard,
  AlertTriangle,
  ClipboardList,
  Package,
  Map,
  Users,
  Brain,
  ScrollText,
  RefreshCw,
  GitMerge,
  TestTube,
  Radio,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'tasks', label: 'Rescue Tasks', icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'peers', label: 'Peer Network', icon: Users },
  { id: 'agents', label: 'AI Agents', icon: Brain },
  { id: 'events', label: 'Event Log', icon: ScrollText },
  { id: 'sync', label: 'Sync Queue', icon: RefreshCw },
  { id: 'conflicts', label: 'Conflicts', icon: GitMerge },
  { id: 'systemtest', label: 'System Test', icon: TestTube },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, currentPeerId, peers } = useApp();
  const localPeer = peers.find((p) => p.id === currentPeerId);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-teal-deep text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-mint" />
          <span className="font-semibold text-sm">DisasterMesh AI</span>
        </div>
        <select
          value={currentPage}
          onChange={(e) => setCurrentPage(e.target.value)}
          className="bg-teal text-white text-sm rounded-lg px-2 py-1 border border-teal-light"
        >
          {NAV_ITEMS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-72 bg-teal-deep text-white flex-col z-30">
        <div className="px-6 py-5 border-b border-teal-light/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mint/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-mint" />
            </div>
            <div>
              <h1 className="font-semibold text-base leading-tight">DisasterMesh AI</h1>
              <p className="text-xs text-mint/80">Decentralized Response</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-teal-light/30">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-teal/40">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: localPeer?.color || '#A9DCD0' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{localPeer?.name || 'Unknown'}</p>
              <p className="text-xs text-mint/70">{localPeer?.role || ''}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-mint/20 text-mint">
              {localPeer?.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-mint/20 text-mint'
                    : 'text-white/80 hover:bg-teal/40 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-teal-light/30">
          <p className="text-xs text-mint/60">
            Offline-first · Event-synchronized
          </p>
          <p className="text-xs text-mint/40 mt-1">
            Hackathon prototype — not for live deployment
          </p>
        </div>
      </aside>
    </>
  );
}
