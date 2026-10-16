import { createContext, useContext } from "react";
import type { ConnectivityStatus, EventEnvelope, Incident, IncidentStatus, Peer, SupplyItem } from "@/types/models";
import type { createIncident, createSupplyItem } from "@/lib/localStore";

export type Mesh = {
  ready: boolean;
  error: string | null;
  peers: Peer[];
  activePeer: Peer | null;
  incidents: Incident[];
  supplies: SupplyItem[];
  events: EventEnvelope[];
  setActivePeerId: (peerId: string) => void;
  refresh: () => Promise<void>;
  createIncident: (input: Omit<Parameters<typeof createIncident>[0], "sourcePeerId">) => Promise<void>;
  updateIncidentStatus: (incidentId: string, status: IncidentStatus) => Promise<void>;
  createSupplyItem: (input: Omit<Parameters<typeof createSupplyItem>[0], "sourcePeerId">) => Promise<void>;
  updateSupplyQuantity: (itemId: string, quantity: number) => Promise<void>;
  updatePeerConnectivity: (peerId: string, status: ConnectivityStatus) => Promise<void>;
};

export const MeshContext = createContext<Mesh | null>(null);

export function useMesh(): Mesh {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used inside MeshProvider");
  return ctx;
}
