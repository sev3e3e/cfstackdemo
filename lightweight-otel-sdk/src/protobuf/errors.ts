/**
 * Spanが閉じられていないときのエラー
 */
export class SpanNotEndedError extends Error {
	override readonly name = 'SpanNotEndedError' as const;
	constructor(message: string, options?: { cause: unknown }) {
		super(message, options);

		this.cause = options?.cause;
	}
}

//
export class InvalidFunctionTypeError extends Error {
	override readonly name = 'InvalidFunctionTypeError' as const;
	constructor(message: string, options?: { cause: unknown }) {
		super(message, options);

		this.cause = options?.cause;
	}
}
