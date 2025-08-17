import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAxiomLogger } from '../src/loggers/axiomLogger';

vi.mock('@axiomhq/logging', () => {
	return {
		Logger: vi.fn().mockImplementation(() => ({ mocked: true })),
		AxiomJSTransport: vi.fn().mockImplementation((args) => ({ transportArgs: args })),
	};
});

vi.mock('@axiomhq/js', () => {
	return {
		Axiom: vi.fn().mockImplementation((args) => ({ axiomArgs: args })),
	};
});

describe('createAxiomLogger', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return Logger instance when config is provided', async () => {
		const { Logger } = await import('@axiomhq/logging');
		const cfg = { transports: [] };

		const logger = createAxiomLogger(undefined, cfg as any);

		expect(vi.mocked(Logger)).toHaveBeenCalledWith(cfg);
		expect(logger).toEqual({ mocked: true });
	});

	it('should create Axiom and transport when defaultConfig is provided', async () => {
		const { Logger, AxiomJSTransport } = await import('@axiomhq/logging');
		const { Axiom } = await import('@axiomhq/js');

		const defaultCfg = { token: 't', dataset: 'd' };
		createAxiomLogger(defaultCfg);

		expect(vi.mocked(Axiom)).toHaveBeenCalledWith({ token: 't' });
		expect(vi.mocked(AxiomJSTransport)).toHaveBeenCalledWith({
			axiom: { axiomArgs: { token: 't' } },
			dataset: 'd',
		});
		expect(vi.mocked(Logger)).toHaveBeenCalled();
	});

	it('should throw error if both configs are missing', () => {
		expect(() => createAxiomLogger()).toThrowError();
	});
});
