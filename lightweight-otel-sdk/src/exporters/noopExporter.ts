import type { Span } from '../span';

import { Exporter } from './exporter';

export class NoopExporter implements Exporter {
	async export(spans?: Span[]) {
		return;
	}
}
