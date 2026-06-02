import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // SQLite dev.db is created at the project root based on prisma.config.ts
  const adapter = new PrismaBetterSqlite3({
    url: 'file:dev.db',
  });
  
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Optimize SQLite for concurrent environments
  client.$executeRawUnsafe('PRAGMA journal_mode = WAL;').catch(console.error);
  client.$executeRawUnsafe('PRAGMA synchronous = NORMAL;').catch(console.error);

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
