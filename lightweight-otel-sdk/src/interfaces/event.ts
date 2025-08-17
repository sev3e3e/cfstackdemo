export type SpanEvent = {
	name: string;
	timeUnixNano: string;
	attributes?: Record<string, string | number | boolean | Array<string | number | boolean>>;
	droppedAttributesCount?: number;
};
