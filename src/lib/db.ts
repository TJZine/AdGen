import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  try {
    const db = new Database('dev.db');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.close();
  } catch (error) {
    console.error('Failed to initialize WAL mode synchronously:', error);
  }

  // SQLite dev.db is created at the project root based on prisma.config.ts
  const adapter = new PrismaBetterSqlite3({
    url: 'file:dev.db',
  });
  
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
