import { DirectSitefFetcher } from '@cfstackdemo/sitef-fetcher';
import { SitefFetcherLike } from '../interfaces';

export class DirectSitefFetcherWrapper implements SitefFetcherLike {
	constructor(private readonly stub: Rpc.Stub<DirectSitefFetcher>) {}

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

export function unwrapDirectFetcherStub(stub: Rpc.Stub<DirectSitefFetcher>) {
	return new DirectSitefFetcherWrapper(stub);
}
