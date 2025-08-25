import { RelaySitefFetcher } from '@cfstackdemo/sitef-fetcher';
import { SitefFetcherLike } from '../interfaces';

type OtelContext = {
	traceId: string;
	parentSpanId: string;
};

export class RelaySitefFetcherWrapper implements SitefFetcherLike {
	constructor(private readonly stub: Rpc.Stub<RelaySitefFetcher>) {}

	async FetchSaleFromHiddenAPI(otelContext: OtelContext, count = 1) {
		return this.stub.FetchSaleFromHiddenAPI(otelContext, count);
	}

	async FetchFromItemAPI(otelContext: OtelContext, props: { keyword: string; category: string; count: number; offset: number }) {
		return this.stub.FetchFromItemAPI(otelContext, props);
	}

	async fetchDetailPage(otelContext: OtelContext, url: string) {
		return this.stub.fetchDetailPage(otelContext, url);
	}
}

export function unwrapRelayFetcherStub(stub: Rpc.Stub<RelaySitefFetcher>) {
	return new RelaySitefFetcherWrapper(stub);
}
