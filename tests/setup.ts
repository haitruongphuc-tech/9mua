import { afterAll, beforeEach } from 'vitest';
import { resetClock } from '@/lib/clock';
import { db, resetDatabase } from './helpers/db';

beforeEach(async () => {
  resetClock();
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});
