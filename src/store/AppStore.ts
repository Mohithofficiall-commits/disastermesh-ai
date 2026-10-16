import { createContext, useContext } from 'react';
import type { Peer, PeerLink } from '@/types';

export interface AppState {
  currentPeerId: string | null;
  setCurrentPeerId: (id: string | null) => void;
  peers: Peer[];
  refreshPeers: () => Promise<void>;
  peerLinks: PeerLink[];
  togglePeerLink: (linkId: string) => Promise<void>;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  toast: (msg: string, kind?: 'info' | 'success' | 'error' | 'warning') => void;
  relayStatus: 'idle' | 'syncing' | 'connected' | 'offline' | 'error';
  triggerCloudSync: () => Promise<void>;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
