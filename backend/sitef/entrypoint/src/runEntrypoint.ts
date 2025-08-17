import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@cfstackdemo/lightweight-otel-sdk/const';
import { instrument, Tracer } from '@cfstackdemo/lightweight-otel-sdk';

import { fromPromise, ResultAsync } from 'neverthrow';
import { serializeError } from '@cfstackdemo/utility';
import type { SitefEntrypointDep } from './interfaces';

export async function runEntrypoint(deps: SitefEntrypointDep): Promise<void> {
	const { fetcher, sendBatch, exporter, CheckNeedScrapingBatch, environment } = deps;

	const SERVICE_NAME: string = 'sitef-entrypoint';
	const SERVICE_VERSION: string = '0.0.0';
	const tracer = new Tracer({
		[ATTR_SERVICE_NAME]: SERVICE_NAME,
		[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
	});

	const rootSpan = tracer.startSpan('sitef entrypoint');

	const logger = deps.logger.with({
		traceId: rootSpan.traceId,
		worker: 'sitef-entrypoint',
	});

	const traceId = rootSpan.traceId;
	const spanId = rootSpan.spanId;
	const otelCotext = { traceId, parentSpanId: spanId };

	try {
		logger.info('sitef.entrypoint.start', {
			message: 'entrypoint started',
		});
		rootSpan.addEvent('entrypoint_started', { environment });

		// fetch sales
		logger.info('sitef.entrypoint.fetch_sale.start');

		const saleResult = await instrument({
			tracer,
			name: 'fetch sale from Demo Hidden API',
			fn: async (span) => {
				return fromPromise(fetcher.FetchSaleFromHiddenAPI(otelCotext, 1), (e) => e);
			},
			parentSpan: rootSpan,
			rootSpan,
		});

		if (saleResult.isErr()) {
			const error = saleResult.error as any;
			const err = serializeError(error);
			logger.error('sitef.entrypoint.fetch_sale.error', {
				error: err,
			});
			rootSpan.recordException(error);
			return;
		}

		const sales = saleResult.value;
		logger.info('sitef.entrypoint.fetch_sale.success', {
			salesCount: sales.length,
		});
		rootSpan.addAttribute('sales.count', sales.length);
		rootSpan.addEvent('sales_fetched', { count: sales.length });

		// get items for each sale
		for (const sale of sales) {
			const saleLogger = logger.with({
				saleId: sale.id,
				saleName: sale.name,
				saleUrl: sale.url,
			});

			saleLogger.info('sitef.entrypoint.fetch_item.start');

			const itemResult = await instrument({
				tracer,
				name: 'fetch items from ItemAPI',
				fn: async (span) => {
					span.addAttribute('sale.id', String(sale.id));
					span.addAttribute('sale.name', String(sale.name));
					return ResultAsync.fromPromise(
						fetcher.FetchFromItemAPI(otelCotext, {
							keyword: `this is a demo.`,
							category: 'demo category',
							count: 1,
							offset: 1,
						}),
						(e) => e
					);
				},
				parentSpan: rootSpan,
				rootSpan,
			});

			if (itemResult.isErr()) {
				const error = itemResult.error as any;
				const err = serializeError(error);
				saleLogger.error('sitef.entrypoint.fetch_item.error', {
					error: err,
				});
				rootSpan.recordException(error);
				continue;
			}

			const items = itemResult.value;
			saleLogger.info('sitef.entrypoint.fetch_item.success', {
				itemsCount: items.length,
			});
			rootSpan.addEvent('items_fetched', {
				saleId: String(sale.id),
				count: items.length,
			});

			// check need scraping
			saleLogger.info('sitef.entrypoint.check_need.start', {
				itemsCount: items.length,
			});
			const needScrapingResult = await instrument({
				tracer,
				name: 'check need scraping batch',
				fn: (span) => {
					span.addAttribute('items.input_count', items.length);
					return ResultAsync.fromSafePromise(
						CheckNeedScrapingBatch(
							'f',
							items.map((item) => ({ ...item, sale: sale, env: environment }))
						)
					);
				},
				parentSpan: rootSpan,
				rootSpan,
			});

			if (needScrapingResult.isErr()) {
				const error = needScrapingResult.error as any;
				const err = serializeError(error);
				saleLogger.error('sitef.entrypoint.check_need.error', {
					error: err,
				});
				rootSpan.recordException(error);
				continue;
			}

			const needScrapingItems = needScrapingResult.value;
			saleLogger.info('sitef.entrypoint.check_need.success', {
				totalItems: items.length,
				needScrapingCount: needScrapingItems.length,
			});
			rootSpan.addAttribute('scraping.need_count', needScrapingItems.length);
			rootSpan.addEvent('scraping_need_decided', {
				saleId: String(sale.id),
				total: items.length,
				need: needScrapingItems.length,
			});

			// send to queue
			if (!(needScrapingItems.length > 0)) {
				saleLogger.info('sitef.entrypoint.send_queue.empty', {
					message: 'No items found for sale',
					saleId: sale.id,
				});
				continue;
			}

			const sendBatchResult = await instrument({
				tracer,
				name: 'send items batch to scraping queue',
				fn: (span) => {
					const messages = needScrapingItems.map((item) => ({
						body: {
							...item,
							otelContext: {
								parentSpanId: span.spanId,
								parentTraceId: span.traceId,
							},
							env: environment,
						},
						contentType: 'json' as const,
					}));
					span.addAttribute('queue.batch_size', messages.length);
					span.addEvent('queue_batch_prepared', { size: messages.length });
					return ResultAsync.fromSafePromise(sendBatch(messages));
				},
				parentSpan: rootSpan,
				rootSpan,
			});

			if (sendBatchResult.isErr()) {
				const err = serializeError(sendBatchResult.error as any);
				saleLogger.error('sitef.entrypoint.send_queue.error', {
					error: err,
					batchSize: needScrapingItems.length,
				});
				rootSpan.recordException(sendBatchResult.error);
				rootSpan.addAttribute('queue.error', true);
				continue;
			}

			saleLogger.info('sitef.entrypoint.send_queue.success', {
				batchSize: needScrapingItems.length,
				saleId: sale.id,
			});
			rootSpan.addEvent('queue_batch_sent', {
				saleId: String(sale.id),
				size: needScrapingItems.length,
			});
		}
	} finally {
		rootSpan.addEvent('entrypoint_finishing');
		rootSpan.end();
		await logger.flush();

		const spans = tracer.getCompletedSpans();
		logger.info('sitef.entrypoint.export.start', { spanCount: spans.length });
		await exporter.export(spans);
		logger.info('sitef.entrypoint.export.success', { spanCount: spans.length });

		tracer.clearSpans();
	}
}
