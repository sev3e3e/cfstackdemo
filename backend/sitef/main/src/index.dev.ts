import { WorkerEntrypoint } from 'cloudflare:workers';

import { ConsoleExporter } from '@cfstackdemo/lightweight-otel-sdk';

import { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';

import { ConsoleLogger } from '@cfstackdemo/logger';
import type { SitefMainDep } from './interfaces';
import type { Env } from '../worker-configuration';
import { runMain } from './runMain';
import { unwrapDirectFetcherStub } from './lib/unwrapStubDirect';

export default class Handler extends WorkerEntrypoint<Env> {
	async fetch() {
		return new Response('D and M');
	}

	async queue(batch: MessageBatch<DEMO_CommonSiteQueueData>): Promise<void> {
		// const item = batch.messages[0].body;
		// await this.execq(item);

		const msg = batch.messages[0].body;

		// https://github.com/cloudflare/workers-sdk/issues/8588
		const newEnv: Env = {
			...this.env,
			ENVIRONMENT: msg.env, // 上書き
		};

		const deps = await CreateDepsFromEnv(newEnv);
		await runMain(deps, msg);
	}
}

export async function CreateDepsFromEnv(env: Env): Promise<SitefMainDep> {
	const environment = env.ENVIRONMENT;

	// service locator. POJO以外渡せないためDI不可
	const directFetcherStub = await env.SitefFetcher.createDirectSitefFetcher(env.ENVIRONMENT);

	const directFetcher = unwrapDirectFetcherStub(directFetcherStub);

	switch (env.ENVIRONMENT) {
		case 'production':
			throw new Error("index.dev.ts is being executed, but the environment is set to 'production'. ");

		case 'development':
		case 'example':
		default:
			return {
				exporter: new ConsoleExporter(),
				fetcher: directFetcher,
				logger: new ConsoleLogger(),
				savePriceHistory: (data, otelContext) => {
					const { data: _data, id, site } = data;
					return env.MainR2Worker.savePriceHistory({ data: _data, id, site }, otelContext, environment);
				},
				saveToD1: (data, otelContext) => {
					const { item, reviews, samples, site } = data;
					return env.MainD1Worker.saveAll({ item, reviews, samples, site }, otelContext, environment);
				},
			};
	}
}
