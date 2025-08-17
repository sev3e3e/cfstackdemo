/**
 * Spanが閉じられていないときのエラー
 */
export class QueueSendError extends Error {
	override readonly name = 'QueueSendError' as const;
	constructor(message: string, options?: { cause: unknown }) {
		super(message, options);

		this.cause = options?.cause;
	}
}
