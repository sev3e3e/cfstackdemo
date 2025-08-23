import type { Environment, Site } from '@cfstackdemo/types';
import { CreatePriceHistoryPath } from './lib';
import type { PriceHistoryData } from './types';
import { ResultAsync } from 'neverthrow';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@cfstackdemo/lightweight-otel-sdk/const';
import { serializeError } from '@cfstackdemo/utility';

import { AxiomExporter, ConsoleExporter, Exporter, NoopExporter, OtelContext, Tracer } from '@cfstackdemo/lightweight-otel-sdk';

import { ConsoleLogger, createAxiomLogger } from '@cfstackdemo/logger';
import { WorkerEntrypoint } from 'cloudflare:workers';

export default class Handler extends WorkerEntrypoint<Env> {
	async fetch() {
		return new Response();
	}

	async savePriceHistory(
		params: { site: Site; id: string; data: PriceHistoryData },
		otelContext: OtelContext,
		environment: Environment
	): Promise<void> {
		// https://github.com/cloudflare/workers-sdk/issues/8588
		const newEnv: Env = {
			...this.env,
			ENVIRONMENT: environment, // 上書き
		};

		const deps = await CreateDepsFromEnv(newEnv);
		await savePriceHistory(deps, { params, otelContext });
	}

	async readPriceHistory(site: Site, id: string) {
		const path = CreatePriceHistoryPath(site, id);
		const res = await this.env.HistoryR2.get(path);

		return res?.json();
	}
}

export async function savePriceHistory(
	deps: MainR2CommonDep,
	_data: {
		params: { site: Site; id: string; data: PriceHistoryData };
		otelContext: OtelContext;
	}
) {
	const { site, id, data } = _data.params;
	const otelContext = _data.otelContext;
	const { exporter, readPriceHistory, HistoryR2 } = deps;

	const SERVICE_NAME = 'main-r2';
	const SERVICE_VERSION = '0.0.0';

	// MARK: init otel tracer
	const tracer = new Tracer({
		[ATTR_SERVICE_NAME]: SERVICE_NAME,
		[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
	});

	// MARK: create root span
	const rootSpan = tracer.startSpan('main-r2 worker', otelContext.parentTraceId, otelContext.parentSpanId);

	const logger = deps.logger.with({ traceId: rootSpan.traceId, worker: 'main-r2' });

	// 処理開始ログ
	logger.info('r2.price_history.save.start', {
		site,
		id,
	});

	try {
		const path = CreatePriceHistoryPath(site, id);

		// R2データ読み取り開始ログ
		logger.info('r2.price_history.read.start', {
			site,
			id,
			path,
		});

		const getExistingDataResult = await readPriceHistory(site, id);
		if (getExistingDataResult.isErr()) {
			logger.error('r2.price_history.read.error', {
				error: serializeError(getExistingDataResult.error),
				..._data.params,
			});
			rootSpan.recordException(getExistingDataResult.error);
			return;
		}

		const existingData = getExistingDataResult.value;
		logger.info('r2.price_history.read.complete', {
			found: !!existingData,
			size: existingData?.size || 0,
		});

		if (!existingData) {
			// 新規データ作成ログ
			logger.info('r2.price_history.create.start', {
				site,
				id,
				path,
			});

			const putResult = await ResultAsync.fromPromise(HistoryR2.put(path, JSON.stringify([data])), (e) => e);
			if (putResult.isErr()) {
				logger.error('r2.price_history.create.error', {
					error: serializeError(putResult.error),
					..._data.params,
				});
				rootSpan.recordException(putResult.error);
				return;
			}

			logger.info('r2.price_history.create.success', {
				result: {
					key: putResult.value?.key,
					size: putResult.value?.size,
					etag: putResult.value?.etag,
					uploadedDate: putResult.value?.uploaded?.toISOString(),
				},
				recordCount: 1,
				..._data.params,
			});
			return;
		}

		// 既存データ処理開始ログ
		logger.info('r2.price_history.parse.start', {
			site,
			id,
			existingSize: existingData.size,
		});

		const ph = await existingData.json<PriceHistoryData[]>();
		const existingRecordCount = ph.length;

		// データ追加前の状態ログ
		logger.info('r2.price_history.parse.complete', {
			site,
			id,
			existingRecordCount,
		});

		ph.push(data);
		const newRecordCount = ph.length;
		const serializedData = JSON.stringify(ph);

		// データ更新前ログ
		logger.info('r2.price_history.append.start', {
			site,
			id,
			previousRecordCount: existingRecordCount,
			newRecordCount,
			newDataSize: serializedData.length,
		});

		const putPHDataResult = await ResultAsync.fromPromise(HistoryR2.put(path, serializedData), (e) => e);

		if (putPHDataResult.isErr()) {
			logger.error('r2.price_history.append.error', {
				error: serializeError(putPHDataResult.error),
				..._data.params,
			});
			rootSpan.recordException(putPHDataResult.error);
			return;
		}

		logger.info('r2.price_history.append.success', {
			result: {
				key: putPHDataResult.value?.key,
				size: putPHDataResult.value?.size,
				etag: putPHDataResult.value?.etag,
				uploadedDate: putPHDataResult.value?.uploaded?.toISOString(),
			},
			recordCount: newRecordCount,
			dataGrowth: newRecordCount - existingRecordCount,
			..._data.params,
		});

		// 処理完了ログ
		logger.info('r2.price_history.save.complete', {
			site,
			id,
			finalRecordCount: newRecordCount,
			operationType: 'append',
		});
		return;
	} catch (e) {
		logger.error('r2.price_history.save.unexpected', {
			error: serializeError(e),
			stage: 'unknown',
			..._data.params,
		});
		rootSpan.recordException(e);
		throw e;
	} finally {
		rootSpan.end();
		await logger.flush();

		const spans = tracer.getCompletedSpans();
		await exporter.export(spans);

		tracer.clearSpans();

		// 最終的なクリーンアップログ
		logger.info('r2.price_history.cleanup.complete', {
			site,
			id,
			spanCount: spans.length,
		});
	}
}

export async function CreateDepsFromEnv(env: Env): Promise<MainR2CommonDep> {
	const environment = env.ENVIRONMENT;
	const readPriceHistory = (site: Site, id: string) => {
		const path = CreatePriceHistoryPath(site, id);

		return ResultAsync.fromPromise(env.HistoryR2.get(path), (e) => e);
	};

	const HistoryR2 = env.HistoryR2;

	switch (environment) {
		case 'development':
		case 'example':
			return {
				logger: new ConsoleLogger(),
				exporter: new ConsoleExporter(),
				readPriceHistory,
				HistoryR2,
			};

		case 'test':
			console.log('env is ', environment);
			return {
				logger: new ConsoleLogger(),
				exporter: new NoopExporter(),
				readPriceHistory,
				HistoryR2,
			};
		default:
			return {
				exporter: new AxiomExporter(env.AXIOM_API_TOKEN, env.AXIOM_TRACE_DATASET),
				logger: createAxiomLogger({ dataset: env.AXIOM_LOG_DATASET, token: env.AXIOM_API_TOKEN }),
				readPriceHistory,
				HistoryR2,
			};
	}
}

export interface MainR2CommonDep {
	logger: LoggerLike;
	exporter: Exporter;
	HistoryR2: R2Bucket;

	readPriceHistory(site: Site, id: string): ResultAsync<R2ObjectBody | null, unknown>;
}

interface LoggerLike {
	info: (message: string, args?: Record<string | symbol, any>) => void;
	error: (message: string, args?: Record<string | symbol, any>) => void;
	with: (fields: Record<string | symbol, any>) => LoggerLike;
	flush(): Promise<void> | void;
}
