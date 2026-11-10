import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
export async function createLocalDatabase(beforeMigration = async () => {}) {
 const db = new PGlite();
 try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage; create schema cron;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
          nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
      $$;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key, bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
      create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
    `);
    const migrations = new URL("../../supabase/migrations/", import.meta.url);
    // Application migrations execute as written, except the platform cron extension.
    for (const file of (await readdir(migrations)).sort()) {
      await beforeMigration(file, db);
      const sql = (await readFile(new URL(file, migrations), "utf8"))
        .replace("create extension if not exists pg_cron with schema pg_catalog;", "");
      try { await db.exec(sql); } catch (cause) { throw new Error(`Migration failed: ${file}`, { cause }); }
    }
 return db;
 } catch (error) { await db.close(); throw error; }
}
