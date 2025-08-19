import { ConsoleLogger } from '@cfstackdemo/logger';

export default async function mockedGetOrCreateJWT(traceId: string, parentSpanId: string) {
	const logger = new ConsoleLogger({ traceId, worker: 'jwt-worker' });

	logger.info('mocked_jwt.create.start');
	const jwt = {
		id: 0,
		key: 'DEMOJWTKEY',
		expiresAt: new Date().toISOString(),
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	logger.info('mocked_jwt.created');
	logger.info('mocked_jwt.create.success');

	return jwt;
}
