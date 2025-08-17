import type { Result, ResultAsync } from 'neverthrow';

export interface LoggerLike {
	info: (message: string, args?: Record<string | symbol, any>) => void;
	error: (message: string, args?: Record<string | symbol, any>) => void;
	warn: (message: string, args?: Record<string | symbol, any>) => void;
	debug: (message: string, args?: Record<string | symbol, any>) => void;
	with: (fields: Record<string | symbol, any>) => LoggerLike;

	flush(): Promise<void> | void;
}

export interface RelayDependencies {
	logger: LoggerLike;
	env: {
		RELAY_BEARER_TOKEN: string;
		ENVIRONMENT: string;
	};
	fetch: () => ResultAsync<Response, unknown> | Promise<Result<Response, unknown>>;
}
