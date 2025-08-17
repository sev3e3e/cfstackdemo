import { errAsync, okAsync, Result, ResultAsync } from 'neverthrow';
import type { Span } from './span';
import type { Tracer } from './tracer';
import { InvalidFunctionTypeError } from './errors';

type MaybeAsyncResult<T, E> = Result<T, E> | ResultAsync<T, E> | Promise<Result<T, E>>;

function isResultAsync<T, E>(val: unknown): val is ResultAsync<T, E> {
	return typeof val === 'object' && val !== null && typeof (val as any)._unsafeUnwrapPromise === 'function';
}

function isPromiseResult<T, E>(val: unknown): val is Promise<Result<T, E>> {
	return (
		typeof val === 'object' &&
		val !== null &&
		typeof (val as any).then === 'function' &&
		typeof (val as any).isOk !== 'function' &&
		typeof (val as any)._unsafeUnwrapPromise !== 'function'
	);
}

function isResult<T, E>(val: unknown): val is Result<T, E> {
	return typeof val === 'object' && val !== null && typeof (val as any).isOk === 'function' && typeof (val as any).isErr === 'function';
}

export function instrument<T, E>(p: {
	tracer: Tracer;
	name: string;
	fn: (span: Span) => MaybeAsyncResult<T, E>;
	rootSpan?: Span;
	parentSpan?: Span;
}): ResultAsync<T, E> {
	const span = p.tracer.startSpan(p.name, p.parentSpan?.trace_id, p.parentSpan?.span_id);

	const raw = p.fn(span);

	let result: ResultAsync<T, E>;

	if (isResultAsync<T, E>(raw)) {
		result = raw;
	} else if (isPromiseResult<T, E>(raw)) {
		result = ResultAsync.fromPromise(raw, (e) => e as E).andThen((r) =>
			r.match(
				(v) => okAsync(v),
				(e) => errAsync(e),
			),
		);
	} else if (isResult<T, E>(raw)) {
		result = raw.match(
			(v) => okAsync(v),
			(e) => errAsync(e),
		);
	} else {
		// 不正な戻り値：ここで span を閉じ、エラーを返す
		const err = new InvalidFunctionTypeError('Invalid return type from instrumented function');
		span.recordException(err);
		if (p.rootSpan) p.rootSpan.recordException(err);
		span.end();

		return errAsync(err as E);
	}

	return result
		.map((v) => {
			span.end();
			return v;
		})
		.mapErr((e) => {
			span.recordException(e);
			if (p.rootSpan) p.rootSpan.recordException(e);
			span.end();
			return e;
		});
}
