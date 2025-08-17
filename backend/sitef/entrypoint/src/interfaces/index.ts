import type { Exporter } from '@cfstackdemo/lightweight-otel-sdk';
import type { SitefHiddenAPIResponse, SitefItemAPIResponse } from '@cfstackdemo/sitef-fetcher/interfaces';
import type { DEMO_CommonSiteQueueData } from '@cfstackdemo/types';
import type { Result, ResultAsync } from 'neverthrow';

export interface SitefEntrypointDep {
	fetcher: SitefFetcherLike;
	logger: LoggerLike;
	exporter: Exporter;
	CheckNeedScrapingBatch: (
		site: 'f' | 'd' | 'm' | 's',
		items: Omit<DEMO_CommonSiteQueueData, 'thumbUrl' | 'otelContext'>[]
	) => Promise<Omit<DEMO_CommonSiteQueueData, 'thumbUrl' | 'otelContext'>[]>;
	sendBatch: (messages: Iterable<MessageSendRequest<DEMO_CommonSiteQueueData>>, options?: QueueSendBatchOptions) => Promise<void>;
	environment: 'development' | 'staging' | 'production' | 'example' | 'test';
}

export interface LoggerLike {
	info: (message: string, args?: Record<string | symbol, any>) => void;
	error: (message: string, args?: Record<string | symbol, any>) => void;
	with: (fields: Record<string | symbol, any>) => LoggerLike;
	flush(): Promise<void> | void;
}

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
}
