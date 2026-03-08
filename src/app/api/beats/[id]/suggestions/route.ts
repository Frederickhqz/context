import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/server';
import { getPotentialConnections } from '@/lib/intelligence/suggester';

// GET /api/beats/[id]/suggestions - Get AI suggestions for connecting this beat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;

    const suggestions = await getPotentialConnections(id);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
