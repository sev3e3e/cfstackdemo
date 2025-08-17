import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoopLogger } from '../src/loggers/noopLogger';
import type { BaseLogger } from '../src/interfaces/baseLogger';

describe('NoopLogger', () => {
	let logger: NoopLogger;

	beforeEach(() => {
		logger = new NoopLogger({ service: 'test' });
	});

	it('should call private log() for each level', () => {
		// privateメソッドを直接モック化
		const logSpy = vi.spyOn(logger as any, 'log');

		logger.debug('debug msg', { foo: 1 });
		logger.info('info msg');
		logger.warn('warn msg', { bar: 2 });
		logger.error('error msg');

		expect(logSpy).toHaveBeenCalledTimes(4);
		expect(logSpy).toHaveBeenCalledWith('debug', 'debug msg', { foo: 1 });
		expect(logSpy).toHaveBeenCalledWith('info', 'info msg', {});
		expect(logSpy).toHaveBeenCalledWith('warn', 'warn msg', { bar: 2 });
		expect(logSpy).toHaveBeenCalledWith('error', 'error msg', {});
	});

	it('flush() should resolve', async () => {
		await expect(logger.flush()).resolves.toBeUndefined();
	});

	it('with() should merge context', () => {
		const child: BaseLogger = logger.with({ requestId: 'req-1' });
		// privateプロパティを直接読めないので log() をモックして検証
		const logSpy = vi.spyOn(child as any, 'log');

		child.info('merged msg');

		expect(logSpy).toHaveBeenCalledWith(
			'info',
			'merged msg',
			expect.any(Object) // contextの詳細は内部保持
		);
		// 親の context が維持されているか確認
		expect((child as any).context).toEqual({
			service: 'test',
			requestId: 'req-1',
		});
	});
});
