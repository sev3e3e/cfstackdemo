import { WorkerEntrypoint } from 'cloudflare:workers';
import { ConsoleLogger, createAxiomLogger } from '@cfstackdemo/logger';
import { RelaySitefFetcher } from './relay';
import type { Environment } from '@cfstackdemo/types';
import { DirectSitefFetcher } from './direct';
import { Env } from '../worker-configuration';

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
				return new RelaySitefFetcher(
					new ConsoleLogger(),
					fetch.bind(globalThis),
					this.env.JWTService.getOrCreateJWT,
					this.env.GCP_DEPLOYED_RELAY_ENDPOINT
				);

			case 'production':
				return new RelaySitefFetcher(
					createAxiomLogger({ dataset: this.env.AXIOM_LOG_DATASET, token: this.env.AXIOM_API_TOKEN }),
					fetch.bind(globalThis),
					this.env.JWTService.getOrCreateJWT,
					this.env.GCP_DEPLOYED_RELAY_ENDPOINT
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
