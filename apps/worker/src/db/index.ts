import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export {
  users,
  sessions,
  authTokens,
  devEmails,
  customers,
  subscriptions,
  stripeEvents,
} from './schema';
export type {
  User,
  NewUser,
  Session,
  NewSession,
  AuthToken,
  NewAuthToken,
  DevEmail,
  NewDevEmail,
  Customer,
  NewCustomer,
  Subscription,
  NewSubscription,
  StripeEvent,
  NewStripeEvent,
} from './schema';
