import { RelaySitefFetcher } from '@cfstackdemo/sitef-fetcher';
import { SitefFetcherLike } from '../interfaces';
import { ResultAsync } from 'neverthrow';

export class RelaySitefFetcherWrapper implements SitefFetcherLike {
	constructor(private readonly stub: Rpc.Stub<RelaySitefFetcher>) {}

	async FetchSaleFromHiddenAPI(count = 1) {
		return ResultAsync.fromPromise(this.stub.FetchSaleFromHiddenAPI(count), (e) => e);
	}

	async FetchFromItemAPI(props: { keyword: string; category: string; count: number; offset: number }) {
		return ResultAsync.fromPromise(this.stub.FetchFromItemAPI(props), (e) => e);
	}

	async fetchDetailPage(url: string) {
		return ResultAsync.fromPromise(this.stub.fetchDetailPage(url), (e) => e);
	}
}

export function unwrapRelayFetcherStub(stub: Rpc.Stub<RelaySitefFetcher>) {
	return new RelaySitefFetcherWrapper(stub);
}
