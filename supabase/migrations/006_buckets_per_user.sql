-- ============================================================
-- Fix: buckets.name was globally unique, not per-user
-- Migration: 006_buckets_per_user.sql
-- ============================================================
--
-- 001_initial_schema.sql added `buckets_name_unique UNIQUE (name)`
-- purely to satisfy `cognitive_entries.bucket REFERENCES buckets(name)`.
-- That meant a bucket name (e.g. "Entertainment") could only ever
-- belong to ONE user in the whole database. Every other user whose
-- entries got classified into a bucket name that already existed had
-- their own bucket row silently fail to insert (get_or_create_bucket
-- swallows the error) — their entries still saved fine (cognitive_entries
-- has its own user_id), but they'd never own a row in `buckets`, so
-- anything scoped by buckets.user_id (the knowledge graph, previously
-- also getBuckets()) showed 0 buckets even with real entries.
--
-- Order matters: the missing bucket rows must be backfilled BEFORE the
-- new per-user FK is added, otherwise adding the FK validates existing
-- cognitive_entries rows against a buckets table that doesn't have their
-- rows yet and the migration aborts.

-- 1. Drop the FK that required buckets.name to be globally unique.
--    Its auto-generated name may differ across environments, so find
--    it dynamically rather than hardcoding.
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'cognitive_entries'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'bucket'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE cognitive_entries DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

-- 2. Drop the global unique(name) constraint — per-user uniqueness
--    (buckets_user_name_unique) already exists and is what we want.
ALTER TABLE buckets DROP CONSTRAINT IF EXISTS buckets_name_unique;

-- 3. Backfill FIRST: create the missing bucket row for every
--    (user_id, bucket) pair that already exists in cognitive_entries but
--    never got its own buckets row because of the bug above. entry_count
--    is set from the real current count so it's not just a bare 0. This
--    has to happen before step 4 or the new FK would reject the very
--    rows we're about to make valid.
INSERT INTO buckets (user_id, name, entry_count)
SELECT
    ce.user_id,
    ce.bucket,
    COUNT(*) AS entry_count
FROM cognitive_entries ce
WHERE ce.bucket IS NOT NULL
GROUP BY ce.user_id, ce.bucket
ON CONFLICT (user_id, name) DO UPDATE
    SET entry_count = EXCLUDED.entry_count;

-- 4. Re-add referential integrity, this time scoped per user: an
--    entry's (user_id, bucket) pair must match a real (user_id, name)
--    row in buckets. NULL bucket is still allowed (FK is a no-op when
--    any referencing column is NULL). Safe now that step 3 backfilled.
ALTER TABLE cognitive_entries
    ADD CONSTRAINT cognitive_entries_user_bucket_fkey
    FOREIGN KEY (user_id, bucket) REFERENCES buckets (user_id, name);
