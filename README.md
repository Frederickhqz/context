# Context

> Personal knowledge management with AI-native interfaces and Beat Mesh visualization

Context is a personal note-taking and knowledge management system designed for AI assistants. It features a powerful **Beat Mesh** that extracts narrative beats from your notes and visualizes their connections in a 3D hierarchical "Universe."

## Features

### Core
- **Semantic Search** - Find notes by meaning using vector embeddings (pgvector).
- **Entity Extraction** - Automatically extract people, places, projects, and events.
- **Timeline View** - See notes and beats organized by chronologies.
- **Connection Tracing** - Follow causal and thematic links across your knowledge base.

### Beats & Mesh (2.0)
- **Beat Extraction** - AI-powered dissection of notes into atomic units (Characters, Conflicts, Themes).
- **3D Universe** - A hierarchical solar system visualization with Suns (Concepts), Planets, and Moons.
- **Narrative Intelligence** - Automated detection of logical contradictions and paradoxes.
- **Smart Book Processing** - Auto-chunking engine to handle massive texts and book imports.

### 2026 AI Integration
- **Shared Native AI Bridge** - Standardized spec for iOS (Apple Intelligence) and Android (AICore).
- **On-Device AI** - WebLLM (Browser) and Foundation Models (Native) for maximum privacy.
- **MCP Server** - Model Context Protocol for full AI assistant orchestration.

## 📚 Documentation Index

### Core Concepts
- [Product Philosophy & Hierarchy](docs/PRODUCT_CONCEPTS.md) - Understanding Beats and the Mesh.
- [Brand Identity](BRAND.md) - Design language and vision.

### Engineering & AI
- [Shared Native AI Bridge](docs/SHARED_NATIVE_AI_BRIDGE.md) - Implementation rules for cross-platform AI.
- [Mobile Strategy](docs/NATIVE_MOBILE_STRATEGY.md) - Roadmap for iOS/Android native integration.
- [API Reference](API_REFERENCE.md) - Backend endpoint documentation.

### Setup & Infrastructure
- [Database Setup](DATABASE_SETUP.md) - Supabase and pgvector configuration.
- [Deployment](DEPLOYMENT.md) - Vercel and CI/CD.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS.
- **3D Engine**: react-three-fiber (R3F), Three.js.
- **Database**: PostgreSQL with pgvector (Supabase).
- **ORM**: Prisma 7.
- **Embeddings**: Nomic Embed Text v1.5 (Locked Spec).

## Quick Start

### Installation

```bash
# Clone and Install
git clone https://github.com/Frederickhqz/context.git
cd context
npm install

# Push Database Schema
npx prisma db push

# Start Development
npm run dev
```

## MCP Server

Context exposes an MCP server at `/api/mcp` for AI assistant integration.

### Available Tools
| Tool | Description |
|------|-------------|
| `get_context` | Retrieve relevant semantic context from notes |
| `add_note` | Create a new note with auto-extraction |
| `search_notes` | Semantic or keyword search |
| `get_mesh` | Get beat mesh for 3D visualization |
| `suggest_connections` | AI-powered relationship recommendations |

## License
Apache-2.0
