import { WorkerEntrypoint } from 'cloudflare:workers';
import { ConsoleLogger, createAxiomLogger } from '@cfstackdemo/logger';
import { RelaySitefFetcher } from './relay';
import type { Environment } from '@cfstackdemo/types';
import { DirectSitefFetcher } from './direct';
import { Env } from '../worker-configuration';
import mockedGetOrCreateJWT from './mock/getOrCreateJWT';

export default class extends WorkerEntrypoint<Env> {
	async fetch(): Promise<Response> {
		return new Response('Hello World!');
	}

	createSitefFetcherFromEnv(env: Environment) {
		switch (env) {
			case 'development':
			case 'example':
			default:
				return;

			case 'production':
				break;
		}
	}

	async createRelaySitefFetcher(env: Environment) {
		switch (env) {
			case 'development':
			case 'example':
			default:
				const mockApiEndpoint = 'http://localhost:9999';
				const proxyEndpoint = 'http://localhost:9998';

				const getMockedJWT = mockedGetOrCreateJWT;

				return new RelaySitefFetcher(new ConsoleLogger(), fetch.bind(globalThis), getMockedJWT, {
					proxy: proxyEndpoint,
					detail: `${mockApiEndpoint}/sitef/item/detail`,
					hiddenSale: `${mockApiEndpoint}/sitef/hidden-sale-api`,
					item: `${mockApiEndpoint}/sitef/api/item`,
				});

			case 'production':
				const apiEndpoint = 'https://cfstackdemo-mock-web-server.ripfirem-cloudflare.workers.dev';
				return new RelaySitefFetcher(
					createAxiomLogger({ dataset: this.env.AXIOM_LOG_DATASET, token: this.env.AXIOM_API_TOKEN }),
					fetch.bind(globalThis),
					this.env.JWTService.getOrCreateJWT,
					{
						proxy: this.env.GCP_DEPLOYED_RELAY_ENDPOINT,
						detail: `${apiEndpoint}/sitef/item/detail`,
						hiddenSale: `${apiEndpoint}/sitef/hidden-sale-api`,
						item: `${apiEndpoint}/sitef/api/item`,
					}
				);
		}
	}

	async createDirectSitefFetcher(env: Environment) {
		switch (env) {
			case 'development':
			case 'example':
			default:
				return new DirectSitefFetcher(new ConsoleLogger(), fetch.bind(globalThis));

			case 'production':
				return new DirectSitefFetcher(createAxiomLogger(), fetch.bind(globalThis));
		}
	}
}

export * from './direct';
export * from './relay';
