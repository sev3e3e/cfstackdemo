export type PriceHistoryData = {
	date: string;
	prices: {
		name: string;
		normalPrice: number;
		salePrice: number;
	}[];
	sale?: {
		id: string;
		name: string;
		url: string;
	};
};
