#!/bin/bash
# Setup script for Context

set -e

echo "🚀 Setting up Context..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }
command -b docker >/dev/null 2>&1 || { echo "⚠️  Docker not found. Will use local database."; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if not exists
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local from template..."
  cp .env.example .env.local
  echo "⚠️  Please edit .env.local with your configuration"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Check for database
if command -v docker >/dev/null 2>&1; then
  echo "🐳 Starting database with Docker..."
  docker-compose up -d db
  
  echo "⏳ Waiting for database to be ready..."
  sleep 5
  
  # Run migrations
  echo "📊 Running database migrations..."
  npx prisma db push
else
  echo "⚠️  Docker not available. Please ensure DATABASE_URL in .env.local points to a running PostgreSQL instance."
  echo "   Then run: npx prisma db push"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your configuration"
echo "  2. Run 'npm run dev' to start development server"
echo "  3. Open http://localhost:3000 in your browser"
echo ""