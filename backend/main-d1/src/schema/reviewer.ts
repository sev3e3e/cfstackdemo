import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { reviews } from './reviews';

export const reviewers = sqliteTable('reviewers', {
	id: integer('id').notNull().primaryKey(),
	reviewerId: text('reviewer_id'),
	name: text('name').notNull(),
});

export const reviewersRelations = relations(reviewers, ({ one, many }) => ({
	reviews: many(reviews),
}));
