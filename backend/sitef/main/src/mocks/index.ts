import { ResultAsync } from 'neverthrow';

import type { FetcherConfig } from '@cfstackdemo/sitef-fetcher';

import type { SitefFetcherLike } from '../interfaces';

// SitefFetcherと互換になるようにmock実装
export class MockSitefFetcher implements SitefFetcherLike {
	config: FetcherConfig;
	sharedHeader: Record<string, string>;

	constructor(config: FetcherConfig) {
		this.config = config;
		this.sharedHeader = {};
	}

	async fetch(params: { url: string; method?: string; body?: string; headers?: Record<string, string> }) {
		return ResultAsync.fromPromise(Promise.resolve({} as Response), (e) => e);
	}

	async fetchDetailPage(params: { url: string; method?: string; body?: string; headers?: Record<string, string> }) {
		return ResultAsync.fromPromise(
			Promise.resolve(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Empty</title>
</head>
<body>
</body>
</html>`),
			(e) => e
		);
	}
}
