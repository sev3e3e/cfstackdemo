import { OtelContext, Tracer } from '@cfstackdemo/lightweight-otel-sdk';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@cfstackdemo/lightweight-otel-sdk/const';
import { serializeError } from '@cfstackdemo/utility';
import type { SitefMainDep } from './interfaces';
import type { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';
import { ScrapeItem } from '@cfstackdemo/sitef-scraper';
import { ResultAsync } from 'neverthrow';

export async function runMain(deps: SitefMainDep, msg: DEMO_CommonSiteQueueData) {
	const SERVICE_NAME = 'sitef-main';
	const SERVICE_VERSION = '0.0.0';

	const { fetcher, saveToD1, savePriceHistory, exporter } = deps;

	// MARK: init otel tracer
	const tracer = new Tracer({
		[ATTR_SERVICE_NAME]: SERVICE_NAME,
		[ATTR_SERVICE_VERSION]: SERVICE_VERSION,
	});

	// MARK: create root span
	const rootSpan = tracer.startSpan('sitef main worker', msg.otelContext.parentTraceId, msg.otelContext.parentSpanId);

	const logger = deps.logger.with({ traceId: rootSpan.traceId, worker: 'sitef-main' });

	const otelContext = {
		traceId: rootSpan.traceId,
		parentSpanId: rootSpan.spanId,
	};

	try {
		// MARK: get data more
		logger.info('sitef.main.fetch_additional_info.start', { id: msg.id, url: msg.url });
		const additionalInfoUrl = msg.url + '/additional-info';

		const addInfoResult = await ResultAsync.fromPromise(fetcher.fetchDetailPage(otelContext, additionalInfoUrl), (e) => e);
		if (addInfoResult.isErr()) {
			logger.error('sitef.main.fetch_additional_info.failed', {
				error: serializeError(addInfoResult.error),
				id: msg.id,
				url: msg.url,
			});
			rootSpan.recordException(addInfoResult.error);
			return;
		}
		logger.info('sitef.main.fetch_additional_info.success', { id: msg.id });

		const addInfoHtml = addInfoResult.value;

		// scrape
		logger.info('sitef.main.scrape_item.start', { id: msg.id });
		const scrapeResult = await ScrapeItem(addInfoHtml);
		if (scrapeResult.isErr()) {
			logger.error('sitef.main.scrape_item.failed', {
				error: serializeError(scrapeResult.error),
				id: msg.id,
				url: msg.url,
			});
			rootSpan.recordException(scrapeResult.error);
			return;
		}
		logger.info('sitef.main.scrape_item.success', { id: msg.id });

		const scrapedData = scrapeResult.value;

		// save to D1
		logger.info('sitef.main.save_d1.start', {
			id: msg.id,
			reviewCount: scrapedData.reviews.length,
			sampleCount: scrapedData.samples.length,
		});
		const saveAllResult = await ResultAsync.fromPromise(
			saveToD1(
				{
					site: 'f',
					item: {
						description: scrapedData.description,
						siteSpecificId: msg.id,
						title: msg.title,
						url: msg.url,
						thumbUrl: scrapedData.thumbUrl,
					},
					reviews: scrapedData.reviews.map((r) => ({
						body: r.body,
						createdAt: r.createdAt,
						id: r.reviewId,
						rating: r.rating,
						reviewer: r.reviewer,
						title: r.title,
					})),
					samples: scrapedData.samples,
				},
				{ parentSpanId: rootSpan.spanId, parentTraceId: rootSpan.traceId }
			),
			(e) => e
		);

		if (saveAllResult.isErr()) {
			logger.error('sitef.main.save_d1.failed', {
				error: serializeError(saveAllResult.error),
				id: msg.id,
			});
			rootSpan.recordException(saveAllResult.error);
			return;
		}
		logger.info('sitef.main.save_d1.success', { id: msg.id });

		// save to R2
		logger.info('sitef.main.save_r2.start', { id: msg.id });
		await savePriceHistory(
			{
				site: 'f',
				id: msg.id,
				data: {
					date: new Date().toString(),
					prices: scrapedData.prices,
					sale: msg.sale,
				},
			},
			{
				parentSpanId: rootSpan.spanId,
				parentTraceId: rootSpan.traceId,
			}
		);
		logger.info('sitef.main.save_r2.success', { id: msg.id });
	} catch (e) {
		logger.error('sitef.main.unexpected_error', {
			error: serializeError(e),
			id: msg.id,
			url: msg.url,
		});
	} finally {
		rootSpan.end();
		await logger.flush();

		const spans = tracer.getCompletedSpans();
		await exporter.export(spans);

		tracer.clearSpans();
	}
}
