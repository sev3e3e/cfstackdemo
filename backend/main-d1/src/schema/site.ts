import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { items } from "./item";

export const sites = sqliteTable("sites", {
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
});

export const sitesRelations = relations(sites, ({ many }) => ({
  items: many(items),
}));
