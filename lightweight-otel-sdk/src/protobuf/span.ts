import {
	ATTR_EXCEPTION_MESSAGE,
	ATTR_EXCEPTION_STACKTRACE,
	ATTR_EXCEPTION_TYPE,
	OTEL_STATUS_CODE_VALUE_ERROR,
} from '@opentelemetry/semantic-conventions';
import { err, ok } from 'neverthrow';
import { SpanNotEndedError } from './errors';
import { serializeError } from '@cfstackdemo/utility';

export function generateTraceId(): string {
	return crypto.getRandomValues(new Uint8Array(16)).reduce((str, b) => str + b.toString(16).padStart(2, '0'), '');
}

export function generateSpanId(): string {
	return crypto.getRandomValues(new Uint8Array(8)).reduce((str, b) => str + b.toString(16).padStart(2, '0'), '');
}

export function nowNs(): string {
	return (BigInt(Date.now()) * 1_000_000n).toString();
}

function formatAttributes(obj: Record<string, unknown>) {
	return Object.entries(obj).map(([key, value]) => ({
		key,
		value: Array.isArray(value)
			? formatArrayValue(value)
			: typeof value === 'boolean'
				? { boolValue: value }
				: typeof value === 'number'
					? { doubleValue: value }
					: { stringValue: String(value) },
	}));
}

function formatArrayValue(arr: Array<string | number | boolean>) {
	if (arr.length === 0) {
		return { arrayValue: { stringValues: [] } };
	}

	const firstType = typeof arr[0];
	const allSameType = arr.every((item) => typeof item === firstType);

	if (allSameType) {
		switch (firstType) {
			case 'string':
				return { arrayValue: { stringValues: arr as string[] } };
			case 'number':
				return { arrayValue: { doubleValues: arr as number[] } };
			case 'boolean':
				return { arrayValue: { boolValues: arr as boolean[] } };
			default:
				return { arrayValue: { stringValues: arr.map(String) } };
		}
	} else {
		// Mixed types - convert all to strings
		return { arrayValue: { stringValues: arr.map(String) } };
	}
}

export class Span {
	trace_id: string;
	span_id: string;
	parent_span_id?: string;
	name: string;
	kind = 1;
	start_time_unix_nano: string;
	end_time_unix_nano?: string;
	attributes: Record<string, unknown> = {};
	status?: {
		code: 'ERROR' | 'OK';
		message?: string;
	};

	constructor(name: string, traceId?: string, parentSpanId?: string) {
		this.trace_id = traceId ?? generateTraceId();
		this.span_id = generateSpanId();
		this.parent_span_id = parentSpanId;
		this.name = name;
		this.start_time_unix_nano = nowNs();
	}

	end() {
		if (!this.end_time_unix_nano) this.end_time_unix_nano = nowNs();
	}

	addAttribute(key: string, value: string | number | boolean | Array<string | number | boolean>) {
		if (!key || typeof key !== 'string') {
			throw new Error('Attribute key must be a non-empty string');
		}

		// Validate value type according to OpenTelemetry specification
		if (Array.isArray(value)) {
			if (!value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
				throw new Error('Attribute array values must be strings, numbers, or booleans');
			}
		} else if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
			throw new Error('Attribute value must be a string, number, boolean, or array of these types');
		}

		this.attributes[key] = value;
	}

	toOTLP() {
		if (!this.end_time_unix_nano) {
			const error = new SpanNotEndedError(
				JSON.stringify({
					msg: 'Span not ended.',
					data: this,
				}),
			);
			return err(error);
		}

		return ok({
			trace_id: this.trace_id,
			span_id: this.span_id,
			parent_span_id: this.parent_span_id,
			name: this.name,
			kind: this.kind,
			start_time_unix_nano: this.start_time_unix_nano,
			end_time_unix_nano: this.end_time_unix_nano,
			attributes: formatAttributes(this.attributes),
			status: this.status,
		});
	}

	recordException(error: unknown) {
		if (error instanceof Error) {
			this.attributes[ATTR_EXCEPTION_TYPE] = error.name;
			this.attributes[ATTR_EXCEPTION_MESSAGE] = error.message;
			this.attributes[ATTR_EXCEPTION_STACKTRACE] = error.stack ?? '';

			this.status = {
				code: OTEL_STATUS_CODE_VALUE_ERROR,
				...serializeError(error),
			};
		} else {
			// custom key
			this.attributes['exception.uncaught'] = String(error);

			this.status = {
				code: OTEL_STATUS_CODE_VALUE_ERROR,
				message: String(error),
			};
		}
	}
}
