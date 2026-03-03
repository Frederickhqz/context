#!/bin/bash
# Development start script

set -e

echo "🚀 Starting Context development server..."

# Check for .env.local
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local not found. Creating from template..."
  cp .env.example .env.local
  echo "📝 Please edit .env.local with your configuration"
fi

# Check if database is running
if command -v docker >/dev/null 2>&1; then
  if ! docker-compose ps db | grep -q "Up"; then
    echo "🐳 Starting database..."
    docker-compose up -d db
    sleep 3
  fi
fi

# Ensure Prisma client is generated
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "🔧 Generating Prisma client..."
  npx prisma generate
fi

# Start development server
echo "⚡ Starting Next.js development server..."
npm run dev