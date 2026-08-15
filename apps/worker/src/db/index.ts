import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export { users, sessions, authTokens, devEmails } from './schema';
export type {
  User,
  NewUser,
  Session,
  NewSession,
  AuthToken,
  NewAuthToken,
  DevEmail,
  NewDevEmail,
} from './schema';
