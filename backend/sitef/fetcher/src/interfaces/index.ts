export type SitefHiddenAPIResponse = {
	id: string;
	url: string;
	name: string;
	banner_img: string;
	banner_width: number;
	banner_height: number;
}[];

export type SitefItemAPIResponse = {
	id: string;
	title: string;
	url: string;
	sampleImageUrls: string[];
	sampleMovieUrl: string;
	prices: {
		name: string;
		price: number;
	}[];
	maker: {
		id: number;
		name: string;
	};
}[];

export interface SitefFetcherLike {
	FetchSaleFromHiddenAPI(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		count?: number
	): Promise<SitefHiddenAPIResponse>;
	FetchFromItemAPI(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		props: { keyword: string; category: string; count: number; offset: number }
	): Promise<SitefItemAPIResponse>;

	fetchDetailPage(
		otelContext: {
			traceId: string;
			parentSpanId: string;
		},
		url: string
	): Promise<string>;
}

export interface LoggerLike {
	info: (message: string, args?: Record<string | symbol, any>) => void;
	error: (message: string, args?: Record<string | symbol, any>) => void;
	warn: (message: string, args?: Record<string | symbol, any>) => void;
	with: (fields: Record<string | symbol, any>) => LoggerLike;
	flush(): Promise<void> | void;
}
