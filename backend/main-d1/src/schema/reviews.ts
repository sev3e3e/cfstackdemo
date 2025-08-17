import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { reviewers } from './reviewer';
import { sites } from './site';
import { items } from './item';

export const reviews = sqliteTable('reviews', {
	id: integer('id').notNull().primaryKey(),
	itemId: integer('item_id')
		.notNull()
		.references(() => items.id),
	siteId: integer('site_id')
		.notNull()
		.references(() => sites.id),
	reviewId: text('review_id').notNull(),

	reviewerId: integer('reviewer_id').references(() => reviewers.id),

	title: text('title'),
	body: text('body'),
	rating: integer('rating'),

	createdAt: text('created_at'),
});

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
	reviewer: one(reviewers, {
		fields: [reviews.reviewerId],
		references: [reviewers.id],
	}),
	item: one(items, {
		fields: [reviews.itemId],
		references: [items.id],
	}),
}));
