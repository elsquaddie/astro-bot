import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(), userId: integer('user_id').notNull(), eventKey: text('event_key').notNull(),
  payload: text('payload').notNull(), dueAt: integer('due_at').notNull(), endAt: integer('end_at').notNull(),
  status: text('status').notNull().default('pending'), attempts: integer('attempts').notNull().default(0),
  retryAt: integer('retry_at').notNull(), claimedAt: integer('claimed_at'), sentAt: integer('sent_at'),
  messageId: integer('message_id'), lastError: text('last_error'), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('reminders_user_event').on(t.userId, t.eventKey), index('reminders_due').on(t.status, t.retryAt)]);
export const serviceState = sqliteTable('service_state', { key: text('key').primaryKey(), value: integer('value').notNull() });
