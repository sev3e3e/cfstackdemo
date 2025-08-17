/**
 * Interface for Resource attributes.
 * General `Attributes` interface is added in api v1.1.0.
 * To backward support older api (1.0.x), the deprecated `SpanAttributes` is used here.
 */
export declare type ResourceAttributes = Attributes;

/**
 * Attributes is a map from string to attribute values.
 *
 * Note: only the own enumerable keys are counted as valid attribute keys.
 */
export interface Attributes {
	[attributeKey: string]: AttributeValue | undefined;
}

/**
 * Attribute values may be any non-nullish primitive value except an object.
 *
 * null or undefined attribute values are invalid and will result in undefined behavior.
 */
export declare type AttributeValue =
	| string
	| number
	| boolean
	| Array<null | undefined | string>
	| Array<null | undefined | number>
	| Array<null | undefined | boolean>;
