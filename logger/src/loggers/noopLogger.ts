import { BaseLogger } from '../interfaces/baseLogger';

export class NoopLogger implements BaseLogger {
	private context: Record<string, any>;

	constructor(context: Record<string, any> = {}) {
		this.context = context;
	}

	debug(message: string, fields: Record<string, any> = {}) {
		this.log('debug', message, fields);
	}

	info(message: string, fields: Record<string, any> = {}) {
		this.log('info', message, fields);
	}

	warn(message: string, fields: Record<string, any> = {}) {
		this.log('warn', message, fields);
	}

	error(message: string, fields: Record<string, any> = {}) {
		this.log('error', message, fields);
	}

	flush() {
		return Promise.resolve();
	}

	with(context: Record<string, any>): BaseLogger {
		return new NoopLogger({ ...this.context, ...context });
	}

	private log(level: string, message: string, fields: Record<string, any>) {
		return;
	}
}
