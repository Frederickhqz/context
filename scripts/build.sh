#!/bin/bash
# Build for production

set -e

echo "🏗️  Building Context for production..."

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Build Next.js
echo "📦 Building Next.js..."
npm run build

echo "✅ Build complete!"
echo ""
echo "To start the production server:"
echo "  npm run start"
echo ""
echo "Or with Docker:"
echo "  docker-compose up -d"