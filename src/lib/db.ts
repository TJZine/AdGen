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

  // Run SQLite WAL mode and synchronous NORMAL on the connection
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
