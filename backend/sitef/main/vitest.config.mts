import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';
import { resolve } from 'node:path';

export default defineWorkersProject({
	test: {
		globalSetup: ['./test/global-setup.ts'],
		poolOptions: {
			workers: {
				singleWorker: true,
				wrangler: {
					configPath: './wrangler.dev.jsonc',
				},

				miniflare: {
					workers: [
						{
							name: 'cfstackdemo-main-r2',
							modules: true,
							modulesRoot: resolve('../../main-r2'),
							rootPath: resolve('../../main-r2'),
							scriptPath: 'dist/index.js',
							compatibilityDate: '2025-07-11',
							compatibilityFlags: ['nodejs_compat'],
						},
						{
							name: 'cfstackdemo-main-d1',
							modules: true,
							modulesRoot: resolve('../../main-d1'),
							rootPath: resolve('../../main-d1'),
							scriptPath: 'dist/index.js',
							compatibilityDate: '2025-07-11',
							compatibilityFlags: ['nodejs_compat'],
						},
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
