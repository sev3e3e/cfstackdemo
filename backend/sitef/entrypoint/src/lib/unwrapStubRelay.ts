import { RelaySitefFetcher } from '@cfstackdemo/sitef-fetcher';
import { SitefFetcherLike } from '../interfaces';
import { ResultAsync } from 'neverthrow';

export class RelaySitefFetcherWrapper implements SitefFetcherLike {
	constructor(private readonly stub: Rpc.Stub<RelaySitefFetcher>) {}

	async FetchSaleFromHiddenAPI(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		count = 1
	) {
		return this.stub.FetchSaleFromHiddenAPI(otelContext, count);
	}

	async FetchFromItemAPI(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		props: { keyword: string; category: string; count: number; offset: number }
	) {
		return this.stub.FetchFromItemAPI(otelContext, props);
	}

	async fetchDetailPage(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		url: string
	) {
		return this.stub.fetchDetailPage(otelContext, url);
	}
}

export function unwrapRelayFetcherStub(stub: Rpc.Stub<RelaySitefFetcher>) {
	return new RelaySitefFetcherWrapper(stub);
}
