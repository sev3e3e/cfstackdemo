export class D1InsertError extends Error {
	override readonly name = 'D1InsertError' as const;
	constructor(message: string, options?: { cause: unknown }) {
		super(message, options);

		this.cause = options?.cause;
	}
}

export class D1SelectError extends Error {
	override readonly name = 'D1SelectError' as const;
	constructor(message: string, options?: { cause: unknown }) {
		super(message, options);

		this.cause = options?.cause;
	}
}

export class DataInconsistencyError extends Error {
	override readonly name = 'DataInconsistencyError ' as const;
	constructor(message: string, options?: { cause: unknown }) {
		super(message, options);

		this.cause = options?.cause;
	}
}
