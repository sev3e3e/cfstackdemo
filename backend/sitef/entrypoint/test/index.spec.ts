import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import type { SitefEntrypointDep } from '../src/interfaces';

import { runEntrypoint } from '../src/runEntrypoint';
import type { SitefHiddenAPIResponse, SitefItemAPIResponse } from '@cfstackdemo/sitef-fetcher/interfaces';
import type { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';

describe('Sitef Entrypoint Test', () => {
	let deps: SitefEntrypointDep;
	const mockSales: SitefHiddenAPIResponse = [
		{
			id: 'sale-1',
			name: 'Test Sale',
			url: 'https://example.com/sale1',
			banner_height: 1,
			banner_img: 'https://example.com/bannerimg',
			banner_width: 1,
		},
	];

	const mockItems: SitefItemAPIResponse = [
		{
			id: 'item-1',
			title: 'Test Item',
			maker: { id: 0, name: 'maker1' },
			prices: [{ name: 'price1', price: 100 }],
			sampleImageUrls: ['https://example.com/sampleImage1'],
			sampleMovieUrl: 'https://example.com/samplemovie',
			url: 'https://example.com/item1',
		},
	];

	const mockCNSB: Omit<DEMO_CommonSiteQueueData, 'thumbUrl' | 'otelContext'>[] = [
		{
			id: 'item-1',
			env: 'test',
			sale: { id: 'sale-1', name: 'Test Sale', url: 'https://example.com/sale1' },
			title: 'Test Item',
			url: 'https://example.com/sale1',
		},
	];

	beforeAll(async () => {});

	beforeEach(() => {
		deps = {
			fetcher: {
				FetchSaleFromHiddenAPI: vi.fn().mockResolvedValue(mockSales),
				FetchFromItemAPI: vi.fn().mockResolvedValue(mockItems),
			},
			logger: {
				info: vi.fn(),
				error: vi.fn(),
				with: vi.fn().mockReturnThis(),
				flush: vi.fn().mockResolvedValue(undefined),
			},
			exporter: {
				export: vi.fn().mockResolvedValue(undefined),
			},
			CheckNeedScrapingBatch: vi.fn().mockResolvedValue(mockItems),
			sendBatch: vi.fn().mockResolvedValue(undefined),
			environment: 'test',
		};
	});

	describe('runEntrypoint', () => {
		it('should successfully process sales and items', async () => {
			await runEntrypoint(deps);

			expect(deps.fetcher.FetchSaleFromHiddenAPI).toHaveBeenCalledWith(
				expect.objectContaining({
					traceId: expect.any(String),
					parentSpanId: expect.any(String),
				}),
				1
			);
			expect(deps.fetcher.FetchFromItemAPI).toHaveBeenCalledWith(
				expect.objectContaining({
					traceId: expect.any(String),
					parentSpanId: expect.any(String),
				}),
				{
					keyword: 'this is a demo.',
					category: 'demo category',
					count: 1,
					offset: 1,
				}
			);
			expect(deps.CheckNeedScrapingBatch).toHaveBeenCalledWith('f', expect.any(Array));
			expect(deps.sendBatch).toHaveBeenCalled();
			expect(deps.logger.flush).toHaveBeenCalled();
		});

		it('should handle sale fetch error', async () => {
			const mockError = new Error('Sale fetch failed');

			vi.mocked(deps.fetcher.FetchSaleFromHiddenAPI).mockRejectedValueOnce(mockError);

			await runEntrypoint(deps);

			expect(deps.logger.error).toHaveBeenCalledWith('sitef.entrypoint.fetch_sale.error', expect.anything());
			expect(deps.fetcher.FetchFromItemAPI).not.toHaveBeenCalled();
		});

		it('should handle item fetch error and not continue processing', async () => {
			const mockError = new Error('Item fetch failed');

			vi.mocked(deps.fetcher.FetchFromItemAPI).mockRejectedValueOnce(mockError);

			await runEntrypoint(deps);

			expect(deps.CheckNeedScrapingBatch).not.toHaveBeenCalled();
		});

		it('should handle scraping check error and not continue processing', async () => {
			const mockError = new Error('Scraping check failed');

			vi.mocked(deps.CheckNeedScrapingBatch).mockRejectedValueOnce(mockError);

			await runEntrypoint(deps);

			expect(deps.logger.error).toHaveBeenCalledWith('sitef.entrypoint.check_need.error', expect.anything());
			expect(deps.sendBatch).not.toHaveBeenCalled();
		});

		it('should skip sending when no items need scraping', async () => {
			vi.mocked(deps.fetcher.FetchFromItemAPI).mockResolvedValueOnce([]);
			vi.mocked(deps.CheckNeedScrapingBatch).mockResolvedValueOnce([]);

			await runEntrypoint(deps);

			expect(deps.logger.info).toHaveBeenCalledWith('sitef.entrypoint.send_queue.empty', expect.anything());
			expect(deps.sendBatch).not.toHaveBeenCalled();
		});

		it('should handle queue send error and continue processing', async () => {
			const mockError = new Error('Queue send failed');

			vi.mocked(deps.sendBatch).mockRejectedValueOnce(mockError);

			await runEntrypoint(deps);

			expect(deps.logger.error).toHaveBeenCalledWith('sitef.entrypoint.send_queue.error', expect.anything());
		});

		it('should process multiple sales', async () => {
			const _mockSales: SitefHiddenAPIResponse = [
				...mockSales,
				{
					id: 'sale-2',
					name: 'Test Sale',
					url: 'https://example.com/sale2',
					banner_height: 2,
					banner_img: 'https://example.com/bannerimg',
					banner_width: 2,
				},
			];

			// Override methods for this test
			vi.mocked(deps.fetcher.FetchSaleFromHiddenAPI).mockResolvedValueOnce(_mockSales);

			await runEntrypoint(deps);

			expect(deps.fetcher.FetchFromItemAPI).toHaveBeenCalledTimes(2);
			expect(deps.CheckNeedScrapingBatch).toHaveBeenCalledTimes(2);
			expect(deps.sendBatch).toHaveBeenCalledTimes(2);
		});

		it('should include otelContext and environment in queue messages', async () => {
			await runEntrypoint(deps);

			expect(deps.sendBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						body: expect.objectContaining({
							otelContext: expect.objectContaining({
								parentSpanId: expect.any(String),
								parentTraceId: expect.any(String),
							}),
							env: 'test',
						}),
						contentType: 'json',
					}),
				])
			);
		});

		it('should continue processing other sales when item fetch fails for one sale', async () => {
			const multipleSales = [
				...mockSales,
				{
					id: 'sale-2',
					name: 'Test Sale 2',
					url: 'https://example.com/sale2',
					banner_height: 2,
					banner_img: 'https://example.com/bannerimg2',
					banner_width: 2,
				},
			];

			const mockError = new Error('Item fetch failed for sale-1');

			// Override methods for this test
			vi.mocked(deps.fetcher.FetchSaleFromHiddenAPI).mockResolvedValueOnce(multipleSales);
			vi.mocked(deps.fetcher.FetchFromItemAPI).mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockItems);
			vi.mocked(deps.CheckNeedScrapingBatch).mockResolvedValueOnce(mockCNSB);

			await runEntrypoint(deps);

			// First sale should fail and log error
			expect(deps.logger.error).toHaveBeenCalledWith('sitef.entrypoint.fetch_item.error', expect.anything());

			// Second sale should succeed
			expect(deps.fetcher.FetchFromItemAPI).toHaveBeenCalledTimes(2);
			expect(deps.CheckNeedScrapingBatch).toHaveBeenCalledTimes(1);
			expect(deps.sendBatch).toHaveBeenCalledTimes(1);
		});

		it('should continue processing other sales when scraping check fails for one sale', async () => {
			const multipleSales = [
				...mockSales,
				{
					id: 'sale-2',
					name: 'Test Sale 2',
					url: 'https://example.com/sale2',
					banner_height: 2,
					banner_img: 'https://example.com/bannerimg2',
					banner_width: 2,
				},
			];

			const mockError = new Error('Scraping check failed for sale-1');

			// Override methods for this test
			vi.mocked(deps.fetcher.FetchSaleFromHiddenAPI).mockResolvedValueOnce(multipleSales);
			vi.mocked(deps.fetcher.FetchFromItemAPI).mockResolvedValue(mockItems);
			vi.mocked(deps.CheckNeedScrapingBatch).mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockCNSB);

			await runEntrypoint(deps);

			// First sale should fail scraping check and log error
			expect(deps.logger.error).toHaveBeenCalledWith('sitef.entrypoint.check_need.error', expect.anything());

			// Both sales should fetch items
			expect(deps.fetcher.FetchFromItemAPI).toHaveBeenCalledTimes(2);
			// Scraping check should be called twice (first fails, second succeeds)
			expect(deps.CheckNeedScrapingBatch).toHaveBeenCalledTimes(2);
			// Only second sale should send batch
			expect(deps.sendBatch).toHaveBeenCalledTimes(1);
		});

		it('should continue processing other sales when queue send fails for one sale', async () => {
			const multipleSales = [
				...mockSales,
				{
					id: 'sale-2',
					name: 'Test Sale 2',
					url: 'https://example.com/sale2',
					banner_height: 2,
					banner_img: 'https://example.com/bannerimg2',
					banner_width: 2,
				},
			];

			const mockError = new Error('Queue send failed for sale-1');

			// Override methods for this test
			vi.mocked(deps.fetcher.FetchSaleFromHiddenAPI).mockResolvedValueOnce(multipleSales);
			vi.mocked(deps.fetcher.FetchFromItemAPI).mockResolvedValue(mockItems);
			vi.mocked(deps.CheckNeedScrapingBatch).mockResolvedValue(mockCNSB);
			vi.mocked(deps.sendBatch).mockRejectedValueOnce(mockError).mockResolvedValueOnce(undefined);

			await runEntrypoint(deps);

			// First sale should fail queue send and log error
			expect(deps.logger.error).toHaveBeenCalledWith('sitef.entrypoint.send_queue.error', expect.anything());

			// Second sale should succeed and log success
			expect(deps.logger.info).toHaveBeenCalledWith('sitef.entrypoint.send_queue.success', expect.anything());

			// Both sales should be processed completely
			expect(deps.fetcher.FetchFromItemAPI).toHaveBeenCalledTimes(2);
			expect(deps.CheckNeedScrapingBatch).toHaveBeenCalledTimes(2);
			expect(deps.sendBatch).toHaveBeenCalledTimes(2);
		});
	});
});
