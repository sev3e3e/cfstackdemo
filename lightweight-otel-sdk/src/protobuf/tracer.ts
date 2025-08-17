import { Span } from './span';
import { IResource, Resource, type ResourceAttributes } from '@opentelemetry/resources';

import { ATTR_TELEMETRY_SDK_LANGUAGE, ATTR_TELEMETRY_SDK_NAME, ATTR_TELEMETRY_SDK_VERSION } from '@opentelemetry/semantic-conventions';
import {
	ATTR_CLOUD_PROVIDER,
	ATTR_CLOUD_PLATFORM,
	ATTR_CLOUD_REGION,
	ATTR_FAAS_MAX_MEMORY,
} from '@opentelemetry/semantic-conventions/incubating';

function formatAttributes(obj: Record<string, unknown>) {
	return Object.entries(obj).map(([key, value]) => ({
		key,
		value:
			typeof value === 'boolean'
				? { boolValue: value }
				: typeof value === 'number'
					? { doubleValue: value }
					: { stringValue: String(value) },
	}));
}

export class Tracer {
	private resource: IResource;
	private scope: { name: string; version: string };
	private spans: Span[] = [];

	constructor(resource: ResourceAttributes) {
		// merge resource

		// define default resources.
		const defaultResource = new Resource({
			[ATTR_CLOUD_PROVIDER]: 'cloudflare',
			[ATTR_CLOUD_PLATFORM]: 'cloudflare.workers',
			[ATTR_CLOUD_REGION]: 'earth',
			[ATTR_FAAS_MAX_MEMORY]: 134217728,
			[ATTR_TELEMETRY_SDK_LANGUAGE]: 'js',
			[ATTR_TELEMETRY_SDK_NAME]: '@cfstackdemo/lightweight-otel-sdk',
			[ATTR_TELEMETRY_SDK_VERSION]: '0.0.0',
		});
		const definedResource = new Resource(resource);
		this.resource = defaultResource.merge(definedResource);

		this.scope = { name: '@cfstackdemo/lightweight-otel-sdk', version: '0.0.0' };
	}

	startSpan(name: string, traceId?: string, parentSpanId?: string): Span {
		const span = new Span(name, traceId, parentSpanId);
		this.spans.push(span);
		return span;
	}

	export() {
		const completedSpans = this.spans.filter((span) => span.end_time_unix_nano).map((span) => span.toOTLP());

		return {
			resourceSpans: [
				{
					resource: {
						attributes: formatAttributes(this.resource.attributes),
					},
					scopeSpans: [
						{
							scope: this.scope,
							spans: completedSpans,
						},
					],
				},
			],
		};
	}
}
