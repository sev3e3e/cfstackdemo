// __tests__/consoleLogger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleLogger } from '../src/loggers/consoleLogger';

describe('ConsoleLogger', () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
	});

	it('should log correct structure for each level', () => {
		const logger = new ConsoleLogger({ app: 'test-app' });
		logger.debug('debug msg', { foo: 'bar' });
		logger.info('info msg');
		logger.warn('warn msg', { a: 1 });
		logger.error('error msg', { b: 2 });

		expect(logSpy).toHaveBeenCalledTimes(4);

		for (const call of logSpy.mock.calls) {
			const json = call[0] as string;
			const parsed = JSON.parse(json);
			expect(parsed).toMatchObject({
				app: 'test-app',
				level: expect.stringMatching(/^(debug|info|warn|error)$/),
				message: expect.any(String),
			});
			expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		}
	});

	it('should merge context in with()', () => {
		const base = new ConsoleLogger({ service: 'base' });
		const child = base.with({ requestId: 'req-1' });

		child.info('child msg');

		const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(parsed).toMatchObject({
			service: 'base',
			requestId: 'req-1',
			message: 'child msg',
		});
	});

	it('flush() should resolve', async () => {
		const logger = new ConsoleLogger();
		await expect(logger.flush()).resolves.toBeUndefined();
	});
});
