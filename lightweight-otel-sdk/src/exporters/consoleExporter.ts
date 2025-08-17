import type { Span } from '../span';
import { toOTLPExportPayload } from '../transform';
import { Exporter } from './exporter';

export class ConsoleExporter implements Exporter {
	async export(spans: Span[]) {
		const payload = toOTLPExportPayload(spans);
		const json = JSON.stringify(payload);

		console.log(json);
	}
}
