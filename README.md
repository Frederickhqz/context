# Context

> A note-taking app with an agent sublayer and native MCP integration

## Overview

Context is a modern note-taking application that enables AI agents to query and understand your notes through the Model Context Protocol (MCP). It combines:

- **Apple Notes simplicity** - Clean, intuitive interface
- **Obsidian linking** - `[[wiki-link]]` connections between notes
- **Plane beats** - Time-bound notes for tracking events and feelings
- **Semantic search** - Find notes by meaning, not just keywords
- **MCP Server** - Native integration for AI agents to access your notes

## Features

### Note Taking
- **Markdown support** - Write with rich formatting
- **Note types** - Regular notes, journal entries, and beats
- **Tags & Collections** - Organize your notes
- **Entity extraction** - People, places, projects, concepts

### Search & Discovery
- **Semantic search** - Find notes by meaning using embeddings
- **Connection tracing** - See how notes relate to each other
- **Timeline view** - Visualize notes over time

### Agent Integration (MCP)
- **6 MCP tools** for agent access:
  - `get_context` - Retrieve relevant context
  - `add_note` - Create new notes
  - `search_notes` - Search your notes
  - `get_timeline` - Get timeline data
  - `trace_connection` - Explore connections
  - `get_entities` - Get entities

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL + pgvector (Supabase) |
| ORM | Prisma |
| Auth | Supabase Auth |
| UI | Tailwind CSS + shadcn/ui |
| Timeline | React-Chrono + vis-timeline |
| Embeddings | EmbeddingGemma (local) or OpenAI |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension (or Supabase account)
- (Optional) OpenAI API key for cloud embeddings

### Installation

```bash
# Clone the repository
git clone https://github.com/Frederickhqz/context.git
cd context

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Configure your database
# Edit .env with your DATABASE_URL and Supabase credentials

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Configuration

1. **Database**: Set `DATABASE_URL` for PostgreSQL with pgvector
2. **Supabase**: Add your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Embeddings**: Choose between local (default) or OpenAI:
   - Local: `EMBEDDING_PROVIDER=local` (no API key needed)
   - OpenAI: `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY`

## Development

```bash
# Start development server
npm run dev

# Run database migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio

# Run tests
npm run test
```

## Project Structure

```
context/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Main app routes
│   │   ├── api/                # API routes
│   │   │   ├── notes/          # Notes CRUD
│   │   │   ├── mcp/            # MCP Server
│   │   │   ├── search/         # Search API
│   │   │   └── embeddings/     # Embedding generation
│   │   └── layout.tsx
│   ├── components/
│   │   ├── notes/              # Note components
│   │   ├── timeline/           # Timeline components
│   │   ├── entities/           # Entity components
│   │   ├── search/             # Search components
│   │   └── layout/             # Layout components
│   ├── lib/
│   │   ├── db/                 # Database client
│   │   ├── embeddings/         # Embedding providers
│   │   └── mcp/                # MCP tools
│   ├── hooks/                  # React hooks
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript types
├── prisma/
│   └── schema.prisma           # Database schema
└── public/
```

## API Reference

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notes` | GET | List notes |
| `/api/notes` | POST | Create note |
| `/api/notes/:id` | GET | Get note |
| `/api/notes/:id` | PUT | Update note |
| `/api/notes/:id` | DELETE | Delete note |
| `/api/search` | GET | Search notes |
| `/api/entities` | GET | List entities |

### MCP Server

| Tool | Description |
|------|-------------|
| `get_context` | Retrieve context from notes |
| `add_note` | Create new note |
| `search_notes` | Semantic/keyword search |
| `get_timeline` | Get timeline data |
| `trace_connection` | Trace note connections |
| `get_entities` | Get entities |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Self-Hosted

```bash
# Build
npm run build

# Start production server
npm run start
```

## Contributing

Contributions are welcome! Please read our contributing guide.

## License

MIT

---

Built with ❤️ for the AI agent ecosystem