import type { PageServerLoad } from './$types';

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const load: PageServerLoad = async () => {
	const text = 'ストリーミングテスト';

	return {
		streamed: {
			chars: text.split('').map(async (char, i) => {
				await delay(2000 * (i + 1));
				return char;
			})
		}
	};
};
