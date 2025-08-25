import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from 'neverthrow';
import type { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';
import type { SitefMainDep } from '../src/interfaces';
import { runMain } from '../src/runMain';

// Mock dependencies
vi.mock('@cfstackdemo/sitef-scraper', () => ({
	ScrapeItem: vi.fn(),
}));

vi.mock('@cfstackdemo/lightweight-otel-sdk', () => ({
	Tracer: vi.fn().mockImplementation(() => ({
		startSpan: vi.fn().mockReturnValue({
			spanId: 'test-span-id',
			traceId: 'test-trace-id',
			recordException: vi.fn(),
			end: vi.fn(),
		}),
		getCompletedSpans: vi.fn().mockReturnValue([]),
		clearSpans: vi.fn(),
	})),
	ATTR_SERVICE_NAME: 'service.name',
	ATTR_SERVICE_VERSION: 'service.version',
}));

describe('exec function', () => {
	let mockDeps: SitefMainDep;
	let mockMsg: DEMO_CommonSiteQueueData;

	beforeEach(() => {
		vi.clearAllMocks();

		mockDeps = {
			fetcher: {
				fetchDetailPage: vi.fn(),
			},
			logger: {
				info: vi.fn(),
				error: vi.fn(),
				with: vi.fn().mockReturnThis(),
				flush: vi.fn(),
			},
			exporter: {
				export: vi.fn(),
			},
			saveToD1: vi.fn(),
			savePriceHistory: vi.fn(),
		};

		mockMsg = {
			env: 'development',
			id: 'test-item-123',
			title: 'Test Item Title',
			url: 'https://example.com/item/123',
			sale: {
				id: 'sale-456',
				name: 'Test Sale',
				url: 'https://example.com/sale/456',
			},
			otelContext: {
				parentSpanId: 'parent-span-id',
				parentTraceId: 'parent-trace-id',
			},
		};
	});

	describe('successful execution', () => {
		it('should successfully fetch, scrape, and save data', async () => {
			const mockScrapedData = {
				description: 'Test item description',
				thumbUrl: 'https://example.com/thumb.jpg',
				maker: {
					id: 'maker-1',
					name: 'Test Maker',
				},
				reviews: [
					{
						reviewId: 'review-1',
						title: 'Great product',
						body: 'Really enjoyed this item',
						rating: 5,
						createdAt: '2023-01-01',
						reviewer: { id: 'user-1', name: 'Test User' },
					},
				],
				samples: ['sample1.jpg', 'sample2.jpg'],
				prices: [
					{
						name: 'Regular',
						normalPrice: 1000,
						salePrice: 800,
					},
				],
			};

			// Mock successful fetcher response
			vi.mocked(mockDeps.fetcher.fetchDetailPage).mockResolvedValue('<html>mock html</html>');

			// Mock successful scraping
			const { ScrapeItem } = await import('@cfstackdemo/sitef-scraper');
			vi.mocked(ScrapeItem).mockResolvedValue(ok(mockScrapedData));

			// Mock successful save operations
			vi.mocked(mockDeps.saveToD1).mockResolvedValue();
			vi.mocked(mockDeps.savePriceHistory).mockResolvedValue();

			await runMain(mockDeps, mockMsg);

			// Verify fetcher was called with additional-info URL
			expect(mockDeps.fetcher.fetchDetailPage).toHaveBeenCalledWith(
				{
					parentSpanId: 'test-span-id',
					traceId: 'test-trace-id',
				},
				'https://example.com/item/123/additional-info',
			);

			// Verify scraping was called
			expect(ScrapeItem).toHaveBeenCalledWith('<html>mock html</html>');

			// Verify D1 save was called with correct data
			expect(mockDeps.saveToD1).toHaveBeenCalledWith(
				{
					site: 'f',
					item: {
						description: mockScrapedData.description,
						siteSpecificId: mockMsg.id,
						title: mockMsg.title,
						url: mockMsg.url,
						thumbUrl: mockScrapedData.thumbUrl,
					},
					reviews: [
						{
							body: mockScrapedData.reviews[0].body,
							createdAt: mockScrapedData.reviews[0].createdAt,
							id: mockScrapedData.reviews[0].reviewId,
							rating: mockScrapedData.reviews[0].rating,
							reviewer: mockScrapedData.reviews[0].reviewer,
							title: mockScrapedData.reviews[0].title,
						},
					],
					samples: mockScrapedData.samples,
				},
				expect.objectContaining({
					parentSpanId: expect.any(String),
					parentTraceId: expect.any(String),
				}),
			);

			// Verify price history save was called
			expect(mockDeps.savePriceHistory).toHaveBeenCalledWith(
				{
					site: 'f',
					id: mockMsg.id,
					data: {
						date: expect.any(String),
						prices: mockScrapedData.prices,
						sale: mockMsg.sale,
					},
				},
				expect.objectContaining({
					parentSpanId: expect.any(String),
					parentTraceId: expect.any(String),
				}),
			);

			// Verify logger was flushed
			expect(mockDeps.logger.flush).toHaveBeenCalled();

			// Verify exporter was called
			expect(mockDeps.exporter.export).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should handle fetcher error gracefully', async () => {
			const mockError = new Error('Fetch failed');
			vi.mocked(mockDeps.fetcher.fetchDetailPage).mockImplementation(() => {
				throw mockError;
			});

			await runMain(mockDeps, mockMsg);

			// Should log error
			expect(mockDeps.logger.error).toHaveBeenCalled();

			// Should not proceed to save operations
			expect(mockDeps.saveToD1).not.toHaveBeenCalled();
			expect(mockDeps.savePriceHistory).not.toHaveBeenCalled();

			// Should still flush logger and export spans
			expect(mockDeps.logger.flush).toHaveBeenCalled();
			expect(mockDeps.exporter.export).toHaveBeenCalled();
		});

		it('should handle scraping error gracefully', async () => {
			const mockScrapingError = new Error('Scraping failed');

			// Mock successful fetcher response
			vi.mocked(mockDeps.fetcher.fetchDetailPage).mockResolvedValue('<html>mock html</html>');

			// Mock failed scraping
			const { ScrapeItem } = await import('@cfstackdemo/sitef-scraper');
			vi.mocked(ScrapeItem).mockResolvedValue(err(mockScrapingError));

			await runMain(mockDeps, mockMsg);

			// Should log error
			expect(mockDeps.logger.error).toHaveBeenCalled();

			// Should not proceed to save operations
			expect(mockDeps.saveToD1).not.toHaveBeenCalled();
			expect(mockDeps.savePriceHistory).not.toHaveBeenCalled();

			// Should still flush logger and export spans
			expect(mockDeps.logger.flush).toHaveBeenCalled();
			expect(mockDeps.exporter.export).toHaveBeenCalled();
		});

		it('should handle D1 save error gracefully', async () => {
			const mockScrapedData = {
				description: 'Test item description',
				thumbUrl: 'https://example.com/thumb.jpg',
				maker: { id: 'maker-1', name: 'Test Maker' },
				reviews: [],
				samples: [],
				prices: [],
			};

			// Mock successful fetcher and scraping
			vi.mocked(mockDeps.fetcher.fetchDetailPage).mockResolvedValue('<html>mock html</html>');

			const { ScrapeItem } = await import('@cfstackdemo/sitef-scraper');
			vi.mocked(ScrapeItem).mockResolvedValue(ok(mockScrapedData));

			// Mock D1 save failure
			const d1Error = new Error('D1 save failed');
			vi.mocked(mockDeps.saveToD1).mockRejectedValue(d1Error);
			vi.mocked(mockDeps.savePriceHistory).mockResolvedValue();

			await runMain(mockDeps, mockMsg);

			// Should log error
			expect(mockDeps.logger.error).toHaveBeenCalled();

			// Should NOT attempt to save price history when D1 fails
			expect(mockDeps.savePriceHistory).not.toHaveBeenCalled();

			// Should still flush logger and export spans
			expect(mockDeps.logger.flush).toHaveBeenCalled();
			expect(mockDeps.exporter.export).toHaveBeenCalled();
		});

		it('should handle unexpected errors in try block', async () => {
			// Mock fetcher that throws unexpected error
			vi.mocked(mockDeps.fetcher.fetchDetailPage).mockImplementation(() => {
				throw new Error('Unexpected error');
			});

			await runMain(mockDeps, mockMsg);

			// Should log unexpected error
			expect(mockDeps.logger.error).toHaveBeenCalled();

			// Should not proceed to save operations
			expect(mockDeps.saveToD1).not.toHaveBeenCalled();
			expect(mockDeps.savePriceHistory).not.toHaveBeenCalled();

			// Should still flush logger and export spans
			expect(mockDeps.logger.flush).toHaveBeenCalled();
			expect(mockDeps.exporter.export).toHaveBeenCalled();
		});
	});

	describe('tracing', () => {
		it('should create and manage OpenTelemetry spans correctly', async () => {
			const mockScrapedData = {
				description: 'Test',
				thumbUrl: 'https://example.com/thumb.jpg',
				maker: { id: 'maker-1', name: 'Test Maker' },
				reviews: [],
				samples: [],
				prices: [],
			};

			vi.mocked(mockDeps.fetcher.fetchDetailPage).mockResolvedValue('<html>mock html</html>');

			const { ScrapeItem } = await import('@cfstackdemo/sitef-scraper');
			vi.mocked(ScrapeItem).mockResolvedValue(ok(mockScrapedData));

			vi.mocked(mockDeps.saveToD1).mockResolvedValue();
			vi.mocked(mockDeps.savePriceHistory).mockResolvedValue();

			const { Tracer } = await import('@cfstackdemo/lightweight-otel-sdk');

			await runMain(mockDeps, mockMsg);

			const mockTracer = vi.mocked(Tracer).mock.results[0].value; // 後でアクセス

			// Verify tracer was created with correct attributes
			expect(Tracer).toHaveBeenCalledWith({
				'service.name': 'sitef-main',
				'service.version': '0.0.0',
			});

			// Verify span was started with correct parameters
			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'sitef main worker',
				mockMsg.otelContext.parentTraceId,
				mockMsg.otelContext.parentSpanId,
			);

			// Verify span was ended
			expect(mockTracer.startSpan().end).toHaveBeenCalled();

			// Verify spans were cleared
			expect(mockTracer.clearSpans).toHaveBeenCalled();
		});
	});
});
