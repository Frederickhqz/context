import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// Database health check
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      debug: {
        vercel: process.env.VERCEL,
        dbSslNoVerify: process.env.DB_SSL_NO_VERIFY,
        nodeEnv: process.env.NODE_ENV,
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown database error',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      debug: {
        vercel: process.env.VERCEL,
        dbSslNoVerify: process.env.DB_SSL_NO_VERIFY,
        nodeEnv: process.env.NODE_ENV,
      }
    }, { status: 503 });
  }
}