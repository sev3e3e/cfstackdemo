import { Site } from '@cfstackdemo/types';

export function CreatePriceHistoryPath(site: Site, id: string) {
	return `site${site}/pricehistory/${id}.json`;
}
