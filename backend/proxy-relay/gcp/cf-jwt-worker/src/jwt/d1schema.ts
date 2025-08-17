import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const httpRelayJwtCache = sqliteTable(
	'http_relay_jwt_cache',
	{
		id: integer('id').primaryKey(),
		key: text('key').notNull(),
		expiresAt: text('expires_at').notNull(), // ISO string format
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [index('jwt_key_idx').on(table.key)]
);
