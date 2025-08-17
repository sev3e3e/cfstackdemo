import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';
import { resolve } from 'node:path';

export default defineWorkersProject({
	test: {
		globalSetup: ['./test/setup.ts'],
		poolOptions: {
			workers: {
				singleWorker: true,
				wrangler: {
					configPath: './wrangler.dev.jsonc',
				},

				miniflare: {
					workers: [
						{
							name: 'cfstackdemo-sitef-fetcher',
							modules: true,
							modulesRoot: resolve('../fetcher'),
							rootPath: resolve('../fetcher'),
							scriptPath: 'dist/index.js',
							compatibilityDate: '2025-07-11',
							compatibilityFlags: ['nodejs_compat'],
						},
					],
				},
			},
		},
	},
});
