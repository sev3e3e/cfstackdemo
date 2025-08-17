import { WorkerEntrypoint } from 'cloudflare:workers';

import { AxiomExporter } from '@cfstackdemo/lightweight-otel-sdk';

import { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';

import { createAxiomLogger } from '@cfstackdemo/logger';
import type { SitefMainDep } from './interfaces';
import type { Env } from '../worker-configuration';
import { runMain } from './runMain';
import { unwrapRelayFetcherStub } from './lib/unwrapStubRelay';

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

	// POJO以外渡せないためDI不可 service間
	const relayFetcherStub = await env.SitefFetcher.createRelaySitefFetcher(env.ENVIRONMENT);

	const relayFetcher = unwrapRelayFetcherStub(relayFetcherStub);

	switch (env.ENVIRONMENT) {
		case 'development':
		case 'example':
			throw new Error("index.prod.ts is being executed, but the environment is set to 'development' or 'example'. ");

		default:
			return {
				exporter: new AxiomExporter(env.AXIOM_API_TOKEN, env.AXIOM_TRACE_DATASET),
				fetcher: relayFetcher,
				logger: createAxiomLogger({ dataset: env.AXIOM_LOG_DATASET, token: env.AXIOM_API_TOKEN }),
				savePriceHistory: (data, otelContext) =>
					env.MainR2Worker.savePriceHistory({ data: data.data, id: data.id, site: data.site }, otelContext, environment),
				saveToD1: (data, otelContext) =>
					env.MainD1Worker.saveAll(
						{ item: data.item, reviews: data.reviews, samples: data.samples, site: data.site },
						otelContext,
						environment
					),
			};
	}
}
