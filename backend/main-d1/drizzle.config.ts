import type { Config } from "drizzle-kit";

const cloudflareConfig = {
  dialect: "sqlite",
  schema: "./src/schema/**/*.ts",
  out: "./drizzle",
} satisfies Config;

export default cloudflareConfig;
