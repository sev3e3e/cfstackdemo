import { AxiomExporter, ConsoleExporter } from '@cfstackdemo/lightweight-otel-sdk';

import type { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';
import type { Env } from '../worker-configuration';
import { ConsoleLogger, createAxiomLogger } from '@cfstackdemo/logger';
import type { SitefEntrypointDep } from './interfaces';
import { runEntrypoint } from './runEntrypoint';
import { RelaySitefFetcher } from '@cfstackdemo/sitef-fetcher';
import { unwrapRelayFetcherStub } from './lib/unwrapStubRelay';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const deps = await CreateDepsFromEnv(env);

		await runEntrypoint(deps);
		return new Response('Hello World!');
	},
	async scheduled(controller, env, ctx) {
		const deps = await CreateDepsFromEnv(env);

		await runEntrypoint(deps);
	},
} satisfies ExportedHandler<Env>;

// https://github.com/cloudflare/workers-sdk/issues/8588
// holy
export async function CreateDepsFromEnv(env: Env): Promise<SitefEntrypointDep> {
	const environment = env.ENVIRONMENT;
	const logger = createAxiomLogger({ dataset: env.AXIOM_LOG_DATASET, token: env.AXIOM_API_TOKEN });
	const exporter = new AxiomExporter(env.AXIOM_API_TOKEN, env.AXIOM_TRACE_DATASET);

	// POJO以外渡せないためDI不可
	const relayFetcherStub = await env.SitefFetcher.createRelaySitefFetcher(env.ENVIRONMENT);

	const relayFetcher = unwrapRelayFetcherStub(relayFetcherStub as unknown as Rpc.Stub<RelaySitefFetcher>);

	switch (environment) {
		case 'development':
		case 'example':
			throw new Error("index.prod.ts is being executed, but the environment is set to 'development' or 'example'. ");

		case 'production':
		default:
			return {
				logger,
				CheckNeedScrapingBatch,
				environment,
				exporter,
				fetcher: relayFetcher,
				sendBatch: (messages: Iterable<MessageSendRequest<DEMO_CommonSiteQueueData>>, options?: QueueSendBatchOptions) =>
					env.DemoScrapingQueue.sendBatch(messages, options),
			};
	}
}

async function CheckNeedScraping(site: 'f' | 'd' | 'm' | 's', id: string) {
	// 😀
	return true;
}

async function CheckNeedScrapingBatch(site: 'f' | 'd' | 'm' | 's', items: Omit<DEMO_CommonSiteQueueData, 'thumbUrl' | 'otelContext'>[]) {
	// 😀🤚
	return items;
}
