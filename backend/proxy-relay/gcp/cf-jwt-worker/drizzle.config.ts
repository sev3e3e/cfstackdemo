import type { Config } from 'drizzle-kit';

const cloudflareConfig = {
	dialect: 'sqlite',
	schema: './src/jwt/d1schema.ts',
	out: './drizzle',
} satisfies Config;

export default cloudflareConfig;
