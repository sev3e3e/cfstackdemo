import type { BaseExporter } from './baseExporter';

export interface BaseLogger {
	debug(message: string, meta?: Record<string, any>): void;
	info(message: string, meta?: Record<string, any>): void;
	warn(message: string, meta?: Record<string, any>): void;
	error(message: string, meta?: Record<string, any>): void;
	with: (meta: Record<string | symbol, any>) => BaseLogger;
	flush(): Promise<void>;
}

export interface BaseLoggerConfig {
	exporters: BaseExporter[];
}
