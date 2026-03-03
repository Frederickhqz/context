# Deploying Context

## Prerequisites

- Docker and Docker Compose (recommended)
- Or: Node.js 18+, PostgreSQL 15+ with pgvector extension

## Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/Frederickhqz/context.git
cd context

# Start all services
docker-compose up -d

# The app will be available at http://localhost:3000
```

## Manual Deployment

### 1. Set up PostgreSQL with pgvector

```bash
# Using Docker for PostgreSQL
docker run -d \
  --name context-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=context \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your settings
# Required:
# - DATABASE_URL=postgresql://user:password@host:5432/context
# Optional:
# - EMBEDDING_PROVIDER=local (default) or openai
# - OPENAI_API_KEY (if using OpenAI embeddings)
```

### 3. Install and Build

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Build for production
npm run build

# Start production server
npm start
```

## Deployment Options

### Vercel

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

Note: For pgvector, use a managed PostgreSQL with the extension (Supabase, Neon, Railway).

### Self-Hosted (VPS)

```bash
# Build Docker image
docker build -t context-app .

# Run with external database
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=your_database_url \
  -e EMBEDDING_PROVIDER=local \
  context-app
```

### Docker Compose (Full Stack)

```bash
# Start all services (app + database)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string with pgvector |
| `EMBEDDING_PROVIDER` | No | `local` | `local` (Transformers.js) or `openai` |
| `OPENAI_API_KEY` | Conditional | - | Required if EMBEDDING_PROVIDER=openai |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public URL for the app |

## Database Migrations

```bash
# Push schema (development)
npm run db:push

# Create migration (production)
npx prisma migrate dev --name your_migration_name

# Apply migrations
npx prisma migrate deploy
```

## Health Checks

The application provides health check endpoints:

- `GET /api/health` - Basic health check
- `GET /api/health/db` - Database connectivity check

## Monitoring

For production deployments, consider adding:

1. **Logging**: Configure Winston or Pino for structured logging
2. **Error Tracking**: Integrate Sentry for error monitoring
3. **Metrics**: Use Prometheus/Grafana for application metrics
4. **Uptime**: Set up health check monitoring (UptimeRobot, Pingdom)

## Scaling Considerations

- **Database**: Use connection pooling (PgBouncer) for high traffic
- **Embeddings**: Consider caching embeddings in Redis for frequently searched queries
- **MCP**: For high-volume AI assistant usage, consider rate limiting and queuing