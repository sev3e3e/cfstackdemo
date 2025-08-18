import { RpcTarget } from 'cloudflare:workers';
import type { LoggerLike, SitefFetcherLike, SitefHiddenAPIResponse, SitefItemAPIResponse } from './interfaces';
import { ResultAsync } from 'neverthrow';

export class RelaySitefFetcher extends RpcTarget implements SitefFetcherLike {
	constructor(
		private logger: LoggerLike,
		private _fetch: typeof fetch,
		private getOrCreateJwt: (
			traceId: string,
			parentSpanId: string
		) => Promise<
			| {
					id: number;
					key: string;
					expiresAt: string;
					createdAt: Date;
					updatedAt: Date;
			  }
			| undefined
		>,
		private endpoint: {
			proxy: string;
			hiddenSale: string;
			item: string;
			detail: string;
		}
	) {
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
		const logger = this.logger.with({ traceId, worker: 'sitef-fetcher' });
		const startTime = Date.now();
		// const targetUrl = `https://cfstackdemo-mock-web-server.ripfirem-cloudflare.workers.dev/sitef/hidden-sale-api?count=${count}`;
		const targetUrl = `${this.endpoint.hiddenSale}?count=${count}`;

		logger.info('relayfetcher.sitef.relay.api.hidden_sale.start', {
			targetUrl: targetUrl,
			method: 'GET',
			count,
			relayEndpoint: this.endpoint.proxy,
		});

		logger.info('relayfetcher.sitef.relay.jwt.start', {
			traceId,
			parentSpanId,
		});

		const jwt = await this.getOrCreateJwt(traceId, parentSpanId);

		if (!jwt) {
			logger.error('relayfetcher.sitef.relay.jwt.error');
			throw new Error('jwt undefined');
		}

		const result = await ResultAsync.fromPromise(
			this._fetch(this.endpoint.proxy, {
				method: 'POST',
				body: JSON.stringify({ url: targetUrl, method: 'GET' }),
				headers: {
					Authorization: `Bearer ${jwt.key}`,
					'Content-Type': 'application/json',
				},
			}),
			(e) => {
				logger.error('relayfetcher.sitef.api.hidden_sale.error', {
					targetUrl: targetUrl,
					error: e,
					duration: Date.now() - startTime,
				});
				return e;
			}
		);

		if (result.isErr()) {
			throw result.error;
		}

		logger.info('relayfetcher.sitef.relay.jwt.success');

		const res = result.value;
		if (res.status !== 200) {
			logger.error('relayfetcher.sitef.api.hidden_sale.http_error', {
				targetUrl: targetUrl,
				status: res.status,
				statusText: res.statusText,
				duration: Date.now() - startTime,
			});
			throw new Error(`relay error: ${res.status}`);
		}

		logger.info('relayfetcher.sitef.api.hidden_sale.complete', {
			targetUrl: targetUrl,
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
		const logger = this.logger.with({ traceId, worker: 'sitef-fetcher' });

		const startTime = Date.now();
		// const targetUrl = 'https://cfstackdemo-mock-web-server.ripfirem-cloudflare.workers.dev/sitef/api/item';
		const targetUrl = this.endpoint.item;

		logger.info('relayfetcher.sitef.api.item.start', { keyword: props.keyword });

		const queryParams = new URLSearchParams({
			keyword: props.keyword,
			category: props.category,
			count: props.count.toString(),
			offset: props.offset.toString(),
		});

		const jwt = await this.getOrCreateJwt(traceId, parentSpanId);

		if (!jwt) {
			logger.error('relayfetcher.sitef.jwt.error');
			throw new Error('jwt undefined');
		}

		const fullUrl = `${targetUrl}?${queryParams.toString()}`;

		const result = await ResultAsync.fromPromise(
			this._fetch(this.endpoint.proxy, {
				method: 'POST',
				body: JSON.stringify({
					url: fullUrl,
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				}),
				headers: {
					Authorization: `Bearer ${jwt.key}`,
					'Content-Type': 'application/json',
				},
			}),
			(e) => {
				logger.error('relayfetcher.sitef.api.item.error', {
					error: e,
					duration: Date.now() - startTime,
				});
				return e;
			}
		);

		if (result.isErr()) {
			throw result.error;
		}

		const res = result.value;
		if (res.status !== 200) {
			logger.error('relayfetcher.sitef.api.item.http_error', {
				status: res.status,
				duration: Date.now() - startTime,
			});
			throw new Error(`relay error: ${res.status}`);
		}

		logger.info('relayfetcher.sitef.api.item.complete', {
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

		const logger = this.logger.with({ traceId, worker: 'sitef-fetcher' });

		// const targetUrl = 'https://cfstackdemo-mock-web-server.ripfirem-cloudflare.workers.dev/sitef/item/detail';
		const targetUrl = this.endpoint.detail;

		const jwt = await this.getOrCreateJwt(traceId, parentSpanId);

		if (!jwt) {
			logger.error('relayfetcher.sitef.jwt.error');
			throw new Error('jwt undefined');
		}

		const result = await ResultAsync.fromPromise(
			this._fetch(this.endpoint.proxy, {
				method: 'POST',
				body: JSON.stringify({
					url: targetUrl,
				}),
				headers: {
					Authorization: `Bearer ${jwt.key}`,
					'Content-Type': 'application/json',
				},
			}),
			(e) => e
		);

		if (result.isErr()) {
			throw result.error;
		}

		return result.value.text();
	}
}
