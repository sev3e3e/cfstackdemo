import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { sites } from './site';
import { reviews } from './reviews';
import { samples } from './samples';

export const items = sqliteTable(
	'items',
	{
		id: integer('id').notNull().primaryKey(),
		siteId: integer('site_id')
			.notNull()
			.references(() => sites.id),

		/** site特有のID サイトごとに割り振られている個別ID */
		siteSpecificId: text('site_specific_id').notNull(),

		url: text('url').notNull(),
		title: text('title').notNull(),
		description: text('description').notNull(),
		thumbUrl: text('thumb_url'),

		// cache review columns
		avgRating: integer('avg_rating'),
		reviewCount: integer('review_count'),
	},
	(table) => [unique().on(table.siteId, table.siteSpecificId)]
);

export const itemsRelations = relations(items, ({ one, many }) => ({
	samples: many(samples),
	reviews: many(reviews),
}));
