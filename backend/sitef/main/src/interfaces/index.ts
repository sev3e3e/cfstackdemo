import type { Exporter } from '@cfstackdemo/lightweight-otel-sdk';
import { SitefFetcherLike as _SitefFetcherLike } from '@cfstackdemo/sitef-fetcher/interfaces';

export interface SitefFetcherLike extends Omit<_SitefFetcherLike, 'FetchSaleFromHiddenAPI' | 'FetchFromItemAPI'> {}

export interface SaveAllInput {
	site: 'f';
	item: {
		description: string;
		siteSpecificId: string;
		title: string;
		url: string;
		thumbUrl?: string;
	};
	reviews: {
		id: string;
		title: string;
		body: string;
		rating: number;
		createdAt: string;
		reviewer: {
			id: string;
			name: string;
		};
	}[];
	samples: string[];
}

export interface SavePriceInput {
	site: 'f';
	id: string;
	data: {
		date: string;
		prices: {
			name: string;
			normalPrice: number;
			salePrice: number;
		}[];
		sale: {
			id: string;
			name: string;
			url: string;
		};
	};
}

export interface OtelContext {
	parentSpanId: string;
	parentTraceId: string;
}

export interface SitefMainDep {
	logger: LoggerLike;
	fetcher: SitefFetcherLike;
	exporter: Exporter;
	saveToD1(data: SaveAllInput, otelContext: OtelContext): Promise<void>;
	savePriceHistory(data: SavePriceInput, otelContext: OtelContext): Promise<void>;
}

interface LoggerLike {
	info: (message: string, args?: Record<string | symbol, any>) => void;
	error: (message: string, args?: Record<string | symbol, any>) => void;
	with: (fields: Record<string | symbol, any>) => LoggerLike;
	flush(): Promise<void> | void;
}
