// Prisma client for Next.js with Prisma 7
// Uses PostgreSQL adapter

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Vercel serverless + Supabase: prefer the PgBouncer pooler connection.
// DIRECT_URL is optional and not used in production.
const connectionString = process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL (pooler connection string)');
  }

  // Supabase pooler uses TLS; in some serverless runtimes (notably Vercel)
  // the certificate chain can fail validation ("self-signed certificate in certificate chain").
  // Default to relaxed verification on Vercel; can be controlled via DB_SSL_NO_VERIFY.
  const sslNoVerify =
    process.env.DB_SSL_NO_VERIFY === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true';

  const pool = new Pool({
    connectionString,
    ssl: sslNoVerify ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;