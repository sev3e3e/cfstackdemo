import { drizzle } from 'drizzle-orm/d1';
import * as schema from './d1schema';

import { and, eq, gt } from 'drizzle-orm';
import { jwtSignature } from './signature';
import type { LoggerLike } from '../interfaces';
import { ATTR_CODE_FUNCTION_NAME, ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@cfstackdemo/lightweight-otel-sdk/const';
import { Exporter, instrument, Tracer } from '@cfstackdemo/lightweight-otel-sdk';
import { ResultAsync } from 'neverthrow';
import { serializeError } from '@cfstackdemo/utility';

export async function getOrCreateJWT(
	d1: D1Database,
	id: number,
	credential: {
		endpoint: string;
		GCP_SERVICE_ACCOUNT_EMAIL: string;
		GCP_SERVICE_ACCOUNT_KEY: string;
	},
	deps: {
		logger: LoggerLike;
		exporter: Exporter;
	},
	traceId: string,
	parentSpanId: string
) {
	const SERVICE_NAME: string = 'cf-jwt-worker';
	const SERVICE_VERSION: string = '0.0.0';
	const tracer = new Tracer({
		[ATTR_SERVICE_NAME]: SERVICE_NAME,
		[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
	});

	const rootSpan = tracer.startSpan('getOrCreateJWT', traceId, parentSpanId);
	rootSpan.addAttribute(ATTR_CODE_FUNCTION_NAME, 'getOrCreateJWT');

	const { exporter } = deps;

	const logger = deps.logger.with({ traceId, worker: 'jwt-worker' });
	try {
		// init db
		const db = drizzle(d1, {
			schema: schema,
		});

		const now = new Date();
		const marginTime = new Date(now.getTime() + 10 * 60 * 1000); // 10分マージン

		// 既存JWT確認
		logger.debug?.('jwt.cache.check', { id, marginMinutes: 10 });

		// 有効なJWT取得
		const existingResult = await instrument({
			fn: () =>
				ResultAsync.fromPromise(
					db
						.select()
						.from(schema.httpRelayJwtCache)
						.where(and(eq(schema.httpRelayJwtCache.id, id), gt(schema.httpRelayJwtCache.expiresAt, marginTime.toISOString())))
						.get(),
					(e) => e
				),
			name: 'check cache hit',
			tracer,
			parentSpan: rootSpan,
			rootSpan,
		});
		if (existingResult.isErr()) {
			logger.error('failed to query jwt cache', {
				error: serializeError(existingResult.error),
			});

			rootSpan.addAttribute('error.phase', 'jwt.cache.query_failed');

			rootSpan.recordException(existingResult);
			return;
		}
		const existing = existingResult.value;

		if (existing) {
			logger.info('jwt.cache.hit', {
				id,
				expiresAt: existing.expiresAt,
			});

			rootSpan.addAttribute('jwt.cache.hit', true);
			rootSpan.addAttribute('jwt.cache.expiresAt', existing.expiresAt);

			return existing;
		}

		logger.info('jwt.cache.miss', { id });

		rootSpan.addAttribute('jwt.cache.hit', false);

		logger.debug?.('jwt.signature.start', { endpoint: credential.endpoint });

		const newJWTResult = await instrument({
			fn: () =>
				ResultAsync.fromPromise(
					jwtSignature({
						email: credential.GCP_SERVICE_ACCOUNT_EMAIL,
						privatekey: credential.GCP_SERVICE_ACCOUNT_KEY,
						function_deployed_endpoint: `${credential.endpoint}/relay-${id}`,
					}),
					(e) => e
				),
			name: 'create signature jwt',
			tracer,
			parentSpan: rootSpan,
			rootSpan,
		});
		if (newJWTResult.isErr()) {
			logger.error('failed to create jwt signature', {
				error: serializeError(newJWTResult.error),
			});

			rootSpan.addAttribute('error.phase', 'jwt.signature.create_failed');

			rootSpan.recordException(newJWTResult);
			return;
		}
		const newJWT = newJWTResult.value;

		logger.info('jwt.created', {
			id,
			expiresAt: newJWT.expireAt.toISOString(),
		});

		const upsertResult = await instrument({
			fn: () =>
				ResultAsync.fromPromise(
					db
						.insert(schema.httpRelayJwtCache)
						.values({
							id: id,
							key: newJWT.key,
							expiresAt: newJWT.expireAt.toISOString(),
						})
						.onConflictDoUpdate({
							target: schema.httpRelayJwtCache.id,
							set: {
								id: id,
								key: newJWT.key,
								expiresAt: newJWT.expireAt.toISOString(),
							},
						})
						.returning()
						.get(),
					(e) => e
				),
			name: 'upsert jwt token to d1',
			tracer,
			parentSpan: rootSpan,
			rootSpan,
		});
		if (upsertResult.isErr()) {
			logger.error('failed to upsert jwt token to d1', {
				error: serializeError(upsertResult.error),
			});
			rootSpan.addAttribute('error.phase', 'jwt.cache.upsert_failed');
			rootSpan.recordException(upsertResult.error);
			return;
		}
		rootSpan.addAttribute('success', true);

		return upsertResult.value;
	} catch (e) {
		logger.error('unexpected error, what?', {
			error: serializeError(e),
		});
		rootSpan.addAttribute('success', false);
	} finally {
		rootSpan.end();
		await logger.flush();

		const spans = tracer.getCompletedSpans();
		await exporter.export(spans);

		tracer.clearSpans();
	}
}
