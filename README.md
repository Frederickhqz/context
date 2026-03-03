# Context

> Personal knowledge management with AI-native interfaces

Context is a personal note-taking and knowledge management system designed for AI assistants. It exposes a Model Context Protocol (MCP) server that allows AI agents to retrieve context, create notes, search, and trace connections.

## Features

- **Semantic Search** - Find notes by meaning using vector embeddings
- **Entity Extraction** - Automatically extract people, places, projects, concepts, and events
- **Timeline View** - See notes organized by day/week/month
- **Connection Tracing** - Follow links between related notes
- **Beats** - Track events, milestones, feelings, and insights
- **MCP Server** - AI-native interface for context retrieval

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Prisma 7
- **Embeddings**: Local (Transformers.js) or OpenAI

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- (Optional) OpenAI API key for cloud embeddings

### Installation

```bash
# Clone the repository
git clone https://github.com/Frederickhqz/context.git
cd context

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URL and API keys

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/context"
EMBEDDING_PROVIDER="local"  # or "openai"
OPENAI_API_KEY="sk-..."     # if using OpenAI embeddings
```

## MCP Server

Context exposes an MCP server at `/api/mcp` that provides tools for AI assistants:

### Available Tools

| Tool | Description |
|------|-------------|
| `get_context` | Retrieve relevant context from notes based on a query |
| `add_note` | Create a new note with optional entity linking |
| `search_notes` | Search notes using semantic or keyword search |
| `get_timeline` | Get notes and beats for a date range |
| `trace_connection` | Find paths between connected notes |
| `get_entities` | List entities (people, places, projects, etc.) |
| `create_beat` | Create a beat (event/milestone/feeling/insight) |
| `connect_notes` | Create a connection between two notes |

### Example Usage

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_context",
    "arguments": {
      "query": "project meeting last week",
      "maxResults": 5
    }
  }
}
```

## API Endpoints

### Notes

- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note
- `PATCH /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### Search

- `GET /api/search?q=query&type=semantic` - Search notes

### Entities

- `GET /api/entities` - List entities
- `POST /api/entities` - Create entity

### Connections

- `GET /api/connections` - List connections
- `POST /api/connections` - Create connection

### Timeline

- `GET /api/timeline?start=date&end=date` - Get timeline

### Beats

- `GET /api/beats` - List beats
- `POST /api/beats` - Create beat

## Pages

| Path | Description |
|------|-------------|
| `/notes` | Note list and creation |
| `/timeline` | Timeline view of notes |
| `/visualize` | Calendar, Graph, and Tree views |
| `/entities` | Entity browser |
| `/collections` | Collection manager |
| `/search` | Advanced search interface |

## Database Schema

```prisma
model Note {
  id          String   @id @default(cuid())
  userId      String
  title       String?
  content     String   @db.Text
  contentPlain String? @db.Text
  noteType    String   @default("note")
  embedding   String?  @db.Text  // JSON vector
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  entityMentions    EntityMention[]
  collections       NoteCollection[]
  outgoingConnections Connection[] @relation("FromNote")
  incomingConnections Connection[] @relation("ToNote")
  beats             Beat[]
}

model Entity {
  id          String   @id @default(cuid())
  userId      String
  name        String
  entityType  String   // person, place, project, concept, event
  aliases     String[]
  metadata    Json?
  createdAt   DateTime @default(now())
  
  mentions    EntityMention[]
}

model Connection {
  id             String   @id @default(cuid())
  userId         String
  fromNoteId     String
  toNoteId       String
  connectionType String   @default("reference")
  strength       Float    @default(1.0)
  createdAt      DateTime @default(now())
  
  fromNote       Note     @relation("FromNote", fields: [fromNoteId], references: [id])
  toNote         Note     @relation("ToNote", fields: [toNoteId], references: [id])
}
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run linting
npm run lint
```

## License

MIT