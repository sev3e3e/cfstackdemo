import { env } from 'cloudflare:test';
import { beforeAll, describe, it, expect, assert, beforeEach, afterEach } from 'vitest';
import { CreateDepsFromEnv, MainR2CommonDep, savePriceHistory } from '../src/index';
import { CreatePriceHistoryPath } from '../src/lib';
import type { PriceHistoryData } from '../src/types';
import type { OtelContext } from '@cfstackdemo/lightweight-otel-sdk';
import type { Site } from '@cfstackdemo/types';
import { Ok, Result, errAsync } from 'neverthrow';

describe('R2 Wrapper Worker', () => {
	let deps: MainR2CommonDep;
	const otelContext: OtelContext = {
		parentTraceId: 'trace-123',
		parentSpanId: 'span-456',
	};

	beforeAll(async () => {
		const newEnv = {
			...env,
			ENVIRONMENT: 'test' as const,
		};

		deps = await CreateDepsFromEnv(newEnv);
	});

	describe('savePriceHistory - 正常ケース', () => {
		it('新規データが正しく配列として保存される', async () => {
			const site: Site = 'f';
			const id = 'product123';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [
					{ name: '通常価格', normalPrice: 1000, salePrice: 800 },
					{ name: '会員価格', normalPrice: 900, salePrice: 720 },
				],
				sale: {
					id: 'sale001',
					name: '新年セール',
					url: 'https://example.com/sale/001',
				},
			};

			await savePriceHistory(deps, { params: { id, data: testData, site }, otelContext });

			// 保存確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);

			expect(stored).not.toBe(null);
			const content = await stored?.text();
			const parsedData = JSON.parse(content || '');

			expect(Array.isArray(parsedData)).toBe(true);
			expect(parsedData).toHaveLength(1);
			expect(parsedData[0]).toEqual(testData);
		});

		it('既存データに新しいデータが追加される', async () => {
			const site: Site = 'm';
			const id = 'product456';

			const firstData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: '通常価格', normalPrice: 1000, salePrice: 900 }],
			};

			const secondData: PriceHistoryData = {
				date: '2024-01-16',
				prices: [{ name: '通常価格', normalPrice: 1000, salePrice: 850 }],
				sale: {
					id: 'flash001',
					name: 'フラッシュセール',
					url: 'https://example.com/flash',
				},
			};

			// 1回目保存
			await savePriceHistory(deps, { params: { id, data: firstData, site }, otelContext });

			// 2回目保存（追加）
			await savePriceHistory(deps, { params: { id, data: secondData, site }, otelContext });

			// 確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			const content = await stored!.text();
			const parsedData = JSON.parse(content);

			expect(parsedData).toHaveLength(2);
			expect(parsedData[0]).toEqual(firstData);
			expect(parsedData[1]).toEqual(secondData);
		});

		it('複数のsite/id組み合わせで独立して動作する', async () => {
			const testCases = [
				{
					site: 'f' as Site,
					id: 'item1',
					data: {
						date: '2024-01-15',
						prices: [{ name: '価格A', normalPrice: 100, salePrice: 90 }],
					},
				},
				{
					site: 'm' as Site,
					id: 'item2',
					data: {
						date: '2024-01-15',
						prices: [{ name: '価格B', normalPrice: 200, salePrice: 180 }],
					},
				},
				{
					site: 'd' as Site,
					id: 'item1', // 同じIDでも異なるsite
					data: {
						date: '2024-01-15',
						prices: [{ name: '価格C', normalPrice: 300, salePrice: 270 }],
					},
				},
			];

			// 並行保存
			await Promise.all(testCases.map((testCase) => savePriceHistory(deps, { params: testCase, otelContext })));

			// 各々を個別確認
			for (const testCase of testCases) {
				const expectedPath = CreatePriceHistoryPath(testCase.site, testCase.id);
				const stored = await env.HistoryR2.get(expectedPath);
				const content = await stored!.text();
				const parsedData = JSON.parse(content);

				expect(parsedData).toEqual([testCase.data]);
			}
		});

		it('複数回追加で履歴が正しく蓄積される', async () => {
			const site: Site = 's';
			const id = 'price-tracker';

			const priceHistory: PriceHistoryData[] = [
				{
					date: '2024-01-15',
					prices: [{ name: '商品A', normalPrice: 1000, salePrice: 1000 }],
				},
				{
					date: '2024-01-16',
					prices: [{ name: '商品A', normalPrice: 1000, salePrice: 900 }],
					sale: { id: 'sale1', name: '10%オフ', url: 'https://example.com/1' },
				},
				{
					date: '2024-01-17',
					prices: [{ name: '商品A', normalPrice: 1000, salePrice: 800 }],
					sale: { id: 'sale2', name: '20%オフ', url: 'https://example.com/2' },
				},
			];

			// 順次保存
			for (const data of priceHistory) {
				await savePriceHistory(deps, { params: { id, data, site }, otelContext });
			}

			// 確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			const content = await stored!.text();
			const parsedData = JSON.parse(content);

			expect(parsedData).toHaveLength(3);
			expect(parsedData).toEqual(priceHistory);
		});
	});

	describe('savePriceHistory - エラーケース', () => {
		it('R2 get操作でエラーが発生した場合、適切にログを出力して処理を停止する', async () => {
			const site: Site = 'f';
			const id = 'error-get-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'テスト', normalPrice: 100, salePrice: 90 }],
			};

			// R2 getエラーをシミュレートするためのモックdeps
			const errorDeps: MainR2CommonDep = {
				...deps,
				readPriceHistory: () => {
					return errAsync(new Error('R2 get operation failed'));
				},
			};

			// エラーが発生しても例外をスローしないことを確認
			await expect(savePriceHistory(errorDeps, { params: { id, data: testData, site }, otelContext })).resolves.not.toThrow();

			// データが保存されていないことを確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			await stored?.text();
			expect(stored).toBe(null);
		});

		it('R2 put操作でエラーが発生した場合（新規データ）、適切にログを出力して処理を停止する', async () => {
			const site: Site = 'f';
			const id = 'error-put-new-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'テスト', normalPrice: 100, salePrice: 90 }],
			};

			// R2 putエラーをシミュレートするためのモックdeps
			const errorDeps: MainR2CommonDep = {
				...deps,
				HistoryR2: {
					...env.HistoryR2,
					put: () => Promise.reject(new Error('R2 put operation failed')),
				} as unknown as R2Bucket,
			};

			// エラーが発生しても例外をスローしないことを確認
			await expect(savePriceHistory(errorDeps, { params: { id, data: testData, site }, otelContext })).resolves.not.toThrow();

			// 実際のR2にはデータが保存されていないことを確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			await stored?.text();
			expect(stored).toBe(null);
		});

		it('R2 put操作でエラーが発生した場合（既存データ更新）、適切にログを出力して処理を停止する', async () => {
			const site: Site = 'f';
			const id = 'error-put-update-test';
			const firstData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'テスト1', normalPrice: 100, salePrice: 90 }],
			};
			const secondData: PriceHistoryData = {
				date: '2024-01-16',
				prices: [{ name: 'テスト2', normalPrice: 200, salePrice: 180 }],
			};

			// 最初のデータは正常に保存
			await savePriceHistory(deps, { params: { id, data: firstData, site }, otelContext });

			// 2回目のput操作でエラーをシミュレート
			const errorDeps: MainR2CommonDep = {
				...deps,
				HistoryR2: {
					...env.HistoryR2,
					put: () => Promise.reject(new Error('R2 put operation failed')),
				} as unknown as R2Bucket,
			};

			// エラーが発生しても例外をスローしないことを確認
			await expect(savePriceHistory(errorDeps, { params: { id, data: secondData, site }, otelContext })).resolves.not.toThrow();

			// 元のデータはそのまま残っていることを確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			const content = await stored!.text();
			const parsedData = JSON.parse(content);
			expect(parsedData).toEqual([firstData]); // 2つ目のデータは追加されていない
		});

		it('不正なJSON形式のデータがR2に保存されている場合、JSONパースエラーを適切に処理する', async () => {
			const site: Site = 'f';
			const id = 'invalid-json-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'テスト', normalPrice: 100, salePrice: 90 }],
			};

			// 不正なJSONデータを事前にR2に保存
			const path = CreatePriceHistoryPath(site, id);
			await env.HistoryR2.put(path, '{ invalid json data }');

			// savePriceHistory実行時にJSONパースエラーが発生することを確認
			await expect(savePriceHistory(deps, { params: { id, data: testData, site }, otelContext })).rejects.toThrow();
		});

		it('R2に存在するデータが配列でない場合のJSONパースエラーを処理する', async () => {
			const site: Site = 'f';
			const id = 'non-array-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'テスト', normalPrice: 100, salePrice: 90 }],
			};

			// 配列でないJSONデータを事前にR2に保存
			const path = CreatePriceHistoryPath(site, id);
			await env.HistoryR2.put(path, JSON.stringify({ notAnArray: true }));

			// savePriceHistory実行時にランタイムエラーが発生することを確認
			await expect(savePriceHistory(deps, { params: { id, data: testData, site }, otelContext })).rejects.toThrow();
		});
	});

	describe('savePriceHistory - 入力値検証', () => {
		it('site/idが空文字の場合でも処理が継続される', async () => {
			const site: Site = 'f';
			const id = ''; // 空文字
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'テスト', normalPrice: 100, salePrice: 90 }],
			};

			// 空文字IDでも処理が継続されることを確認
			await expect(savePriceHistory(deps, { params: { id, data: testData, site }, otelContext })).resolves.not.toThrow();

			// パスが正しく生成されることを確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			expect(expectedPath).toBe('sitef/pricehistory/.json');

			const stored = await env.HistoryR2.get(expectedPath);
			await stored?.text();
			expect(stored).not.toBe(null);
		});

		it('priceが数値以外の場合のデータ型検証', async () => {
			const site: Site = 'f';
			const id = 'invalid-price-test';

			// TypeScriptの型システムでは防げないが、実行時に問題ないかを確認
			const testDataWithInvalidPrice = {
				date: '2024-01-15',
				prices: [
					{
						name: 'テスト',
						normalPrice: '100' as any, // 文字列を数値として渡す
						salePrice: 90,
					},
				],
			} as PriceHistoryData;

			// 型が一致しないデータでも処理が継続されることを確認
			await expect(savePriceHistory(deps, { params: { id, data: testDataWithInvalidPrice, site }, otelContext })).resolves.not.toThrow();

			// データが保存されることを確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			expect(stored).not.toBe(null);

			const content = await stored!.text();
			const parsedData = JSON.parse(content);
			expect(parsedData[0].prices[0].normalPrice).toBe('100'); // 文字列として保存される
		});

		it('必須フィールドが欠けているデータの処理', async () => {
			const site: Site = 'f';
			const id = 'missing-fields-test';

			const incompleteData = {
				date: '2024-01-15',
				// pricesフィールドが欠けている
			} as PriceHistoryData;

			// 不完全なデータでも処理が継続されることを確認
			await expect(savePriceHistory(deps, { params: { id, data: incompleteData, site }, otelContext })).resolves.not.toThrow();

			// データが保存されることを確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			await stored?.text();
			expect(stored).not.toBe(null);
		});
	});

	describe('savePriceHistory - データ変換ロジック', () => {
		it('保存形式（JSON配列）への変換確認', async () => {
			const site: Site = 'f';
			const id = 'json-format-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [
					{ name: '基本', normalPrice: 1000, salePrice: 900 },
					{ name: '詳細', normalPrice: 1500, salePrice: 1350 },
				],
				sale: {
					id: 'test-sale',
					name: 'テストセール',
					url: 'https://example.com/test',
				},
			};

			await savePriceHistory(deps, { params: { id, data: testData, site }, otelContext });

			// 保存されたデータの形式を詳細に確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			const content = await stored!.text();

			// JSON文字列として正しく保存されているか確認
			expect(() => JSON.parse(content)).not.toThrow();

			const parsedData = JSON.parse(content);

			// 配列形式で保存されているか確認
			expect(Array.isArray(parsedData)).toBe(true);
			expect(parsedData).toHaveLength(1);

			// データ構造が正しく保持されているか確認
			const savedItem = parsedData[0];
			expect(savedItem.date).toBe(testData.date);
			expect(savedItem.prices).toEqual(testData.prices);
			expect(savedItem.sale).toEqual(testData.sale);

			// 各priceオブジェクトの構造確認
			expect(savedItem.prices[0]).toHaveProperty('name');
			expect(savedItem.prices[0]).toHaveProperty('normalPrice');
			expect(savedItem.prices[0]).toHaveProperty('salePrice');
			expect(typeof savedItem.prices[0].normalPrice).toBe('number');
			expect(typeof savedItem.prices[0].salePrice).toBe('number');
		});

		it('複数データ追加時のJSON配列構造確認', async () => {
			const site: Site = 'f';
			const id = 'multiple-json-test';

			const data1: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'データ1', normalPrice: 100, salePrice: 90 }],
			};

			const data2: PriceHistoryData = {
				date: '2024-01-16',
				prices: [{ name: 'データ2', normalPrice: 200, salePrice: 180 }],
			};

			// 2つのデータを順次保存
			await savePriceHistory(deps, { params: { id, data: data1, site }, otelContext });
			await savePriceHistory(deps, { params: { id, data: data2, site }, otelContext });

			// 保存されたデータの構造確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			const content = await stored!.text();
			const parsedData = JSON.parse(content);

			// 2つの要素を持つ配列として保存されているか確認
			expect(Array.isArray(parsedData)).toBe(true);
			expect(parsedData).toHaveLength(2);

			// 順序が保持されているか確認
			expect(parsedData[0]).toEqual(data1);
			expect(parsedData[1]).toEqual(data2);

			// JSON文字列として再シリアライズ可能か確認
			expect(() => JSON.stringify(parsedData)).not.toThrow();
		});

		it('特殊文字を含むデータのJSON変換確認', async () => {
			const site: Site = 'f';
			const id = 'special-chars-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [
					{
						name: '商品名"特殊\'文字&<>/\\含む',
						normalPrice: 1000,
						salePrice: 900,
					},
				],
				sale: {
					id: 'special-sale',
					name: 'セール名に特殊文字が含まれる: {"test": true}',
					url: 'https://example.com/test?param="value"&other=\'data\'',
				},
			};

			await savePriceHistory(deps, { params: { id, data: testData, site }, otelContext });

			// 特殊文字が正しくエスケープされて保存されているか確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			const stored = await env.HistoryR2.get(expectedPath);
			const content = await stored!.text();

			// JSON as validな文字列として保存されているか確認
			expect(() => JSON.parse(content)).not.toThrow();

			const parsedData = JSON.parse(content);
			expect(parsedData[0]).toEqual(testData);

			// 特殊文字が正しく復元されているか確認
			expect(parsedData[0].prices[0].name).toBe('商品名"特殊\'文字&<>/\\含む');
			expect(parsedData[0].sale?.name).toBe('セール名に特殊文字が含まれる: {"test": true}');
		});
	});

	describe('readPriceHistory', () => {
		it('存在するデータを正しく読み取る', async () => {
			const site: Site = 'f';
			const id = 'read-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [
					{ name: '通常', normalPrice: 500, salePrice: 450 },
					{ name: 'プレミアム', normalPrice: 800, salePrice: 720 },
				],
			};

			// 事前にデータを保存
			await savePriceHistory(deps, { params: { id, data: testData, site }, otelContext });

			// 読み取りテスト
			const result = await deps.readPriceHistory(site, id);

			expect(result.isOk()).toBe(true);

			if (result.isOk()) {
				const r2Object = result.value;
				expect(r2Object).not.toBe(null);

				const content = await r2Object!.text();
				const parsedData = JSON.parse(content);
				expect(parsedData).toEqual([testData]);
			}
		});

		it('存在しないデータの場合nullを返す', async () => {
			const result = await deps.readPriceHistory('f', 'nonexistent-item');

			function assertOk<T, E>(result: Result<T, E>): asserts result is Ok<T, E> {
				expect(result.isOk()).toBe(true);
			}

			// expect(result.isOk()).toBe(true);
			assertOk(result);

			expect(result.value).toBe(null);
		});
	});

	describe('CreatePriceHistoryPath', () => {
		it('正しいパスに保存される', async () => {
			const site: Site = 'd';
			const id = 'path-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [{ name: 'テスト', normalPrice: 100, salePrice: 90 }],
			};

			await savePriceHistory(deps, { params: { id, data: testData, site }, otelContext });

			// CreatePriceHistoryPathで生成されるパスと一致するか確認
			const expectedPath = CreatePriceHistoryPath(site, id);
			expect(expectedPath).toBe('sited/pricehistory/path-test.json');

			const stored = await env.HistoryR2.get(expectedPath);
			await stored?.text();
			expect(stored).not.toBe(null);
		});

		it('全サイト種別で正しいパスが使用される', async () => {
			const sites: Site[] = ['f', 'm', 'd', 's'];
			const id = 'multi-site-test';

			for (const site of sites) {
				const testData: PriceHistoryData = {
					date: '2024-01-15',
					prices: [{ name: `${site}サイト`, normalPrice: 100, salePrice: 90 }],
				};

				await savePriceHistory(deps, { params: { id, data: testData, site }, otelContext });

				const expectedPath = CreatePriceHistoryPath(site, id);
				expect(expectedPath).toBe(`site${site}/pricehistory/${id}.json`);

				const stored = await env.HistoryR2.get(expectedPath);
				await stored?.text();
				expect(stored).not.toBe(null);
			}
		});
	});

	describe('統合テスト', () => {
		it('保存→読み取りの完全な流れ', async () => {
			const site: Site = 'm';
			const id = 'integration-test';
			const testData: PriceHistoryData = {
				date: '2024-01-15',
				prices: [
					{ name: '基本', normalPrice: 1200, salePrice: 1080 },
					{ name: 'プレミアム', normalPrice: 1800, salePrice: 1620 },
				],
				sale: {
					id: 'winter2024',
					name: 'ウィンターセール',
					url: 'https://example.com/winter',
				},
			};

			// 保存
			await savePriceHistory(deps, { params: { id, data: testData, site }, otelContext });

			// 読み取り
			const result = await deps.readPriceHistory(site, id);

			expect(result.isOk()).toBe(true);

			if (result.isOk()) {
				const r2Object = result.value;
				const content = await r2Object!.text();
				const parsedData = JSON.parse(content);
				expect(parsedData).toEqual([testData]);
			}
		});
	});
});
