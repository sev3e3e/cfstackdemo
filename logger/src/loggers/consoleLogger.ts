import { BaseLogger } from '../interfaces/baseLogger';

export class ConsoleLogger implements BaseLogger {
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
		return new ConsoleLogger({ ...this.context, ...context });
	}

	private log(level: string, message: string, fields: Record<string, any>) {
		const entry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			...this.context,
			...fields,
		};
		console.log(JSON.stringify(entry, null, 2));
	}
}
