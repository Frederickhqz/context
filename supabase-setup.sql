-- Context Beats Database Setup for Supabase
-- Run this in Supabase Dashboard → SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BeatType" AS ENUM ('STORY', 'SCENE', 'CHAPTER', 'CHARACTER', 'PLACE', 'OBJECT', 'CREATURE', 'THEME', 'MOTIF', 'IDEA', 'QUESTION', 'INSIGHT', 'RELATIONSHIP', 'CONFLICT', 'RESOLUTION', 'WORLD', 'DIMENSION', 'TIMELINE', 'FEELING', 'MOOD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BeatSource" AS ENUM ('AUTO', 'MANUAL', 'HYBRID', 'IMPORTED');

-- CreateEnum
CREATE TYPE "BeatConnectionType" AS ENUM ('RELATES_TO', 'PART_OF', 'CONTAINS', 'REFERENCES', 'CAUSES', 'RESULTS_FROM', 'FORESHADOWS', 'MIRRORS', 'CONTRADICTS', 'RESOLVES', 'PRECEDES', 'FOLLOWS', 'CONCURRENT', 'EVOLVES_TO', 'EVOLVES_FROM', 'REPLACES', 'ALTERNATE_OF', 'PARALLEL_TO', 'SUPPORTS', 'UNDERMINES', 'TENSIONS_WITH');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable: notes
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "content_plain" TEXT,
    "embedding" vector(768),
    "note_type" TEXT NOT NULL DEFAULT 'note',
    "analysis_status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analyzed_at" TIMESTAMP(3),
    "analysis_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: connections
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_note_id" TEXT NOT NULL,
    "to_note_id" TEXT NOT NULL,
    "connection_type" TEXT NOT NULL DEFAULT 'reference',
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: entities
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "aliases" TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: entity_mentions
CREATE TABLE "entity_mentions" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "context" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entity_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: beats_new (core beat table)
CREATE TABLE "beats_new" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "beat_type" "BeatType" NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "aliases" TEXT[],
    "embedding" vector(768),
    "metadata" JSONB,
    "intensity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "valence" DOUBLE PRECISION,
    "source" "BeatSource" NOT NULL DEFAULT 'AUTO',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "timeline_id" TEXT,
    "start_time" TEXT,
    "end_time" TEXT,
    "world_id" TEXT,
    "dimension_id" TEXT,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "beats_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable: beat_connections
CREATE TABLE "beat_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_beat_id" TEXT NOT NULL,
    "to_beat_id" TEXT NOT NULL,
    "connection_type" "BeatConnectionType" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "description" TEXT,
    "evidence" TEXT,
    "is_contradiction" BOOLEAN NOT NULL DEFAULT false,
    "contradiction_note" TEXT,
    "is_suggested" BOOLEAN NOT NULL DEFAULT false,
    "suggested_by" TEXT,
    "context_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "beat_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: note_beats
CREATE TABLE "note_beats" (
    "note_id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "mentions" INTEGER NOT NULL DEFAULT 1,
    "context" TEXT,
    CONSTRAINT "note_beats_pkey" PRIMARY KEY ("note_id","beat_id")
);

-- CreateTable: storylines
CREATE TABLE "storylines" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "storylines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worlds
CREATE TABLE "worlds" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable: dimensions
CREATE TABLE "dimensions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "divergence" TEXT,
    "differences" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: timelines
CREATE TABLE "timelines" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scale" TEXT DEFAULT 'narrative',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: scenes
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "setting" TEXT,
    "mood" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: characters
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "description" TEXT,
    "role" TEXT,
    "arc" TEXT,
    "avatar" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable: storyline_beats
CREATE TABLE "storyline_beats" (
    "storyline_id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "storyline_beats_pkey" PRIMARY KEY ("storyline_id","beat_id")
);

-- CreateTable: scene_beats
CREATE TABLE "scene_beats" (
    "scene_id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scene_beats_pkey" PRIMARY KEY ("scene_id","beat_id")
);

-- CreateTable: character_beats
CREATE TABLE "character_beats" (
    "character_id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "role" TEXT,
    CONSTRAINT "character_beats_pkey" PRIMARY KEY ("character_id","beat_id")
);

-- CreateTable: collections
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: collection_notes
CREATE TABLE "collection_notes" (
    "collection_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_notes_pkey" PRIMARY KEY ("collection_id","note_id")
);

-- CreateTable: tags
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable: note_tags
CREATE TABLE "note_tags" (
    "note_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    CONSTRAINT "note_tags_pkey" PRIMARY KEY ("note_id","tag_id")
);

-- CreateTable: imports
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "processed_chunks" INTEGER NOT NULL DEFAULT 0,
    "notes_created" INTEGER NOT NULL DEFAULT 0,
    "beats_extracted" INTEGER NOT NULL DEFAULT 0,
    "connections_found" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "connections_from_note_id_to_note_id_connection_type_key" ON "connections"("from_note_id", "to_note_id", "connection_type");
CREATE UNIQUE INDEX "entity_mentions_entity_id_note_id_key" ON "entity_mentions"("entity_id", "note_id");
CREATE INDEX "beats_new_user_id_beat_type_idx" ON "beats_new"("user_id", "beat_type");
CREATE INDEX "beats_new_user_id_name_idx" ON "beats_new"("user_id", "name");
CREATE UNIQUE INDEX "beat_connections_from_beat_id_to_beat_id_connection_type_key" ON "beat_connections"("from_beat_id", "to_beat_id", "connection_type");
CREATE UNIQUE INDEX "tags_user_id_name_key" ON "tags"("user_id", "name");

-- Foreign Keys
ALTER TABLE "connections" ADD CONSTRAINT "connections_from_note_id_fkey" FOREIGN KEY ("from_note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connections" ADD CONSTRAINT "connections_to_note_id_fkey" FOREIGN KEY ("to_note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "beats_new" ADD CONSTRAINT "beats_new_timeline_id_fkey" FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "beats_new" ADD CONSTRAINT "beats_new_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "beats_new" ADD CONSTRAINT "beats_new_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "beat_connections" ADD CONSTRAINT "beat_connections_from_beat_id_fkey" FOREIGN KEY ("from_beat_id") REFERENCES "beats_new"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "beat_connections" ADD CONSTRAINT "beat_connections_to_beat_id_fkey" FOREIGN KEY ("to_beat_id") REFERENCES "beats_new"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_beats" ADD CONSTRAINT "note_beats_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_beats" ADD CONSTRAINT "note_beats_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats_new"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "storylines" ADD CONSTRAINT "storylines_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "storylines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dimensions" ADD CONSTRAINT "dimensions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "storyline_beats" ADD CONSTRAINT "storyline_beats_storyline_id_fkey" FOREIGN KEY ("storyline_id") REFERENCES "storylines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "storyline_beats" ADD CONSTRAINT "storyline_beats_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats_new"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_beats" ADD CONSTRAINT "scene_beats_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_beats" ADD CONSTRAINT "scene_beats_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats_new"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_beats" ADD CONSTRAINT "character_beats_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_beats" ADD CONSTRAINT "character_beats_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats_new"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_notes" ADD CONSTRAINT "collection_notes_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_notes" ADD CONSTRAINT "collection_notes_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vector similarity search function (optional, for semantic search)
CREATE OR REPLACE FUNCTION match_beats(query_embedding vector(768), match_threshold float, match_count int)
RETURNS TABLE (id text, name text, summary text, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    beats_new.id,
    beats_new.name,
    beats_new.summary,
    1 - (beats_new.embedding <=> query_embedding) as similarity
  FROM beats_new
  WHERE 1 - (beats_new.embedding <=> query_embedding) > match_threshold
  ORDER BY beats_new.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Similar function for notes
CREATE OR REPLACE FUNCTION match_notes(query_embedding vector(768), match_threshold float, match_count int)
RETURNS TABLE (id text, title text, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    notes.id,
    notes.title,
    1 - (notes.embedding <=> query_embedding) as similarity
  FROM notes
  WHERE 1 - (notes.embedding <=> query_embedding) > match_threshold
  ORDER BY notes.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;