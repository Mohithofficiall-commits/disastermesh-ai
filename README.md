# DisasterMesh AI

Local coordination for disaster response when internet or a cloud service is unavailable. Teams need a shared picture of incidents, rescue tasks, relief supplies, and spatial hazards. This repository is the foundation for that system. It does not yet synchronize devices or run agents.

## Problem

Field teams often lose connectivity during a response. A useful tool has to keep working on the device in hand and, later, exchange updates with nearby peers without a central server. That exchange is a planned capability. It is not implemented or verified.

## Stack

- React 19 and TypeScript
- TanStack Start and Vite
- Tailwind CSS v4
- Lucide icons

IndexedDB (Dexie) and Leaflet are installed from an earlier prototype. Phase 0 does not use them. The visible app does not open a database or a map.

## Run

```bash
npm install
npm run dev
```

Typecheck: `npm run typecheck`. Lint: `npm run lint`. Production build: `npm run build`.

## Architecture (intended, not verified)

```text
Dashboard
  → Local application services
  → Local data storage
  → Synchronization engine
  → Reachable peer devices
```

Core operations are meant to work without a central cloud service. Phase 0 only draws the dashboard shell and shared types. Local storage, the sync engine, and peer delivery are not in the running UI.

## What is implemented

- Rescue Signal design tokens and the responsive shell, including a persistent SIMULATED NETWORK label.
- Three simulated peers (Field Response, Relief Supply, Regional Coordination) with separate IndexedDB records.
- Local incident reports and relief inventory, scoped by `sourcePeerId`. Switching peers does not copy data.
- Simulated connectivity (online, offline, degraded) stored on the peer row. It does not open a network.
- A local event log. Events are marked not synchronized.

IndexedDB database name: `disastermesh_local_v1` (Dexie). Tables: `peers`, `incidents`, `supplies`, `events`. The active peer id is kept in `localStorage` (`disastermesh.activePeerId`). Demo peer rows are inserted only when their ids are missing.

## What is not implemented

- Peer-to-peer transport, store-and-forward, and conflict resolution.
- AI agents and rescue-task assignment.
- A live map.
- Any claim that records leave this browser.

## What is a placeholder or leftover

- Incidents, tasks, supplies, map, peers, agents, sync queue, event log, conflicts, and system tests are placeholders.
- The header network line is a label only. It does not detect connectivity.
- `src/engine`, `src/db`, and the older `src/pages` files are an earlier prototype. They are not mounted. Do not treat them as verified offline sync.

## Planned phases

1. Phase 0 — foundation, models, shell (this phase).
2. Local persistence for the shared models.
3. Event outbox, acknowledgements, retries, and human conflict review.
4. Explainable local agents that recommend only. They must not dispatch responders.
5. A real peer transport. Still no requirement for a central cloud service for core operations.

## Limitations

- No peer-to-peer transport, WebRTC, mesh routing, or store-and-forward.
- No conflict resolution behavior.
- No autonomous or advisory agents in the running app.
- No claim that offline synchronization works.
