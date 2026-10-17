import { useEffect, useState, useCallback } from "react";
import { db, ensureDbInitialized, generateId } from "@/db/database";
import { AppContext, type AppState } from "@/store/AppStore";
import type { Peer, PeerLink } from "@/types";
import { AppShell } from "@/components/layout/AppShell";
import { Toast } from "@/components/Toast";
import { Dashboard } from "@/pages/Dashboard";
import { Incidents } from "@/pages/Incidents";
import { Tasks } from "@/pages/Tasks";
import { Inventory } from "@/pages/Inventory";
import { MapView } from "@/pages/MapView";
import { Peers } from "@/pages/Peers";
import { Agents } from "@/pages/Agents";
import { EventLog } from "@/pages/EventLog";
import { SyncQueue } from "@/pages/SyncQueue";
import { Conflicts } from "@/pages/Conflicts";
import { SystemTest } from "@/pages/SystemTest";
import { togglePeerLink as togglePeerLinkDirect } from "@/engine/sync";
import {
  startRelayAutoSync,
  syncWithCloudRelay,
  subscribeRelayStatus,
  subscribeEventIngested,
  type RelaySyncStatus,
} from "@/engine/relayClient";

export function App() {
  const [currentPeerId, setCurrentPeerIdState] = useState<string | null>(null);
  const [relayStatus, setRelayStatus] = useState<RelaySyncStatus>('idle');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [peerLinks, setPeerLinks] = useState<PeerLink[]>([]);
  const [currentPage, setCurrentPage] = useState<string>("overview");
  const [toasts, setToasts] = useState<{ id: string; msg: string; kind: 'info' | 'success' | 'error' | 'warning' }[]>([]);

  const refreshPeers = useCallback(async () => {
    const allPeers = await db.peers.toArray();
    setPeers(allPeers);
    const allLinks = await db.peerLinks.toArray();
    setPeerLinks(allLinks);
  }, []);

  const toast = useCallback((msg: string, kind: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const id = generateId('toast');
    setToasts((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const setCurrentPeerId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('disastermesh_current_peer_id', id);
      setCurrentPeerIdState(id);
    }
  }, []);

  const togglePeerLink = useCallback(async (linkId: string) => {
    const [pA, pB] = linkId.split('__');
    const newStatus = await togglePeerLinkDirect(pA, pB);
    await refreshPeers();
    toast(`Link ${pA} <-> ${pB} is now ${newStatus}`, newStatus === 'connected' ? 'success' : 'warning');
  }, [refreshPeers, toast]);

  const triggerCloudSync = useCallback(async () => {
    if (!currentPeerId) return;
    toast('Syncing with Cloud Mesh Relay...', 'info');
    const res = await syncWithCloudRelay(currentPeerId);
    if (res.error) {
      toast(`Relay Sync: ${res.error}`, 'error');
    } else {
      toast(`Cloud Mesh Synced: ${res.pushed} sent, ${res.pulled} received`, 'success');
      await refreshPeers();
    }
  }, [currentPeerId, toast, refreshPeers]);

  useEffect(() => {
    const unsub = subscribeRelayStatus((status) => {
      setRelayStatus(status);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeEventIngested(async () => {
      await refreshPeers();
    });
    return unsub;
  }, [refreshPeers]);

  useEffect(() => {
    const stop = startRelayAutoSync(() => currentPeerId);
    return stop;
  }, [currentPeerId]);

  useEffect(() => {
    (async () => {
      await ensureDbInitialized();
      await refreshPeers();
      const savedPeer = localStorage.getItem('disastermesh_current_peer_id');
      const allPeers = await db.peers.toArray();
      if (savedPeer && allPeers.some((p) => p.id === savedPeer)) {
        setCurrentPeerIdState(savedPeer);
      } else if (allPeers.length > 0) {
        setCurrentPeerIdState(allPeers[0].id);
      }
    })();
  }, [refreshPeers]);

  const appState: AppState = {
    currentPeerId,
    setCurrentPeerId,
    peers,
    refreshPeers,
    peerLinks,
    togglePeerLink,
    currentPage,
    setCurrentPage,
    toast,
    relayStatus,
    triggerCloudSync,
  };

  if (!currentPeerId) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-slate-muted">Loading DisasterMesh AI...</div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={appState}>
      <AppShell section={currentPage} onNavigate={setCurrentPage}>
        {(currentPage === "overview" || currentPage === "dashboard") && <Dashboard />}
        {currentPage === "incidents" && <Incidents />}
        {currentPage === "tasks" && <Tasks />}
        {(currentPage === "supplies" || currentPage === "inventory") && <Inventory />}
        {currentPage === "map" && <MapView />}
        {currentPage === "peers" && <Peers />}
        {currentPage === "agents" && <Agents />}
        {currentPage === "sync" && <SyncQueue />}
        {currentPage === "events" && <EventLog />}
        {currentPage === "conflicts" && <Conflicts />}
        {(currentPage === "tests" || currentPage === "systemtest") && <SystemTest />}
      </AppShell>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast message={t.msg} kind={t.kind} />
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export default App;
