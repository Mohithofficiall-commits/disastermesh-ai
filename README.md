# DisasterMesh AI 📡

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20App-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://disastermesh-ai.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Mohithofficiall-commits/disastermesh-ai)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Offline First](https://img.shields.io/badge/Architecture-Offline--First%20CRDT-176B67?style=for-the-badge)](https://dexie.org/)

> **Decentralized, offline-first tactical coordination for disaster response teams.**
> Operates seamlessly without internet or central servers, synchronizes peer-to-peer across distributed devices, and provides real-time multi-device cloud mesh relaying with explainable local AI agents.

---

## 🔗 Quick Links

| Resource | Link |
|---|---|
| 🌐 **Live Web Application** | **[https://disastermesh-ai.vercel.app](https://disastermesh-ai.vercel.app)** |
| 🚀 **Direct Vercel Deployment** | **[https://disastermesh-krddk8q7a-medical-ai-app.vercel.app](https://disastermesh-krddk8q7a-medical-ai-app.vercel.app)** |
| 📂 **GitHub Source Code** | **[https://github.com/Mohithofficiall-commits/disastermesh-ai](https://github.com/Mohithofficiall-commits/disastermesh-ai)** |
| ⚡ **One-Click Deploy to Vercel** | **[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMohithofficiall-commits%2Fdisastermesh-ai)** |

---

## ⚡ Key Highlights & Features

### 1. 🔄 Real Multi-Device Live Synchronization
- **Zero-Cloud-Dependency Local First**: Full read/write operational capability stored locally in browser IndexedDB (Dexie).
- **Cloud Mesh Relay**: When network or internet is intermittently available, devices automatically publish and subscribe to peer updates via a shared Postgres / PGLite relay engine.
- **Bi-Directional Provenance**: Every incident, supply reservation, and task tracks origin peer ID, vector version, and synchronization status.

### 2. 👥 Dynamic Peer Network & Link Simulator
- **Add Custom Peers**: Instantly deploy new tactical units (`Drone Recon Alpha`, `SAR Unit Echo`, `MedEvac Mobile`, `Supply Convoy`, `Shelter Ops`).
- **Role Presets & Badge Color Palettes**: Choose from specialized emergency response roles and distinctive tactical colors.
- **Interactive Link Toggling**: Sever or restore individual links between any two peers to test and observe offline store-and-forward queuing in real time.

### 3. 🗺️ Interactive Spatial Map (Leaflet)
- **Live Incident & Hazard Mapping**: Plot priority incidents, medical triage zones, impassable routes, and supply depots.
- **Cross-Peer Markers**: View real-time tactical updates placed by other rescue teams across the mesh.

### 4. 🤖 Explainable Local AI Agents
- **Incident Triage Agent**: Automatically ranks and categorizes incoming emergency reports by severity and casualty count.
- **Resource Allocation Agent**: Analyzes field inventories and suggests optimal supply dispatch to high-risk zones.
- **Route Feasibility Agent**: Flags hazard intersections and recommends safe travel corridors.
- **Transparent Reasoning**: Complete step-by-step rationales provided for every recommendation.

### 5. ⚖️ CRDT Conflict Resolution
- Automatic timestamp and vector-version resolution for distributed updates.
- Interactive conflict inspector allows operators to audit and manually review divergent concurrent edits.

---

## 🏛️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Tactical Web Client                         │
│  React 19 + TanStack Router + Tailwind v4 ("Rescue Signal" UI)  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
               Local Store & Background Services
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│      IndexedDB (Dexie)        │       │   Local Explainable AI Agents │
│  - Peers & Simulated Links    │       │   - Automated Triage          │
│  - Incidents & Rescue Tasks   │       │   - Supply Allocation         │
│  - Inventory & Reservations   │       │   - Hazard Corridor Check     │
│  - Spatial Map Geo-Markers    │       └───────────────────────────────┘
│  - Sync Queue & Event Log     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│              Store-and-Forward Sync Engine                    │
│   - Bidirectional Link Simulation (Sever / Reconnect)         │
│   - Offline Delta Queuing & Vector Clock Conflict Resolver    │
└───────────────────────────────┬───────────────────────────────┘
                                │
                ▲ Intermittent Cloud Connectivity
                                ▼
┌───────────────────────────────────────────────────────────────┐
│             Cloud Mesh Relay (Vercel Serverless)              │
│   - POST / GET Server Functions with Deduplicated Events     │
│   - Real-Time Cross-Device Delta Broadcast                    │
└───────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```bash
disastermesh-ai/
├── src/
│   ├── components/            # Reusable UI component library (Rescue Signal Design)
│   │   ├── layout/            # App shell, responsive header, and preview bridges
│   │   ├── Sidebar.tsx        # Navigation sidebar & mobile drawer
│   │   ├── Toast.tsx          # Non-blocking notification toasts
│   │   └── ui.tsx             # Buttons, Cards, Badges, Modals, FormFields
│   ├── db/
│   │   └── database.ts        # IndexedDB Dexie client schema & seed datasets
│   ├── engine/
│   │   ├── agents.ts          # Explainable AI recommendation agents
│   │   ├── demo.ts            # Automated multi-peer scenario generator
│   │   ├── relayClient.ts     # Cloud relay background polling & push client
│   │   ├── sync.ts            # Core CRDT store-and-forward sync engine
│   │   └── syncHelpers.ts     # Vector clocks, hash digests, event utilities
│   ├── lib/
│   │   ├── auth/              # Better Auth & gate identity management
│   │   ├── db.ts              # Server-side Postgres / PGLite database connector
│   │   ├── mesh-relay.server.ts # Cloud mesh relay server function
│   │   └── mesh-relay.ts      # Client RPC wrapper for mesh relay
│   ├── pages/                 # Full tactical application pages
│   │   ├── Dashboard.tsx      # Overview metrics & quick action hub
│   │   ├── Incidents.tsx      # Incident logging & multi-peer feed
│   │   ├── Tasks.tsx          # Rescue task assignment & progress tracking
│   │   ├── Inventory.tsx      # Supply inventory & reservations
│   │   ├── MapView.tsx        # Interactive Leaflet map with geo-zones
│   │   ├── Peers.tsx          # Peer Network & dynamic Add Peer modal
│   │   ├── Agents.tsx         # AI Agent execution & explainable cards
│   │   ├── SyncQueue.tsx      # Pending store-and-forward queue inspection
│   │   ├── EventLog.tsx       # Immutable audit log of all mesh sync events
│   │   ├── Conflicts.tsx      # Conflict resolution & arbitration dashboard
│   │   └── SystemTest.tsx     # Automated end-to-end 3-peer stress runner
│   ├── routes/                # TanStack Start file-based routing
│   │   ├── __root.tsx         # Document shell & preview bridge
│   │   └── index.tsx          # Main entry route
│   ├── store/
│   │   └── AppStore.ts        # Global reactive context store
│   └── styles.css             # Tailwind v4 configuration & theme variables
├── server/                    # Nitro server middleware
├── vercel.json                # Vercel deployment configuration
├── vite.config.ts             # Vite configuration with Nitro Vercel preset
└── package.json               # Dependencies and scripts
```

---

## 🛠️ Getting Started Locally

### Prerequisites
- **Node.js**: v20 or v22+
- **npm**: v10+

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/Mohithofficiall-commits/disastermesh-ai.git
   cd disastermesh-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:8080](http://localhost:8080) in your browser.

4. Run Quality Verification Gates:
   ```bash
   npm run typecheck   # TypeScript type validation
   npm run lint        # ESLint code style
   npm test            # Unit test suite (256 tests)
   npm run build       # Production bundle build
   ```

---

## 🚢 Deploying to Vercel

### Option 1: Automatic Deployment
Every commit pushed to the `main` branch of this GitHub repository is automatically deployed by Vercel to:
**[https://disastermesh-ai.vercel.app](https://disastermesh-ai.vercel.app)**

### Option 2: Manual CLI Deployment
```bash
npx vercel --prod
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
