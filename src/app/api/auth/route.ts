// Auth API - Login, Signup, Logout, Delete Account
import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/auth/supabase';
import { prisma } from '@/lib/db/client';

// POST /api/auth/signup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, name } = body;

    if (action === 'signup') {
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }

      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || email.split('@')[0] }
        }
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        user: data.user,
        session: data.session,
        message: 'Check your email to confirm your account'
      });
    }

    if (action === 'login') {
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json({
        user: data.user,
        session: data.session
      });
    }

    if (action === 'logout') {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (token) {
        const serverClient = createServerClient();
        await serverClient.auth.admin.signOut(token);
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ message: 'Logged out successfully' });
    }

    if (action === 'delete-account') {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');
      const { confirmation } = body;

      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify user
      const serverClient = createServerClient();
      const { data: { user }, error: verifyError } = await serverClient.auth.getUser(token);

      if (verifyError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Require confirmation text
      if (confirmation !== 'DELETE MY ACCOUNT') {
        return NextResponse.json({ 
          error: 'Please type "DELETE MY ACCOUNT" to confirm' 
        }, { status: 400 });
      }

      const userId = user.id;

      // Delete all user data (cascade)
      // Note: In production, use a transaction or background job
      try {
        // Delete beats and connections
        const userBeats = await prisma.beat.findMany({ 
          where: { userId },
          select: { id: true }
        });
        const beatIds = userBeats.map(b => b.id);

        if (beatIds.length > 0) {
          await prisma.beatConnection.deleteMany({
            where: {
              OR: [
                { fromBeatId: { in: beatIds } },
                { toBeatId: { in: beatIds } }
              ]
            }
          });
          await prisma.noteBeat.deleteMany({
            where: { beatId: { in: beatIds } }
          });
          await prisma.beat.deleteMany({ where: { userId } });
        }

        // Delete notes and their relations
        const userNotes = await prisma.note.findMany({
          where: { userId },
          select: { id: true }
        });
        const noteIds = userNotes.map(n => n.id);

        if (noteIds.length > 0) {
          await prisma.noteBeat.deleteMany({
            where: { noteId: { in: noteIds } }
          });
          await prisma.noteTag.deleteMany({
            where: { noteId: { in: noteIds } }
          });
          await prisma.collectionNote.deleteMany({
            where: { noteId: { in: noteIds } }
          });
          await prisma.entityMention.deleteMany({
            where: { noteId: { in: noteIds } }
          });
          await prisma.connection.deleteMany({
            where: {
              OR: [
                { fromNoteId: { in: noteIds } },
                { toNoteId: { in: noteIds } }
              ]
            }
          });
          await prisma.note.deleteMany({ where: { userId } });
        }

        // Delete collections
        const userCollections = await prisma.collection.findMany({
          where: { userId },
          select: { id: true }
        });
        const collectionIds = userCollections.map(c => c.id);

        if (collectionIds.length > 0) {
          await prisma.collectionNote.deleteMany({
            where: { collectionId: { in: collectionIds } }
          });
          await prisma.collection.deleteMany({ where: { userId } });
        }

        // Delete tags
        await prisma.noteTag.deleteMany({
          where: { tag: { userId } }
        });
        await prisma.tag.deleteMany({ where: { userId } });

        // Delete entities
        await prisma.entityMention.deleteMany({
          where: { entity: { userId } }
        });
        await prisma.entity.deleteMany({ where: { userId } });

        // Delete imports
        await prisma.import.deleteMany({ where: { userId } });

        // Delete worlds, timelines, dimensions
        await prisma.dimension.deleteMany({ where: { world: { userId } } });
        await prisma.timeline.deleteMany({ where: { world: { userId } } });
        await prisma.world.deleteMany({ where: { userId } });

        // Delete auth user
        const { error: deleteError } = await serverClient.auth.admin.deleteUser(userId);
        if (deleteError) {
          console.error('Error deleting auth user:', deleteError);
          return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
        }

        return NextResponse.json({ 
          message: 'Account and all data deleted permanently' 
        });
      } catch (dbError) {
        console.error('Database error during deletion:', dbError);
        return NextResponse.json({ error: 'Failed to delete account data' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/auth/me - Get current user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const serverClient = createServerClient();
    const { data: { user }, error } = await serverClient.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}