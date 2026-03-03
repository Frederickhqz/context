import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// GET /api/entities - List entities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // person, place, project, concept, event
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // TODO: Add authentication
    // const user = await getCurrentUser();

    const where: any = {};
    
    if (type) {
      where.entityType = type;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { aliases: { has: search } },
      ];
    }

    const entities = await prisma.entity.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { mentions: true },
        },
      },
    });

    // Transform to include mention count
    const result = entities.map(entity => ({
      ...entity,
      mentionCount: entity._count.mentions,
    }));

    return NextResponse.json({ entities: result });
  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

// POST /api/entities - Create entity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, entityType, aliases = [], metadata } = body;

    // TODO: Add authentication

    if (!name || !entityType) {
      return NextResponse.json(
        { error: 'Name and entityType are required' },
        { status: 400 }
      );
    }

    // Check if entity already exists
    const existing = await prisma.entity.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        entityType,
      },
    });

    if (existing) {
      return NextResponse.json({ entity: existing, created: false });
    }

    const entity = await prisma.entity.create({
      data: {
        userId: 'demo-user', // TODO: Replace with actual user ID
        name,
        entityType,
        aliases,
        metadata,
      },
    });

    return NextResponse.json({ entity, created: true }, { status: 201 });
  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}