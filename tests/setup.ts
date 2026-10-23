import { afterAll, beforeEach } from 'vitest';
import { resetClock } from '@/lib/clock';
import { clearOutbox } from '@/lib/mail';
import { db, resetDatabase } from './helpers/db';

beforeEach(async () => {
  resetClock();
  clearOutbox();
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});
