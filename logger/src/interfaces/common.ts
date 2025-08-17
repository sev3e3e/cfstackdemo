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
