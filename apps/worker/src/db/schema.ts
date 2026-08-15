import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// `id` stores a hash of the opaque session token, never the raw token — the
// same principle as password_hash: the DB is a leak surface, so it never
// holds a value an attacker could replay as-is.
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// Single-use, expiring, hashed tokens backing both email verification and
// password reset links — same hash-at-rest principle as `sessions.id`.
export const authTokens = sqliteTable('auth_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['verify', 'reset'] }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type AuthToken = typeof authTokens.$inferSelect;
export type NewAuthToken = typeof authTokens.$inferInsert;

// Dev-mode email outbox: `DevMailboxSender` writes here instead of calling a
// real provider, so the full verify/reset flow runs with zero credentials.
export const devEmails = sqliteTable('dev_emails', {
  id: text('id').primaryKey(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type DevEmail = typeof devEmails.$inferSelect;
export type NewDevEmail = typeof devEmails.$inferInsert;
