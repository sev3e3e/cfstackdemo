import { ConsoleExporter } from '@cfstackdemo/lightweight-otel-sdk';
import type { DirectSitefFetcher } from '@cfstackdemo/sitef-fetcher';
import type { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';
import type { Env } from '../worker-configuration';
import { ConsoleLogger } from '@cfstackdemo/logger';
import type { SitefEntrypointDep } from './interfaces';
import { runEntrypoint } from './runEntrypoint';
import { unwrapFetcherStub } from './lib/unwrapStubDirect';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		console.log(env.ENVIRONMENT);
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

	const logger = new ConsoleLogger();

	// POJO以外渡せないためDI不可
	const directFetcherStub = await env.SitefFetcher.createDirectSitefFetcher(env.ENVIRONMENT);

	const directFetcher = unwrapFetcherStub(directFetcherStub as unknown as Rpc.Stub<DirectSitefFetcher>);

	switch (environment) {
		case 'production':
			throw new Error("index.dev.ts is being executed, but the environment is set to 'production'. ");

		case 'development':
		case 'example':
		default:
			return {
				logger,
				CheckNeedScrapingBatch,
				environment: environment,
				exporter: new ConsoleExporter(),
				// exporter: new AxiomExporter(env.AXIOM_API_TOKEN, env.AXIOM_TRACE_DATASET),
				sendBatch: (messages: Iterable<MessageSendRequest<DEMO_CommonSiteQueueData>>, options?: QueueSendBatchOptions) =>
					env.DemoScrapingQueue.sendBatch(messages, options),
				fetcher: directFetcher,
			};

		case 'test':
			return {
				logger,
				CheckNeedScrapingBatch,
				environment: environment,
				exporter: new ConsoleExporter(),
				// exporter: new AxiomExporter(env.AXIOM_API_TOKEN, env.AXIOM_TRACE_DATASET),
				sendBatch: (messages: Iterable<MessageSendRequest<DEMO_CommonSiteQueueData>>, options?: QueueSendBatchOptions) =>
					env.DemoScrapingQueue.sendBatch(messages, options),
				fetcher: directFetcher,
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
