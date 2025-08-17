import type { Span } from '../span';

export interface Exporter {
	export: (spans: Span[]) => Promise<void>;
}
