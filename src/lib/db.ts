import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:dev.db';
  const dbPath = dbUrl.startsWith('file:') ? dbUrl.substring(5) : dbUrl;

  let db: BetterSqliteDatabase | undefined;
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  } catch (error) {
    console.error('Failed to initialize WAL mode synchronously:', error);
  } finally {
    db?.close();
  }

  // SQLite db path is dynamic based on DATABASE_URL or defaults to dev.db
  const adapter = new PrismaBetterSqlite3({
    url: dbUrl,
    timeout: 10000,
  });
  
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Background initialization as a fallback
  void client.$executeRawUnsafe('PRAGMA journal_mode = WAL;').catch((error) => {
    console.error('Failed to set journal_mode WAL:', error);
  });
  void client.$executeRawUnsafe('PRAGMA synchronous = NORMAL;').catch((error) => {
    console.error('Failed to set synchronous NORMAL:', error);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let pragmasInitialized = false;
let pragmasPromise: Promise<void> | null = null;

export async function ensurePragmas(client: PrismaClient = prisma): Promise<void> {
  if (pragmasInitialized) return;
  if (pragmasPromise) return pragmasPromise;

  pragmasPromise = (async () => {
    try {
      await client.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
      await client.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');
      pragmasInitialized = true;
    } catch (error) {
      console.error('Failed to run pragmas on DB connect:', error);
      pragmasPromise = null; // reset to allow retry
    }
  })();

  return pragmasPromise;
}

export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 5, delayMs = 100): Promise<T> {
  await ensurePragmas(prisma);
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const dbError = error as { message?: string; code?: string };
      const isLocked = 
        dbError?.message?.includes('database is locked') ||
        dbError?.message?.includes('SQLITE_BUSY') ||
        dbError?.code === 'P2002' || // unique constraint or similar database collision
        dbError?.code === 'P2034'; // transaction collision
      if (isLocked && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }

  }
}

