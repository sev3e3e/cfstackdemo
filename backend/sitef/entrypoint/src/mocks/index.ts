import { ResultAsync } from 'neverthrow';

import type { SitefHiddenAPIResponse, SitefItemAPIResponse, FetcherConfig } from '@cfstackdemo/sitef-fetcher';

import { faker } from '@faker-js/faker/locale/en';
import type { SitefFetcherLike } from '../interfaces';

// SitefFetcherと互換になるようにmock実装
export class MockSitefFetcher implements SitefFetcherLike {
	config: FetcherConfig;
	sharedHeader: Record<string, string>;

	constructor(config: FetcherConfig) {
		this.config = config;
		this.sharedHeader = {};
	}

	async FetchSaleFromHiddenAPI(count?: number): Promise<ResultAsync<SitefHiddenAPIResponse, unknown>> {
		return ResultAsync.fromPromise(
			Promise.resolve(
				Array.from({ length: count ?? 1 }, () => ({
					id: faker.string.uuid(),
					url: faker.internet.url(),
					name: `sale-${faker.number.int({ min: 0, max: 100 })}`,
					banner_img: faker.image.url(),
					banner_width: faker.number.int({ min: 800, max: 1920 }),
					banner_height: faker.number.int({ min: 400, max: 1080 }),
				}))
			),
			(e) => e
		);
	}

	async FetchFromItemAPI(props: {
		keyword: string;
		category: string;
		count: number;
		offset: number;
	}): Promise<ResultAsync<SitefItemAPIResponse, unknown>> {
		const count = props.count;

		return ResultAsync.fromPromise(
			Promise.resolve(
				Array.from({ length: count }, () => ({
					id: faker.string.uuid(),
					title: faker.commerce.productName(),
					url: faker.internet.url(),
					sampleImageUrls: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.image.url()),
					sampleMovieUrl: faker.internet.url({ appendSlash: false }) + '.mp4',
					prices: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => ({
						name: faker.commerce.department(),
						price: faker.number.int({ min: 100, max: 50000 }),
					})),
					maker: {
						id: faker.number.int({ min: 1, max: 1000 }),
						name: faker.company.name(),
					},
				}))
			),
			(e) => e
		);
	}

	async _exec(params: { url: string; method?: string; body?: string; headers?: Record<string, string> }) {
		return ResultAsync.fromPromise(Promise.resolve({} as Response), (e) => e);
	}
}
