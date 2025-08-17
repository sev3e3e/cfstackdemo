import { Logger, AxiomJSTransport, LoggerConfig } from '@axiomhq/logging';
import { Axiom } from '@axiomhq/js';
import type { BaseLogger } from '../interfaces/baseLogger';

export type DefaultConfig = {
	token: string;
	dataset: string;
};

export function createAxiomLogger(defaultConfig?: DefaultConfig, config?: LoggerConfig): BaseLogger {
	if (config) {
		const logger = new Logger(config);

		return logger;
	}

	if (!defaultConfig) {
		throw new Error('config not found');
	}

	const axiom = new Axiom({ token: defaultConfig.token });
	const logger = new Logger({
		transports: [
			new AxiomJSTransport({
				axiom,
				dataset: defaultConfig.dataset,
			}),
		],
	});

	return logger;
}
