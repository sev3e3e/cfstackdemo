import type { IResource } from './interfaces';
import type { Span } from './span';

/** OTLP Trace JSON（最小限の型） */
type OTLPAnyValue =
	| { stringValue: string }
	| { boolValue: boolean }
	| { doubleValue: number }
	| { arrayValue: { stringValues?: string[]; boolValues?: boolean[]; doubleValues?: number[] } };

type OTLPKeyValue = { key: string; value: OTLPAnyValue };

type OTLPEvent = {
	name: string;
	timeUnixNano: string;
	attributes?: OTLPKeyValue[];
	droppedAttributesCount?: number;
};

type OTLPStatus =
	| { code: 'STATUS_CODE_OK'; message?: string }
	| { code: 'STATUS_CODE_ERROR'; message?: string }
	| { code: 'STATUS_CODE_UNSET'; message?: string };

type OTLPSpan = {
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	name: string;
	kind: number;
	startTimeUnixNano: string;
	endTimeUnixNano: string;
	attributes?: OTLPKeyValue[];
	events?: OTLPEvent[];
	status?: OTLPStatus;
};

type OTLPExportPayload = {
	resourceSpans: Array<{
		resource: { attributes?: OTLPKeyValue[] };
		scopeSpans: Array<{
			scope: { name: string; version: string };
			spans: OTLPSpan[];
		}>;
	}>;
};

export function toOTLPSpan(span: Span): OTLPSpan {
	if (!span.endTimeUnixNano) throw new Error('Span not ended');

	return {
		traceId: span.traceId,
		spanId: span.spanId,
		...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
		name: span.name,
		kind: 1,
		startTimeUnixNano: span.startTimeUnixNano,
		endTimeUnixNano: span.endTimeUnixNano,
		attributes: formatAttributes(span.attributes),
		events: formatEvents(span),
		status: mapStatus(span),
	};
}

export function toOTLPExportPayload(spans: Span[]): OTLPExportPayload {
	const groups = new Map<
		string,
		{
			resource: IResource;
			scope: { name: string; version: string };
			spans: Span[];
		}
	>();

	for (const span of spans) {
		if (!span.endTimeUnixNano) continue;

		const resourceKey = JSON.stringify(span.resource);
		const scopeKey = JSON.stringify(span.scope);
		const key = `${resourceKey}::${scopeKey}`;

		if (!groups.has(key)) {
			groups.set(key, {
				resource: span.resource,
				scope: span.scope,
				spans: [],
			});
		}

		groups.get(key)!.spans.push(span);
	}

	return {
		resourceSpans: Array.from(groups.values()).map(({ resource, scope, spans }) => ({
			resource: {
				attributes: formatAttributes(resource.attributes),
			},
			scopeSpans: [
				{
					scope,
					spans: spans.map(toOTLPSpan),
				},
			],
		})),
	};
}

/** ----- helpers ----- */

function mapStatus(span: Span): OTLPStatus | undefined {
	if (!span.status) return undefined;
	const msg = span.status.message;
	switch (span.status.code) {
		case 'OK':
			return { code: 'STATUS_CODE_OK', ...(msg ? { message: msg } : {}) };
		case 'ERROR':
			return { code: 'STATUS_CODE_ERROR', ...(msg ? { message: msg } : {}) };
		default:
			return { code: 'STATUS_CODE_UNSET', ...(msg ? { message: msg } : {}) };
	}
}

function formatEvents(span: Span): OTLPEvent[] | undefined {
	if (!span.events || span.events.length === 0) return undefined;
	return span.events.map((e) => ({
		name: e.name,
		timeUnixNano: e.timeUnixNano,
		attributes: e.attributes ? formatAttributes(e.attributes) : undefined,
		droppedAttributesCount: e.droppedAttributesCount ?? 0,
	}));
}

function formatAttributes(obj: Record<string, unknown> | undefined) {
	if (!obj) return undefined;
	const entries = Object.entries(obj);
	if (entries.length === 0) return undefined;

	return entries.map(([key, value]) => ({
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

function formatArrayValue(arr: Array<string | number | boolean>): OTLPAnyValue {
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
		return { arrayValue: { stringValues: arr.map(String) } };
	}
}
