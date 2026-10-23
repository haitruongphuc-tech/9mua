import { afterAll, beforeEach } from 'vitest';
import { resetClock } from '@/lib/clock';
import { clearOutbox } from '@/lib/mail';
import { fakePayoutClient } from '@/modules/payments/payout-client';
import { db, resetDatabase } from './helpers/db';

beforeEach(async () => {
  resetClock();
  clearOutbox();
  fakePayoutClient().reset();
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});
