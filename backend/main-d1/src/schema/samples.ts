import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { items } from "./item";

export const samples = sqliteTable("samples", {
  itemId: integer("item_id").references(() => items.id),
  url: text("url").notNull(),
});

export const samplesRelations = relations(samples, ({ one, many }) => ({
  item: one(items, {
    fields: [samples.itemId],
    references: [items.id],
  }),
}));
