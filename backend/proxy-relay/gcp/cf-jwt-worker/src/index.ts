import { WorkerEntrypoint } from 'cloudflare:workers';
import { getOrCreateJWT } from './jwt';
import { ConsoleLogger, createAxiomLogger } from '@cfstackdemo/logger';
import { LoggerLike } from './interfaces';
import { AxiomExporter, ConsoleExporter, Exporter } from '@cfstackdemo/lightweight-otel-sdk';

export default class extends WorkerEntrypoint<Env> {
	async fetch(): Promise<Response> {
		return new Response('Hello World!');
	}

	async getOrCreateJWT(traceId: string, parentSpanId: string) {
		const { exporter, logger } = createDepsFromEnv(this.env);

		return getOrCreateJWT(
			this.env.RelayJWTD1,
			0,
			{
				endpoint: this.env.GCP_RELAY_ENDPOINT,
				GCP_SERVICE_ACCOUNT_EMAIL: this.env.GCP_SERVICE_ACCOUNT_EMAIL,
				GCP_SERVICE_ACCOUNT_KEY: this.env.GCP_SERVICE_ACCOUNT_KEY,
			},
			{
				logger,
				exporter,
			},
			traceId,
			parentSpanId
		);
	}
}

function createDepsFromEnv(env: Env): {
	logger: LoggerLike;
	exporter: Exporter;
} {
	switch (env.ENVIRONMENT) {
		case 'development':
		case 'example':
		default:
			return {
				logger: new ConsoleLogger(),
				exporter: new ConsoleExporter(),
			};

		case 'production':
			return {
				logger: createAxiomLogger({
					dataset: env.AXIOM_LOG_DATASET,
					token: env.AXIOM_API_TOKEN,
				}),
				exporter: new AxiomExporter(env.AXIOM_API_TOKEN, env.AXIOM_TRACE_DATASET),
			};
	}
}
