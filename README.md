# Context

> Personal knowledge management with AI-native interfaces and Beat Mesh visualization

Context is a personal note-taking and knowledge management system designed for AI assistants. It features a powerful **Beat Mesh** that extracts narrative beats from your notes and visualizes their connections in 3D.

## Features

### Core
- **Semantic Search** - Find notes by meaning using vector embeddings (pgvector)
- **Entity Extraction** - Automatically extract people, places, projects, concepts, and events
- **Timeline View** - See notes organized by day/week/month
- **Connection Tracing** - Follow links between related notes

### Beats 2.0
- **Beat Extraction** - AI-powered extraction of narrative beats (characters, events, themes, conflicts, etc.)
- **Beat Mesh** - 3D force-directed visualization of beat connections
- **Connection Detection** - Automatic relationship inference between beats
- **Contradiction Detection** - Find narrative inconsistencies
- **Connection Suggestions** - AI-powered suggestions for connecting beats
- **Book Import** - Import books and extract beats from chapters

### AI Integration
- **MCP Server** - Model Context Protocol for AI assistant integration
- **On-Device AI** - WebLLM Gemma 3 for privacy-first extraction
- **Cloud Fallback** - Ollama API for enhanced capabilities

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **3D Visualization**: react-three-fiber, drei
- **Database**: PostgreSQL with pgvector extension (Supabase recommended)
- **ORM**: Prisma 7
- **Embeddings**: Local (Transformers.js) or OpenAI

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ with pgvector extension (or Supabase account)
- (Optional) Ollama for cloud extraction

### Installation

```bash
# Clone the repository
git clone https://github.com/Frederickhqz/context.git
cd context

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

```env
# Database (required)
DATABASE_URL="postgresql://user:password@host:5432/context"

# Cloud extraction (optional, for enhanced AI)
OLLAMA_API_URL="http://localhost:11434"
OLLAMA_MODEL="gemma-3-1b"

# Embeddings (optional)
OPENAI_API_KEY="sk-..."
EMBEDDING_PROVIDER="local"  # or "openai"
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

```bash
# Build command
npm run build

# Output directory
.next
```

### Supabase Setup

1. Create project at supabase.com
2. Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Copy connection string to `DATABASE_URL`

## MCP Server

Context exposes an MCP server at `/api/mcp` for AI assistant integration.

### Available Tools

| Tool | Description |
|------|-------------|
| `get_context` | Retrieve relevant context from notes |
| `add_note` | Create a new note |
| `search_notes` | Semantic or keyword search |
| `get_timeline` | Get notes/beats for date range |
| `get_entities` | List entities (people, places, etc.) |
| `create_beat` | Create a narrative beat |
| `get_beats` | Retrieve beats with connections |
| `get_mesh` | Get beat mesh for visualization |
| `suggest_connections` | AI-powered connection suggestions |
| `connect_notes` | Create connection between notes |

### Example

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_beats",
    "arguments": {
      "beatType": "CHARACTER",
      "includeConnections": true
    }
  }
}
```

## API Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for full API documentation.

## Pages

| Path | Description |
|------|-------------|
| `/notes` | Note list and creation |
| `/mesh` | 3D Beat Mesh visualization |
| `/import` | Book import for beat extraction |
| `/search` | Advanced search interface |
| `/timeline` | Timeline view of notes |
| `/settings` | Application settings |

## Database Schema

Key models:

- **Note** - Notes with content, embeddings, entity mentions
- **Beat** - Extracted narrative beats with type, intensity, valence
- **BeatConnection** - Connections between beats with type/strength
- **Entity** - Extracted entities (people, places, etc.)
- **Connection** - Note-to-note connections

See `prisma/schema.prisma` for full schema.

## Development

```bash
# Run development server with Turbopack
npm run dev

# Build for production (uses webpack for three.js compatibility)
npm run build

# Run production server
npm start

# Run linting
npm run lint

# Database commands
npx prisma db push    # Push schema changes
npx prisma studio     # Open database GUI
```

## License

MIT