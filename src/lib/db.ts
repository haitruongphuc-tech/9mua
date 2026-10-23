import { PrismaClient } from '@prisma/client';

// Giữ một client duy nhất khi Next.js dev hot-reload.
const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db = globalForDb.db ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
