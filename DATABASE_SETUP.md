# Context Beats - Database Setup Guide

## Prerequisites

- PostgreSQL 14+ with pgvector extension
- Node.js 18+

## Option 1: Supabase (Recommended for Production)

1. Create a Supabase project at https://supabase.com
2. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Get connection string from Project Settings > Database
4. Set environment variable:
   ```bash
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

## Option 2: Neon (Serverless PostgreSQL)

1. Create a Neon project at https://neon.tech
2. Enable pgvector:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Get connection string from Dashboard
4. Set environment variable:
   ```bash
   DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require"
   ```

## Option 3: Vercel Postgres

1. Create Vercel Postgres database in Vercel dashboard
2. Enable pgvector (if available)
3. Environment variables auto-configured

## Option 4: Local PostgreSQL (Development)

1. Install PostgreSQL with pgvector:
   ```bash
   # macOS
   brew install postgresql@14 pgvector

   # Ubuntu/Debian
   sudo apt install postgresql-14 postgresql-14-pgvector

   # Docker
   docker run -d --name postgres-pgvector \
     -e POSTGRES_PASSWORD=password \
     -p 5432:5432 \
     pgvector/pgvector:pg14
   ```

2. Create database:
   ```bash
   createdb context
   psql -d context -c "CREATE EXTENSION vector;"
   ```

3. Set environment variable:
   ```bash
   DATABASE_URL="postgresql://postgres:password@localhost:5432/context"
   ```

## Apply Schema

Once database is configured:

```bash
cd context
npx prisma db push
npx prisma generate
```

## Verify Setup

```bash
npx prisma studio
# Check that beats_new, beat_connections, etc. tables exist
```

## Environment Variables

Required in `.env`:

```env
DATABASE_URL="postgresql://..."
OLLAMA_URL="http://ollama-ivie-ollama-1:11434"
OLLAMA_MODEL="qwen3.5:397b-cloud"
```

Optional:

```env
OLLAMA_EMBED_MODEL="qwen3-embedding:4b"
```

## Troubleshooting

### "Can't reach database server"
- Check DATABASE_URL format
- Verify database is running
- Check network connectivity

### "Extension vector does not exist"
- Install pgvector extension in PostgreSQL
- Run: `CREATE EXTENSION vector;`

### "Permission denied"
- Grant user permissions:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE context TO your_user;
  ```