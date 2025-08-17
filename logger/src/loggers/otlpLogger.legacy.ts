import { BaseLogger } from '../interfaces/baseLogger';

export enum SeverityNumber {
	TRACE = 1,
	TRACE2 = 2,
	TRACE3 = 3,
	TRACE4 = 4,
	DEBUG = 5,
	DEBUG2 = 6,
	DEBUG3 = 7,
	DEBUG4 = 8,
	INFO = 9,
	INFO2 = 10,
	INFO3 = 11,
	INFO4 = 12,
	WARN = 13,
	WARN2 = 14,
	WARN3 = 15,
	WARN4 = 16,
	ERROR = 17,
	ERROR2 = 18,
	ERROR3 = 19,
	ERROR4 = 20,
	FATAL = 21,
	FATAL2 = 22,
	FATAL3 = 23,
	FATAL4 = 24,
}

export interface TraceContext {
	traceId?: string;
	spanId?: string;
	traceFlags?: number;
}

export interface InstrumentationScope {
	name: string;
	version?: string;
	schemaUrl?: string;
	attributes?: Record<string, any>;
}

export interface Resource {
	attributes: Record<string, any>;
	droppedAttributesCount?: number;
}

export interface LogRecord {
	timestamp?: bigint;
	observedTimestamp?: bigint;
	traceContext?: TraceContext;
	severityText?: string;
	severityNumber?: SeverityNumber;
	body?: any;
	attributes?: Record<string, any>;
	resource?: Resource;
	instrumentationScope?: InstrumentationScope;
	eventName?: string;
	droppedAttributesCount?: number;
}

export type AnyValue =
	| { string_value: string }
	| { bool_value: boolean }
	| { int_value: number }
	| { double_value: number }
	| { array_value: { values: AnyValue[] } }
	| { kvlist_value: { values: { key: string; value: AnyValue }[] } }
	| { null_value: 'NULL_VALUE' };

export interface OTLPLoggerConfig {
	resource?: Resource;
	instrumentationScope?: InstrumentationScope;
	enableConsoleOutput?: boolean;
	batchSize?: number;
	exportTimeoutMs?: number;
	maxQueueSize?: number;
	endpoint?: string;
	headers?: Record<string, string>;
}

export interface LoggerContext {
	attributes?: Record<string, any>;
	traceContext?: TraceContext;
}

class LogExporter {
	private config: Required<OTLPLoggerConfig>;
	private logQueue: LogRecord[] = [];
	private exportTimer?: NodeJS.Timeout;

	constructor(config: Required<OTLPLoggerConfig>) {
		this.config = config;
	}

	public async emit(logRecord: LogRecord): Promise<void> {
		if (this.config.enableConsoleOutput) {
			this.outputToConsole(logRecord);
		}

		if (this.logQueue.length >= this.config.maxQueueSize) {
			this.logQueue.shift();
		}

		this.logQueue.push(logRecord);

		if (this.logQueue.length >= this.config.batchSize) {
			await this.flush();
		} else {
			this.scheduleExport();
		}
	}

	private outputToConsole(logRecord: LogRecord): void {
		const otlpLogRecord = {
			time_unix_nano: logRecord.timestamp?.toString() || '0',
			observed_time_unix_nano: logRecord.observedTimestamp?.toString() || '0',
			severity_number: logRecord.severityNumber || SeverityNumber.INFO,
			severity_text: logRecord.severityText || 'INFO',
			body: logRecord.body
				? {
						string_value: typeof logRecord.body === 'string' ? logRecord.body : JSON.stringify(logRecord.body),
				  }
				: undefined,
			attributes: logRecord.attributes
				? Object.entries(logRecord.attributes).map(([key, value]) => ({
						key,
						value: { string_value: typeof value === 'string' ? value : JSON.stringify(value) },
				  }))
				: [],
			trace_id: logRecord.traceContext?.traceId || '',
			span_id: logRecord.traceContext?.spanId || '',
			flags: logRecord.traceContext?.traceFlags || 0,
			dropped_attributes_count: logRecord.droppedAttributesCount || 0,
		};

		console.log(JSON.stringify(otlpLogRecord, null, 2));
	}

	private scheduleExport(): void {
		if (this.exportTimer) {
			return;
		}

		this.exportTimer = setTimeout(async () => {
			await this.flush();
		}, this.config.exportTimeoutMs);
	}

	public async flush(): Promise<void> {
		if (this.exportTimer) {
			clearTimeout(this.exportTimer);
			this.exportTimer = undefined;
		}

		if (this.logQueue.length === 0) {
			return;
		}

		const logsToExport = this.logQueue.splice(0, this.config.batchSize);

		await this.exportLogs(logsToExport);
	}

	private async exportLogs(logs: LogRecord[]): Promise<void> {
		const _payload = {
			resource_logs: [
				{
					resource: this.config.resource,
					scope_logs: [
						{
							scope: this.config.instrumentationScope,
							log_records: logs.map((log) => ({
								time_unix_nano: log.timestamp?.toString() || '0',
								observed_time_unix_nano: log.observedTimestamp?.toString() || '0',
								severity_number: log.severityNumber || SeverityNumber.INFO,
								severity_text: log.severityText || 'INFO',
								body: log.body != null ? this.mapAnyValue(log.body) : undefined,
								attributes: log.attributes
									? Object.entries(log.attributes).map(([key, value]) => ({
											key,
											value: this.mapAnyValue(value),
									  }))
									: [],
								trace_id: log.traceContext?.traceId || '',
								span_id: log.traceContext?.spanId || '',
								flags: log.traceContext?.traceFlags || 0,
								dropped_attributes_count: log.droppedAttributesCount || 0,
							})),
						},
					],
				},
			],
		};

		const payload = JSON.stringify(_payload);

		if (!this.config.endpoint) {
			console.log(payload);
			return;
		}

		try {
			const response = await fetch(this.config.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...this.config.headers,
				},
				body: payload,
			});

			if (!response.ok) {
				console.error(`Failed to export logs: ${response.status} ${response.statusText}`);
			}
		} catch (error) {
			console.error('Error exporting logs:', error);
		}
	}

	private mapAnyValue(val: any): AnyValue {
		if (val === null || val === undefined) {
			return { null_value: 'NULL_VALUE' };
		}

		switch (typeof val) {
			case 'string':
				return { string_value: val };

			case 'boolean':
				return { bool_value: val };

			case 'number':
				return Number.isInteger(val) ? { int_value: val } : { double_value: val };

			case 'object':
				if (Array.isArray(val)) {
					return {
						array_value: {
							values: val.map((item) => this.mapAnyValue(item)),
						},
					};
				}

				// plain object → kvlist
				return {
					kvlist_value: {
						values: Object.entries(val).map(([key, value]) => ({
							key,
							value: this.mapAnyValue(value),
						})),
					},
				};

			default:
				// fallback（例：symbolやfunction）
				return { string_value: String(val) };
		}
	}
}

/**
 * https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/logs/data-model.md
 */
export class OTLPLogger implements BaseLogger {
	private static exporters = new Map<string, LogExporter>();
	private exporter: LogExporter;
	private context: LoggerContext;
	private config: OTLPLoggerConfig;
	private resolvedConfig: Required<OTLPLoggerConfig>;

	constructor(config: OTLPLoggerConfig = {}, context: LoggerContext = {}) {
		this.config = config;
		this.resolvedConfig = {
			resource: config.resource || {
				attributes: {
					'service.name': 'cfstack-demo',
					'service.version': '1.0.0',
				},
			},
			instrumentationScope: config.instrumentationScope || {
				name: '@cfstackdemo/logger',
				version: '0.0.0',
			},
			enableConsoleOutput: config.enableConsoleOutput ?? true,
			batchSize: config.batchSize ?? 100,
			exportTimeoutMs: config.exportTimeoutMs ?? 5000,
			maxQueueSize: config.maxQueueSize ?? 1000,
			endpoint: config.endpoint ?? '',
			headers: config.headers ?? {},
		};

		const exporterKey = JSON.stringify(this.resolvedConfig);
		if (!OTLPLogger.exporters.has(exporterKey)) {
			OTLPLogger.exporters.set(exporterKey, new LogExporter(this.resolvedConfig));
		}
		this.exporter = OTLPLogger.exporters.get(exporterKey)!;

		this.context = {
			attributes: context.attributes,
			traceContext: context.traceContext,
		};
	}

	private createLogRecord(severityNumber: SeverityNumber, severityText: string, message: string, meta?: Record<string, any>): LogRecord {
		const now = BigInt(Date.now()) * BigInt(1000000);

		const mergedAttributes = {
			...this.context.attributes,
			...meta,
		};

		const logRecord: LogRecord = {
			timestamp: now,
			observedTimestamp: now,
			severityNumber,
			severityText,
			body: message,
			resource: this.resolvedConfig.resource,
			instrumentationScope: this.resolvedConfig.instrumentationScope,
			traceContext: this.context.traceContext,
		};

		if (Object.keys(mergedAttributes).length > 0) {
			logRecord.attributes = { ...mergedAttributes };
		}

		if (meta?.['traceContext']) {
			logRecord.traceContext = meta['traceContext'];
			delete logRecord.attributes?.['traceContext'];
		}

		if (meta?.['eventName']) {
			logRecord.eventName = meta['eventName'];
			delete logRecord.attributes?.['eventName'];
		}

		return logRecord;
	}

	private async emit(logRecord: LogRecord): Promise<void> {
		await this.exporter.emit(logRecord);
	}

	public debug(message: string, meta?: Record<string, any>): void {
		const logRecord = this.createLogRecord(SeverityNumber.DEBUG, 'DEBUG', message, meta);
		this.emit(logRecord);
	}

	public info(message: string, meta?: Record<string, any>): void {
		const logRecord = this.createLogRecord(SeverityNumber.INFO, 'INFO', message, meta);
		this.emit(logRecord);
	}

	public warn(message: string, meta?: Record<string, any>): void {
		const logRecord = this.createLogRecord(SeverityNumber.WARN, 'WARN', message, meta);
		this.emit(logRecord);
	}

	public error(message: string, meta?: Record<string, any>): void {
		const logRecord = this.createLogRecord(SeverityNumber.ERROR, 'ERROR', message, meta);
		this.emit(logRecord);
	}

	public trace(message: string, meta?: Record<string, any>): void {
		const logRecord = this.createLogRecord(SeverityNumber.TRACE, 'TRACE', message, meta);
		this.emit(logRecord);
	}

	public fatal(message: string, meta?: Record<string, any>): void {
		const logRecord = this.createLogRecord(SeverityNumber.FATAL, 'FATAL', message, meta);
		this.emit(logRecord);
	}

	public async shutdown(): Promise<void> {
		await this.exporter.flush();
	}

	public withTraceContext(traceId: string, spanId: string, traceFlags: number = 0): OTLPLogger {
		const newContext: LoggerContext = {
			...this.context,
			traceContext: { traceId, spanId, traceFlags },
		};
		return new OTLPLogger(this.config, newContext);
	}

	public withInstrumentationScope(scope: InstrumentationScope): OTLPLogger {
		const newConfig: OTLPLoggerConfig = {
			...this.config,
			instrumentationScope: scope,
		};
		return new OTLPLogger(newConfig, this.context);
	}

	public withResource(resource: Resource): OTLPLogger {
		const newConfig: OTLPLoggerConfig = {
			...this.config,
			resource,
		};
		return new OTLPLogger(newConfig, this.context);
	}

	public with(attributes: Record<string, any>): OTLPLogger {
		const newContext: LoggerContext = {
			...this.context,
			attributes: { ...this.context.attributes, ...attributes },
		};
		return new OTLPLogger(this.config, newContext);
	}
}

export function createOTLPLogger(config?: OTLPLoggerConfig): OTLPLogger {
	return new OTLPLogger(config);
}
