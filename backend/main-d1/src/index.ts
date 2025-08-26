import { WorkerEntrypoint } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';
import { and, eq, InferInsertModel, sql } from 'drizzle-orm';
import type { Environment, Site } from '@cfstackdemo/types';
import { ConvertSiteToNumberId, serializeError } from '@cfstackdemo/utility';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@cfstackdemo/lightweight-otel-sdk/const';

import { ok, ResultAsync } from 'neverthrow';
import { D1InsertError, D1SelectError, DataInconsistencyError } from './errors';
import { AxiomExporter, ConsoleExporter, Exporter, NoopExporter, OtelContext, Tracer, instrument } from '@cfstackdemo/lightweight-otel-sdk';

import { ConsoleLogger, createAxiomLogger, NoopLogger } from '@cfstackdemo/logger';

export default class Handler extends WorkerEntrypoint<Env> {
	async fetch(request: Request) {
		return new Response();
	}

	async saveAll(data: InsertAllDataInput['data'], otelContext: OtelContext, environment: Environment) {
		// https://github.com/cloudflare/workers-sdk/issues/8588
		const env: Env = {
			...this.env,
			ENVIRONMENT: environment, // 上書き
		};

		const deps = await CreateCommonDepsFromEnv(env);
		await saveAll(deps, { data, otelContext });
	}

	async getItems(environment: 'development' | 'staging' | 'production' | 'example', params: { from: number; count: number }) {
		// https://github.com/cloudflare/workers-sdk/issues/8588
		const env: Env = {
			...this.env,
			ENVIRONMENT: environment, // 上書き
		};

		const deps = await CreateCommonDepsFromEnv(env);
		return getItems(deps, params);
	}

	async getItem(siteId: number, specificItemId: string, environment: 'development' | 'staging' | 'production' | 'example') {
		// https://github.com/cloudflare/workers-sdk/issues/8588
		const env: Env = {
			...this.env,
			ENVIRONMENT: environment, // 上書き
		};

		const deps = await CreateCommonDepsFromEnv(env);
		return getItem(deps, { siteId, specificItemId });
	}
}

interface LoggerLike {
	info: (message: string, args?: Record<string | symbol, any>) => void;
	error: (message: string, args?: Record<string | symbol, any>) => void;
	warn: (message: string, args?: Record<string | symbol, any>) => void;
	with: (fields: Record<string | symbol, any>) => LoggerLike;
	flush(): Promise<void> | void;
}

export interface InsertAllDataInput {
	data: {
		site: Site;
		reviews: {
			id: string;
			title: string;
			body: string;
			rating: number;
			createdAt: string;
			reviewer: {
				name: string;
				id: string;
			};
		}[];
		item: Omit<InferInsertModel<typeof schema.items>, 'siteId' | 'id' | 'avgRating' | 'reviewCount'>;
		samples: string[];
	};
	otelContext: {
		parentSpanId: string;
		parentTraceId: string;
	};
}
export interface MainD1CommonDep {
	logger: LoggerLike;
	exporter: Exporter;
	env: Env;
}

export async function CreateCommonDepsFromEnv(env: Env): Promise<MainD1CommonDep> {
	const environment = env.ENVIRONMENT;

	switch (environment) {
		case 'development':
		case 'example':
			return {
				env,
				exporter: new ConsoleExporter(),
				logger: new ConsoleLogger(),
			};
		case 'test':
			return {
				env,
				exporter: new NoopExporter(),
				logger: new ConsoleLogger(),
			};

		default:
			return {
				env,
				exporter: new AxiomExporter(env.AXIOM_API_TOKEN, env.AXIOM_TRACE_DATASET),
				logger: createAxiomLogger({ dataset: env.AXIOM_LOG_DATASET, token: env.AXIOM_API_TOKEN }),
			};
	}
}

export async function saveAll(deps: MainD1CommonDep, _data: InsertAllDataInput) {
	const { exporter, env } = deps;
	const { data, otelContext } = _data;

	const SERVICE_NAME = 'main-d1';
	const SERVICE_VERSION = '0.0.0';

	// MARK: init otel tracer
	const tracer = new Tracer({
		[ATTR_SERVICE_NAME]: SERVICE_NAME,
		[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
	});

	// MARK: create root span
	const rootSpan = tracer.startSpan('main-d1 worker', otelContext.parentTraceId, otelContext.parentSpanId);

	const logger = deps.logger.with({ traceId: rootSpan.traceId, worker: 'main-d1' });

	try {
		const db = drizzle(env.MainD1, { schema });

		const siteId = ConvertSiteToNumberId(data.site);
		// const avgRating = data.reviews.length > 0 ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : 0;
		const validRatings = data.reviews.filter((r) => r.rating != null).map((r) => r.rating);
		const avgRating = validRatings.length > 0 ? validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length : 0;
		const reviewCount = data.reviews.length;

		logger.info('d1.save_all.start', { siteId, avgRating, reviewCount });

		// MARK: insert item
		const insertItemResult = await instrument({
			tracer,
			name: 'insert-item',
			rootSpan,
			parentSpan: rootSpan,
			fn: (span) => {
				span.addAttribute('item.siteSpecificId', data.item.siteSpecificId);
				span.addAttribute('item.siteId', siteId);
				return ResultAsync.fromThrowable(
					() =>
						db
							.insert(schema.items)
							.values([
								{
									...data.item,
									avgRating,
									reviewCount,
									siteId,
								},
							])
							.onConflictDoNothing(),
					(e) => {
						const error = e as Error;
						return new D1InsertError(`Failed to insert item`, { cause: error.cause });
					}
				)();
			},
		});

		if (insertItemResult.isErr()) {
			logger.error('Failed to insert item', {
				error: serializeError(insertItemResult.error),
				siteId,
				siteSpecificId: data.item.siteSpecificId,
			});
			rootSpan.recordException(insertItemResult.error);
			return;
		}
		const insertedItem = insertItemResult.value;

		let itemId: number;
		if (insertedItem.meta.changes > 0) {
			// inserted
			itemId = insertedItem.meta.last_row_id;
			logger.info('d1.save_all.item.insert.success', { itemId });
		} else {
			// conflicted, read
			const getItemResult = await instrument({
				tracer,
				name: 'get-existing-item',
				rootSpan,
				parentSpan: rootSpan,
				fn: (span) => {
					span.addAttribute('item.siteSpecificId', data.item.siteSpecificId);
					span.addAttribute('item.siteId', siteId);
					return ResultAsync.fromThrowable(
						() =>
							db.query.items.findFirst({
								where: and(eq(schema.items.siteSpecificId, data.item.siteSpecificId), eq(schema.items.siteId, siteId)),
								columns: {
									id: true,
								},
							}),
						(e) => {
							const error = e as Error;
							return new D1SelectError('Failed to select item', {
								cause: error.cause,
							});
						}
					)();
				},
			});

			if (getItemResult.isErr()) {
				logger.error('Failed to get existing item after conflict', {
					error: serializeError(getItemResult.error),
					siteId,
					siteSpecificId: data.item.siteSpecificId,
				});
				rootSpan.recordException(getItemResult.error);

				return;
			}

			if (!getItemResult.value) {
				const error = new DataInconsistencyError(`Item should exist after conflict`);
				logger.error('Data inconsistency: item should exist after conflict', {
					error: serializeError(error),
					siteId,
					siteSpecificId: data.item.siteSpecificId,
				});
				rootSpan.recordException(error);

				return;
			}

			itemId = getItemResult.value.id;
			logger.info('d1.save_all.item.found_existing', { itemId });
		}

		// MARK: insert reviews
		// create reviews data
		if (data.reviews.length > 0) {
			// 1. ユニークなレビュアーを抽出
			const uniqueReviewers = Array.from(new Map(data.reviews.map((r) => [r.reviewer.name, r.reviewer])).values());

			if (uniqueReviewers.length === 0) {
				// TODO: ERROR
				logger.warn('d1.save_all.reviewer.none', { itemId });
			}

			// 2. レビュアーを一括インサート（ON CONFLICT対応）
			const insertReviewersResult = await instrument({
				tracer,
				name: 'insert-reviewers',
				rootSpan,
				parentSpan: rootSpan,
				fn: (span) => {
					logger.info('d1.save_all.reviewer.insert.start', { count: uniqueReviewers.length });
					span.addAttribute('reviewers.count', uniqueReviewers.length);

					// 空配列の場合は早期リターン
					if (uniqueReviewers.length === 0) {
						logger.info('d1.save_all.reviewer.insert.skip');
						return ok([]); // 空配列を返す
					}

					return ResultAsync.fromThrowable(
						() =>
							db
								.insert(schema.reviewers)
								.values(
									uniqueReviewers.map((reviewer) => ({
										reviewerId: reviewer.id || undefined,
										name: reviewer.name,
									}))
								)
								.onConflictDoNothing()
								.returning(),
						(e) => {
							const error = e as Error;
							const dbError = new D1InsertError(`Failed to insert reviewers`, { cause: error.cause });
							logger.error('Failed to insert reviewers', {
								error: serializeError(dbError),
								reviewersCount: uniqueReviewers.length,
							});
							return dbError;
						}
					)();
				},
			});

			if (insertReviewersResult.isErr()) {
				rootSpan.recordException(insertReviewersResult.error);
				return;
			}

			// 3. 既存のレビュアーも含めて全レビュアーのIDを取得
			const allReviewerNames = uniqueReviewers.map((r) => r.name);
			const getAllReviewersResult = await instrument({
				tracer,
				name: 'get-all-reviewers',
				rootSpan,
				parentSpan: rootSpan,
				fn: (span) => {
					logger.info('d1.save_all.reviewer.fetch_all.start', { count: allReviewerNames.length });
					span.addAttribute('reviewers.query.count', allReviewerNames.length);
					return ResultAsync.fromThrowable(
						() =>
							db
								.select()
								.from(schema.reviewers)
								.where(sql`${schema.reviewers.name} IN (${sql.join(allReviewerNames, sql`, `)})`),
						(e) => {
							const error = e as Error;
							const dbError = new D1SelectError(`Failed to get all reviewers`, { cause: error.cause });
							logger.error('Failed to get all reviewers', {
								error: serializeError(dbError),
								reviewersCount: allReviewerNames.length,
							});
							return dbError;
						}
					)();
				},
			});

			if (getAllReviewersResult.isErr()) {
				rootSpan.recordException(getAllReviewersResult.error);
				return;
			}

			const allReviewers = getAllReviewersResult.value;

			// 4. レビュアー名とIDのマッピングを作成
			const reviewerNameToId = new Map(allReviewers.map((r) => [r.name, r.id]));

			// 5. レビューデータを準備して一括インサート
			const reviewsToInsert = data.reviews.map((review) => ({
				siteId: siteId,
				itemId: itemId,
				reviewId: review.id,
				reviewerId: reviewerNameToId.get(review.reviewer.name)!,
				title: review.title,
				body: review.body,
				rating: review.rating,
				createdAt: review.createdAt,
			}));

			const insertReviewsResult = await instrument({
				tracer,
				name: 'insert-reviews',
				rootSpan,
				parentSpan: rootSpan,
				fn: (span) => {
					logger.info('d1.save_all.review.insert.start', { count: reviewsToInsert.length });
					span.addAttribute('reviews.count', reviewsToInsert.length);
					return ResultAsync.fromThrowable(
						() => db.insert(schema.reviews).values(reviewsToInsert),
						(e) => {
							const error = e as Error;
							const dbError = new D1InsertError(`Failed to insert reviews`, { cause: error.cause });
							logger.error('Failed to insert reviews', {
								error: serializeError(dbError),
								reviewsCount: reviewsToInsert.length,
							});
							return dbError;
						}
					)();
				},
			});

			if (insertReviewsResult.isErr()) {
				rootSpan.recordException(insertReviewsResult.error);
				return;
			}
		} else {
			logger.info('d1.save_all.review.none', { itemId });
		}

		// MARK: insert samples
		const samplesToInsert = data.samples.map((sample) => ({
			itemId: itemId,
			url: sample,
		}));

		if (samplesToInsert.length > 0) {
			const insertSamplesResult = await instrument({
				tracer,
				name: 'insert-samples',
				rootSpan,
				parentSpan: rootSpan,
				fn: (span) => {
					logger.info('d1.save_all.sample.insert.start', { count: samplesToInsert.length });
					span.addAttribute('samples.count', samplesToInsert.length);
					return ResultAsync.fromThrowable(
						() => db.insert(schema.samples).values(samplesToInsert),
						(e) => {
							const error = e as Error;
							const dbError = new D1InsertError(`Failed to insert samples`, { cause: error.cause });
							logger.error('Failed to insert samples', {
								error: serializeError(dbError),
								samplesCount: samplesToInsert.length,
							});
							return dbError;
						}
					)();
				},
			});

			if (insertSamplesResult.isErr()) {
				rootSpan.recordException(insertSamplesResult.error);
				return;
			}
		} else {
			logger.info('d1.save_all.sample.none', { itemId });
		}

		logger.info('d1.save_all.success', {
			itemId,
			siteId,
			// success: true,
			// reviewsInserted: reviewsToInsert.length,
			// samplesInserted: samplesToInsert.length,
			// reviewersProcessed: uniqueReviewers.length,
			// avgRating,
			// reviewCount,
		});
	} catch (e) {
		logger.error('Unexpected error', {
			error: serializeError(e),
			id: data.item.siteSpecificId,
		});
		rootSpan.recordException(e);
		throw e;
	} finally {
		rootSpan.end();
		await logger.flush();

		const spans = tracer.getCompletedSpans();
		await exporter.export(spans);

		tracer.clearSpans();
	}
}

interface GetItemInput {
	siteId: number;
	specificItemId: string;
}
async function getItem(deps: MainD1CommonDep, data: GetItemInput) {
	const { exporter, env } = deps;
	const { siteId, specificItemId } = data;
	const SERVICE_NAME = 'main-d1';
	const SERVICE_VERSION = '0.0.0';

	const tracer = new Tracer({
		[ATTR_SERVICE_NAME]: SERVICE_NAME,
		[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
	});

	const rootSpan = tracer.startSpan('getItem');

	const logger = deps.logger.with({ traceid: rootSpan.traceId });

	try {
		const db = drizzle(env.MainD1, { schema });

		const getItemResult = await instrument({
			tracer,
			name: 'get-item',
			rootSpan,
			parentSpan: rootSpan,
			fn: (span) => {
				span.addAttribute('item.siteId', siteId);
				span.addAttribute('item.siteSpecificId', specificItemId);
				return ResultAsync.fromThrowable(
					() =>
						db.query.items.findFirst({
							where: and(eq(schema.items.siteId, siteId), eq(schema.items.siteSpecificId, specificItemId)),
							with: {
								reviews: true,
								samples: true,
							},
						}),
					(e) => {
						const error = e as Error;
						return new D1SelectError(`Failed to get item`, { cause: error.cause });
					}
				)();
			},
		});

		if (getItemResult.isErr()) {
			logger.error('Failed to get item', {
				error: serializeError(getItemResult.error),
				siteId,
				specificItemId,
			});
			rootSpan.recordException(getItemResult.error);

			throw getItemResult.error;
		}

		const item = getItemResult.value;
		logger.info('Retrieved item successfully', {
			siteId,
			specificItemId,
			found: !!item,
			reviewsCount: item?.reviews?.length || 0,
			samplesCount: item?.samples?.length || 0,
		});

		return item;
	} finally {
		rootSpan.end();
		await logger.flush();

		const spans = tracer.getCompletedSpans();
		await exporter.export(spans);

		tracer.clearSpans();
	}
}

async function getItems(
	deps: MainD1CommonDep,
	params: {
		from: number;
		count: number;
	}
) {
	const { env, exporter } = deps;
	const SERVICE_NAME = 'main-d1';
	const SERVICE_VERSION = '0.0.0';

	const tracer = new Tracer({
		[ATTR_SERVICE_NAME]: SERVICE_NAME,
		[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
	});

	const rootSpan = tracer.startSpan('getItems');

	const logger = deps.logger.with({ traceid: rootSpan.traceId });

	try {
		const db = drizzle(env.MainD1, { schema });

		const getItemsResult = await instrument({
			tracer,
			name: 'get-items',
			rootSpan,
			parentSpan: rootSpan,
			fn: (span) => {
				return ResultAsync.fromThrowable(
					() =>
						db.query.items.findMany({
							with: {
								reviews: true,
								samples: true,
							},
							offset: params.from,
							limit: params.count,
							orderBy: (items, { desc }) => [desc(items.id)],
						}),
					(e) => {
						const error = e as Error;
						return new D1SelectError(`Failed to get items`, { cause: error.cause });
					}
				)();
			},
		});

		if (getItemsResult.isErr()) {
			logger.error('Failed to get items', {
				error: serializeError(getItemsResult.error),
			});
			rootSpan.recordException(getItemsResult.error);

			throw getItemsResult.error;
		}

		const items = getItemsResult.value;
		logger.info('Retrieved items successfully', { count: items.length });

		return items;
	} finally {
		rootSpan.end();
		await logger.flush();

		const spans = tracer.getCompletedSpans();
		await exporter.export(spans);

		tracer.clearSpans();
	}
}
