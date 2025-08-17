import { RpcTarget } from 'cloudflare:workers';
import type { LoggerLike, SitefFetcherLike, SitefHiddenAPIResponse, SitefItemAPIResponse } from './interfaces';
import { ResultAsync } from 'neverthrow';

export class DirectSitefFetcher extends RpcTarget implements SitefFetcherLike {
	constructor(private logger: LoggerLike, private _fetch: typeof fetch) {
		super();
	}

	async FetchSaleFromHiddenAPI(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		count = 1
	) {
		const { parentSpanId, traceId } = otelContext;
		const logger = this.logger.with({ traceId });

		const startTime = Date.now();
		const url = `https://cfstackdemo-mock-web-server.ripfirem-cloudflare.workers.dev/sitef/hidden-sale-api?count=${count}`;

		logger.info('sitef.api.hidden_sale.start', {
			targetUrl: new URL(url).hostname,
			method: 'GET',
			count,
		});

		const result = await ResultAsync.fromPromise(this._fetch(url, { method: 'GET' }), (e) => {
			logger.error('sitef.api.hidden_sale.error', {
				targetUrl: new URL(url).hostname,
				error: e,
				duration: Date.now() - startTime,
			});
			return e;
		});

		if (result.isErr()) {
			throw result.error;
		}

		const res = result.value;
		if (res.status !== 200) {
			logger.error('sitef.api.hidden_sale.http_error', {
				targetUrl: new URL(url).hostname,
				status: res.status,
				statusText: res.statusText,
				duration: Date.now() - startTime,
			});
			throw new Error(`direct error: ${res.status}`);
		}

		logger.info('sitef.api.hidden_sale.complete', {
			targetUrl: new URL(url).hostname,
			status: res.status,
			duration: Date.now() - startTime,
		});

		return (await res.json()) as SitefHiddenAPIResponse;
	}

	async FetchFromItemAPI(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		props: { keyword: string; category: string; count: number; offset: number }
	) {
		const { parentSpanId, traceId } = otelContext;
		const logger = this.logger.with({ traceId });

		const startTime = Date.now();
		const url = 'https://cfstackdemo-mock-web-server.ripfirem-cloudflare.workers.dev/sitef/api/item';

		logger.info('sitef.api.item.start', { keyword: props.keyword });

		const queryParams = new URLSearchParams({
			keyword: props.keyword,
			category: props.category,
			count: props.count.toString(),
			offset: props.offset.toString(),
		});

		const fullUrl = `${url}?${queryParams.toString()}`;

		const result = await ResultAsync.fromPromise(
			this._fetch(fullUrl, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			}),
			(e) => {
				logger.error('sitef.api.item.error', {
					error: e,
					duration: Date.now() - startTime,
				});
				return e;
			}
		);

		if (result.isErr()) throw result.error;

		const res = result.value;
		if (res.status !== 200) {
			logger.error('sitef.api.item.http_error', {
				status: res.status,
				duration: Date.now() - startTime,
			});
			throw new Error(`direct error: ${res.status}`);
		}

		logger.info('sitef.api.item.complete', {
			status: res.status,
			duration: Date.now() - startTime,
		});
		return (await res.json()) as SitefItemAPIResponse;
	}

	async fetchDetailPage(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		url: string
	) {
		const { parentSpanId, traceId } = otelContext;
		const logger = this.logger.with({ traceId });

		const targetUrl = 'https://cfstackdemo-mock-web-server.ripfirem-cloudflare.workers.dev/sitef/item/detail';

		const result = await ResultAsync.fromPromise(
			this._fetch(targetUrl, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			}),
			(e) => e
		);

		if (result.isErr()) throw result.error;

		return result.value.text();
	}
}
