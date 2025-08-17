import type { Span } from '../span';
import { toOTLPExportPayload } from '../transform';
import { Exporter } from './exporter';

export class AxiomExporter implements Exporter {
	constructor(private token: string, private dataset: string) {}
	async export(spans: Span[]) {
		const payload = toOTLPExportPayload(spans);
		const json = JSON.stringify(payload);

		const result = await fetch('https://api.axiom.co/v1/traces', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.token}`,
				'X-Axiom-Dataset': this.dataset,
				'Content-Type': 'application/json',
			},
			body: json,
		});

		if (result.status != 200) {
			throw new Error(`AxiomExporter failed with status ${result.status}: ${await result.text()}`);
		}
	}
}
