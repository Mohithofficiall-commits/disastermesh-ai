import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Incident, Peer, SupplyItem, EventEnvelope } from "@/types/models";
import * as store from "@/lib/localStore";
import { MeshContext, type Mesh } from "@/lib/mesh-context";

export function MeshProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [activePeerId, setActiveId] = useState(store.DEMO_PEERS[0].peerId);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [events, setEvents] = useState<EventEnvelope[]>([]);

  const refresh = useCallback(async () => {
    const nextPeers = await store.getPeers();
    const active = store.getActivePeerId();
    const [nextIncidents, nextSupplies, nextEvents] = await Promise.all([
      store.getIncidentsByPeer(active),
      store.getInventoryByPeer(active),
      store.getLocalEvents(),
    ]);
    setPeers(nextPeers);
    setActiveId(active);
    setIncidents(nextIncidents);
    setSupplies(nextSupplies);
    setEvents(nextEvents);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await store.ensureDemoPeers();
        if (!cancelled) await refresh();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Local database failed to open.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const setActivePeerId = useCallback(
    (peerId: string) => {
      store.setActivePeerId(peerId);
      void refresh().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not switch peer.");
      });
    },
    [refresh],
  );

  const guard = useCallback(
    async (fn: () => Promise<void>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed.";
        setError(message);
        throw err;
      }
    },
    [refresh],
  );

  const value = useMemo<Mesh>(() => {
    const activePeer = peers.find((p) => p.peerId === activePeerId) ?? null;
    return {
      ready,
      error,
      peers,
      activePeer,
      incidents,
      supplies,
      events,
      setActivePeerId,
      refresh,
      createIncident: (input) => {
        if (!activePeer) return Promise.reject(new Error("No active peer."));
        return guard(() => store.createIncident({ ...input, sourcePeerId: activePeer.peerId }).then(() => undefined));
      },
      updateIncidentStatus: (incidentId, status) => guard(() => store.updateIncidentStatus(incidentId, status)),
      createSupplyItem: (input) => {
        if (!activePeer) return Promise.reject(new Error("No active peer."));
        return guard(() => store.createSupplyItem({ ...input, sourcePeerId: activePeer.peerId }).then(() => undefined));
      },
      updateSupplyQuantity: (itemId, quantity) => guard(() => store.updateSupplyQuantity(itemId, quantity)),
      updatePeerConnectivity: (peerId, status) => guard(() => store.updatePeerConnectivity(peerId, status)),
    };
  }, [ready, error, peers, activePeerId, incidents, supplies, events, setActivePeerId, refresh, guard]);

  return <MeshContext.Provider value={value}>{children}</MeshContext.Provider>;
}
