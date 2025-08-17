import { serializeError } from '@cfstackdemo/utility';

import { ATTR_EXCEPTION_MESSAGE, ATTR_EXCEPTION_STACKTRACE, ATTR_EXCEPTION_TYPE, OTEL_STATUS_CODE_VALUE_ERROR } from './consts/attrs';
import type { IResource, SpanEvent } from './interfaces';

export function generateTraceId(): string {
	return crypto.getRandomValues(new Uint8Array(16)).reduce((str, b) => str + b.toString(16).padStart(2, '0'), '');
}

export function generateSpanId(): string {
	return crypto.getRandomValues(new Uint8Array(8)).reduce((str, b) => str + b.toString(16).padStart(2, '0'), '');
}

export function nowNs(): string {
	return (BigInt(Date.now()) * 1_000_000n).toString();
}

export class Span {
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	name: string;
	kind = 1;
	startTimeUnixNano: string;
	endTimeUnixNano?: string;
	attributes: Record<string, unknown> = {};

	events: SpanEvent[] = [];
	resource: IResource;
	scope: { name: string; version: string };
	status?: {
		code: 'ERROR' | 'OK';
		message?: string;
	};

	constructor(name: string, resource: IResource, scope: { name: string; version: string }, traceId?: string, parentSpanId?: string) {
		this.traceId = traceId ?? generateTraceId();
		this.spanId = generateSpanId();
		this.parentSpanId = parentSpanId;
		this.name = name;
		this.startTimeUnixNano = nowNs();
		this.resource = resource;
		this.scope = scope;
	}

	end() {
		if (!this.endTimeUnixNano) this.endTimeUnixNano = nowNs();
	}

	addAttribute(key: string, value: string | number | boolean | Array<string | number | boolean>) {
		if (!key || typeof key !== 'string') throw new Error('Attribute key must be a non-empty string');
		assertValidAttrValue(value);
		this.attributes[key] = value;
	}

	/** 複数属性を一括で追加します。null/undefined は無視します。 */
	addAttributes(attrs: Record<string, unknown>) {
		if (!attrs || typeof attrs !== 'object') throw new Error('Attributes must be an object');
		for (const [k, v] of Object.entries(attrs)) {
			if (v === undefined || v === null) continue;
			assertValidAttrValue(v);
			this.addAttribute(k, v);
		}
	}

	/**
	 * イベントを追加します。
	 * @param name イベント名
	 * @param attributes 任意の属性
	 * @param timestamp Date | number(ms) | bigint(ns) | string(ns)
	 */
	addEvent(name: string, attributes?: Record<string, unknown>, timestamp?: Date | number | bigint | string) {
		if (!name || typeof name !== 'string') throw new Error('Event name must be a non-empty string');

		let normalizedAttrs: SpanEvent['attributes'] | undefined;
		if (attributes) {
			normalizedAttrs = {};
			for (const [k, v] of Object.entries(attributes)) {
				if (v === undefined || v === null) continue;
				assertValidAttrValue(v);
				normalizedAttrs[k] = v;
			}
		}

		this.events.push({
			name,
			timeUnixNano: toUnixNanoString(timestamp),
			attributes: normalizedAttrs && Object.keys(normalizedAttrs).length > 0 ? normalizedAttrs : undefined,
			droppedAttributesCount: 0,
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

/** OTELに沿う属性値の検証を行います。 */
function assertValidAttrValue(value: unknown): asserts value is string | number | boolean | Array<string | number | boolean> {
	const t = typeof value;
	if (Array.isArray(value)) {
		if (!value.every((v) => ['string', 'number', 'boolean'].includes(typeof v))) {
			throw new Error('Attribute array values must be strings, numbers, or booleans');
		}
		return;
	}
	if (t === 'string' || t === 'number' || t === 'boolean') return;
	throw new Error('Attribute value must be a string, number, boolean, or array of these types');
}

/** Date | number(ms) | bigint(ns) | string(ns) を ns 文字列へ正規化します。 */
function toUnixNanoString(ts?: Date | number | bigint | string): string {
	if (ts === undefined) return nowNs();
	if (ts instanceof Date) return (BigInt(ts.getTime()) * 1_000_000n).toString();
	if (typeof ts === 'number') return (BigInt(ts) * 1_000_000n).toString(); // number は ms と解釈
	if (typeof ts === 'bigint') return ts.toString(); // すでに ns
	if (typeof ts === 'string') return ts; // すでに ns とみなす
	throw new Error('Invalid timestamp type');
}
