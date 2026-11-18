import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AppMode } from '../shared/types.ts';
import { runMigrations } from './migrations.ts';
import { seedDemoDatabase, seedProductionBaseline } from './seedDemo.ts';

// Vercel (and most serverless platforms) only allow writes under /tmp.
// The demo database is therefore ephemeral there: it is re-seeded on cold start.
const DATA_DIR = process.env.MASCOTAS_DATA_DIR
  ? path.resolve(process.env.MASCOTAS_DATA_DIR)
  : process.env.VERCEL
    ? path.join('/tmp', 'mascotasycia')
    : path.resolve(process.cwd(), 'data');

let demoDb: DatabaseSync | null = null;
let prodDb: DatabaseSync | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function createMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  return db;
}

export function getDb(mode: AppMode = 'demo'): DatabaseSync {
  ensureDataDir();
  if (mode === 'demo') {
    if (!demoDb) {
      const dbPath = path.join(DATA_DIR, 'mascotasycia_demo.sqlite');
      demoDb = new DatabaseSync(dbPath);
      runMigrations(demoDb);
      const count = (demoDb.prepare('SELECT COUNT(*) as c FROM stores').get() as { c: number }).c;
      if (count === 0) {
        seedDemoDatabase(demoDb);
      }
    }
    return demoDb;
  }

  if (!prodDb) {
    const dbPath = path.join(DATA_DIR, 'mascotasycia_prod.sqlite');
    prodDb = new DatabaseSync(dbPath);
    runMigrations(prodDb);
    const count = (prodDb.prepare('SELECT COUNT(*) as c FROM stores').get() as { c: number }).c;
    if (count === 0) {
      seedProductionBaseline(prodDb);
    }
  }
  return prodDb;
}

export function resetDemoDatabase(): DatabaseSync {
  ensureDataDir();
  if (demoDb) {
    try {
      demoDb.close();
    } catch {
      // ignore close errors
    }
    demoDb = null;
  }
  const dbPath = path.join(DATA_DIR, 'mascotasycia_demo.sqlite');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  return getDb('demo');
}
