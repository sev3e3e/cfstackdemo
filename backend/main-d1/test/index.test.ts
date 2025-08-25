// test/saveAll.test.ts
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { eq, count } from 'drizzle-orm';
import * as schema from '../src/schema';
import { CreateCommonDepsFromEnv, InsertAllDataInput, MainD1CommonDep, saveAll } from '../src/index';
import { NoopLogger } from '@cfstackdemo/logger';

describe('saveAll D1 Relations Test', () => {
	let deps: MainD1CommonDep;
	let db: ReturnType<typeof drizzle>;
	beforeAll(async () => {
		const newEnv = {
			...env,
			ENVIRONMENT: 'test' as const,
		};
		deps = await CreateCommonDepsFromEnv(newEnv);
		deps.logger = new NoopLogger();
	});
	beforeEach(async () => {
		// service = new TestSaveAllService(env);

		db = drizzle(env.MainD1, { schema });

		// テストデータをクリーンアップ（順序重要：外部キー制約のため）
		await env.MainD1.prepare('DELETE FROM samples').run();
		await env.MainD1.prepare('DELETE FROM reviews').run();
		await env.MainD1.prepare('DELETE FROM reviewers').run();
		await env.MainD1.prepare('DELETE FROM items').run();
		// sitesはseedで作成されるので削除しない
	});

	describe('Basic Functionality Tests', () => {
		it('relationを正しく保存できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm', // seedで既存
				item: {
					siteSpecificId: 'test-item-001',
					url: 'https://example.com/item/001',
					title: 'Test Item',
					description: 'A test item for unit testing',
					thumbUrl: 'https://example.com/thumb/001.jpg',
				},
				reviews: [
					{
						id: 'review-001',
						title: 'Great product!',
						body: 'This is an excellent product. Highly recommended.',
						rating: 5,
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: {
							id: 'reviewer-001',
							name: 'John Doe',
						},
					},
					{
						id: 'review-002',
						title: 'Good value',
						body: 'Good quality for the price.',
						rating: 4,
						createdAt: '2024-01-02T00:00:00Z',
						reviewer: {
							id: 'reviewer-002',
							name: 'Jane Smith',
						},
					},
				],
				samples: ['https://example.com/sample1.jpg', 'https://example.com/sample2.jpg'],
			};

			const result = await saveAll(deps, { data: testData, otelContext: { parentSpanId: '', parentTraceId: '' } });

			// アイテムが正しく挿入されたことを確認
			const insertedItem = await db.select().from(schema.items).where(eq(schema.items.id, 1)).get();

			expect(insertedItem).toBeDefined();
			expect(insertedItem!.siteId).toBe(1);
			expect(insertedItem!.title).toBe('Test Item');
			expect(insertedItem!.avgRating).toBe(4.5); // (5+4)/2 = 4.5
			expect(insertedItem!.reviewCount).toBe(2);

			// レビュワーが正しく挿入されたことを確認
			const reviewers = await db.select().from(schema.reviewers).all();
			expect(reviewers).toHaveLength(2);
			expect(reviewers.map((r) => r.name)).toContain('John Doe');
			expect(reviewers.map((r) => r.name)).toContain('Jane Smith');

			// レビューが正しく挿入され、relationが設定されていることを確認
			const reviews = await db.select().from(schema.reviews).where(eq(schema.reviews.itemId, 1)).all();
			expect(reviews).toHaveLength(2);
			expect(reviews.every((r) => r.itemId === 1)).toBe(true);
			expect(reviews.every((r) => r.siteId === 1)).toBe(true);

			// サンプルが正しく挿入されていることを確認
			const samples = await db.select().from(schema.samples).where(eq(schema.samples.itemId, 1)).all();
			expect(samples).toHaveLength(2);
			expect(samples.map((s) => s.url)).toContain('https://example.com/sample1.jpg');
			expect(samples.map((s) => s.url)).toContain('https://example.com/sample2.jpg');
		});

		it('重複レビュワーを適切に処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'd',
				item: {
					siteSpecificId: 'test-item-003',
					url: 'https://example.com/item/003',
					title: 'Test Item 3',
					description: 'Test item for duplicate reviewer',
				},
				reviews: [
					{
						id: 'review-003',
						title: 'First review',
						body: 'This is the first review.',
						rating: 3,
						createdAt: '2024-01-03T00:00:00Z',
						reviewer: {
							id: 'reviewer-duplicate',
							name: 'Duplicate Reviewer',
						},
					},
					{
						id: 'review-004',
						title: 'Second review',
						body: 'This is the second review by the same person.',
						rating: 4,
						createdAt: '2024-01-04T00:00:00Z',
						reviewer: {
							id: 'reviewer-duplicate', // 同じレビュワーID
							name: 'Duplicate Reviewer',
						},
					},
				],
				samples: [],
			};

			const result = await saveAll(deps, { data: testData, otelContext: { parentSpanId: '', parentTraceId: '' } });

			// レビュワーが1人だけ作成されていることを確認
			const reviewers = await db.select().from(schema.reviewers).where(eq(schema.reviewers.reviewerId, 'reviewer-duplicate')).all();
			expect(reviewers).toHaveLength(1);

			// 両方のレビューが同じレビュワーIDを参照していることを確認
			const reviews = await db.select().from(schema.reviews).where(eq(schema.reviews.itemId, 1)).all();
			expect(reviews).toHaveLength(2);
			expect(reviews[0].reviewerId).toBe(reviews[1].reviewerId);
		});

		it('JOINクエリで参照整合性を維持できる', async () => {
			// テストデータを準備
			const testData: InsertAllDataInput['data'] = {
				site: 's',
				item: {
					siteSpecificId: 'test-item-004',
					url: 'https://example.com/item/004',
					title: 'Join Test Item',
					description: 'Item for testing JOIN queries',
				},
				reviews: [
					{
						id: 'review-005',
						title: 'Join test review',
						body: 'Testing JOIN operations.',
						rating: 4,
						createdAt: '2024-01-05T00:00:00Z',
						reviewer: {
							id: 'reviewer-join-test',
							name: 'Join Tester',
						},
					},
				],
				samples: ['https://example.com/join-sample.jpg'],
			};

			await saveAll(deps, { data: testData, otelContext: { parentSpanId: '', parentTraceId: '' } });

			// 複雑なJOINクエリでrelationの整合性を確認
			const joinQuery = await env.MainD1.prepare(
				`
      SELECT 
        i.title as item_title,
        s.name as site_name,
        r.title as review_title,
        rv.name as reviewer_name,
        sam.url as sample_url
      FROM items i
      JOIN sites s ON i.site_id = s.id
      LEFT JOIN reviews r ON i.id = r.item_id
      LEFT JOIN reviewers rv ON r.reviewer_id = rv.id
      LEFT JOIN samples sam ON i.id = sam.item_id
      WHERE i.id = ?
    `,
			)
				.bind(1)
				.all();

			expect(joinQuery.results).toHaveLength(1);
			const row = joinQuery.results[0] as any;
			expect(row.item_title).toBe('Join Test Item');
			expect(row.site_name).toBe('s');
			expect(row.review_title).toBe('Join test review');
			expect(row.reviewer_name).toBe('Join Tester');
			expect(row.sample_url).toBe('https://example.com/join-sample.jpg');
		});

		it('様々な評価値で平均評価を正しく計算', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-item-006',
					url: 'https://example.com/item/006',
					title: 'Rating Test Item',
					description: 'Item for testing rating calculations',
				},
				reviews: [
					{
						id: 'review-006',
						title: 'Bad review',
						body: 'Not good.',
						rating: 1,
						createdAt: '2024-01-06T00:00:00Z',
						reviewer: { id: 'reviewer-006', name: 'Critic' },
					},
					{
						id: 'review-007',
						title: 'Average review',
						body: "It's okay.",
						rating: 3,
						createdAt: '2024-01-07T00:00:00Z',
						reviewer: { id: 'reviewer-007', name: 'Average User' },
					},
					{
						id: 'review-008',
						title: 'Excellent review',
						body: 'Perfect!',
						rating: 5,
						createdAt: '2024-01-08T00:00:00Z',
						reviewer: { id: 'reviewer-008', name: 'Fan' },
					},
				],
				samples: [],
			};

			await saveAll(deps, { data: testData, otelContext: { parentSpanId: '', parentTraceId: '' } });

			const item = await db.select().from(schema.items).where(eq(schema.items.id, 1)).get();

			// 平均評価の計算: (1+3+5)/3 = 3
			expect(item!.avgRating).toBe(3);
			expect(item!.reviewCount).toBe(3);
		});
	});

	describe('error handling', () => {
		it('無効なサイト名を処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'invalid-site' as any, // 存在しないサイト
				item: {
					siteSpecificId: 'test-item-error',
					url: 'https://example.com/item/error',
					title: 'Error Test Item',
					description: 'Item for testing errors',
				},
				reviews: [],
				samples: [],
			};

			// ConvertSiteToNumberIdがundefinedを返し、SQL実行時にエラーになることを期待
			await expect(
				saveAll(deps, {
					data: testData,
					otelContext: { parentSpanId: '', parentTraceId: '' },
				}),
			).rejects.toThrow();

			// データベースにゴミデータが残っていないことを確認
			const items = await db.select().from(schema.items).all();
			expect(items).toHaveLength(0);
		});

		it('null評価値を計算で処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-null-rating',
					url: 'https://example.com/null-rating',
					title: 'Null Rating Test',
					description: 'Testing null rating handling',
				},
				reviews: [
					{
						id: 'review-null-1',
						title: 'Review with null rating',
						body: 'This review has no rating',
						rating: null as any, // TypeScriptの型チェックを回避
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: { id: 'reviewer-null', name: 'Null Reviewer' },
					},
					{
						id: 'review-null-2',
						title: 'Review with valid rating',
						body: 'This review has a rating',
						rating: 4,
						createdAt: '2024-01-02T00:00:00Z',
						reviewer: { id: 'reviewer-valid', name: 'Valid Reviewer' },
					},
				],
				samples: [],
			};

			await saveAll(deps, {
				data: testData,
				otelContext: { parentSpanId: '', parentTraceId: '' },
			});

			const item = await db.select().from(schema.items).where(eq(schema.items.id, 1)).get();

			// 期待する正しい動作をテスト
			expect(item!.avgRating).toBe(4); // null除外して計算された正しい値
			expect(item!.reviewCount).toBe(2);
		});

		it('極端に長い文字列を処理できる', async () => {
			const longString = 'a'.repeat(10000); // 10KB の文字列

			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-long-strings',
					url: 'https://example.com/long',
					title: longString,
					description: longString,
				},
				reviews: [
					{
						id: 'review-long',
						title: longString,
						body: longString,
						rating: 5,
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: { id: 'reviewer-long', name: longString },
					},
				],
				samples: [],
			};

			// SQLiteの文字列制限に引っかからないことを確認
			await expect(
				saveAll(deps, {
					data: testData,
					otelContext: { parentSpanId: '', parentTraceId: '' },
				}),
			).resolves.not.toThrow();

			// データが正しく保存されていることを確認
			const item = await db.select().from(schema.items).where(eq(schema.items.id, 1)).get();
			expect(item!.title).toBe(longString);
		});
	});

	describe('boundary value tests', () => {
		it('ゼロおよび負の評価値を処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-boundary-rating',
					url: 'https://example.com/boundary',
					title: 'Boundary Rating Test',
					description: 'Testing boundary rating values',
				},
				reviews: [
					{
						id: 'review-zero',
						title: 'Zero rating',
						body: 'Rating is zero',
						rating: 0,
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: { id: 'reviewer-zero', name: 'Zero Reviewer' },
					},
					{
						id: 'review-negative',
						title: 'Negative rating',
						body: 'Rating is negative',
						rating: -1,
						createdAt: '2024-01-02T00:00:00Z',
						reviewer: { id: 'reviewer-negative', name: 'Negative Reviewer' },
					},
					{
						id: 'review-positive',
						title: 'Positive rating',
						body: 'Rating is positive',
						rating: 3,
						createdAt: '2024-01-03T00:00:00Z',
						reviewer: { id: 'reviewer-positive', name: 'Positive Reviewer' },
					},
				],
				samples: [],
			};

			await saveAll(deps, {
				data: testData,
				otelContext: { parentSpanId: '', parentTraceId: '' },
			});

			const item = await db.select().from(schema.items).where(eq(schema.items.id, 1)).get();

			// (0 + (-1) + 3) / 3 = 2/3 ≈ 0.6667
			expect(item!.avgRating).toBeCloseTo(0.6667, 4);
			expect(item!.reviewCount).toBe(3);
		});

		it('特殊文字とSQLインジェクション攻撃を処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-special-chars',
					url: 'https://example.com/special',
					title: 'Special Characters Test',
					description: 'Testing special characters in names',
				},
				reviews: [
					{
						id: 'review-injection',
						title: 'SQL Injection Test',
						body: 'Testing potential SQL injection',
						rating: 5,
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: {
							id: 'reviewer-injection',
							name: "Robert'); DROP TABLE reviews; --",
						},
					},
					{
						id: 'review-unicode',
						title: 'Unicode test',
						body: 'Testing unicode characters',
						rating: 4,
						createdAt: '2024-01-02T00:00:00Z',
						reviewer: {
							id: 'reviewer-unicode',
							name: '山田太郎 🎌 café naïve résumé',
						},
					},
				],
				samples: [],
			};

			// SQL injectionや特殊文字でエラーが発生しないことを確認
			await expect(
				saveAll(deps, {
					data: testData,
					otelContext: { parentSpanId: '', parentTraceId: '' },
				}),
			).resolves.not.toThrow();

			// データが正しく保存され、reviewsテーブルが削除されていないことを確認
			const reviews = await db.select().from(schema.reviews).all();
			expect(reviews).toHaveLength(2);

			const reviewers = await db.select().from(schema.reviewers).all();
			expect(reviewers.some((r) => r.name.includes('山田太郎'))).toBe(true);
			expect(reviewers.some((r) => r.name.includes('DROP TABLE'))).toBe(true);
		});

		it('空のレビューとサンプル配列を処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'f',
				item: {
					siteSpecificId: 'test-item-005',
					url: 'https://example.com/item/005',
					title: 'Empty Relations Item',
					description: 'Item with no reviews or samples',
				},
				reviews: [], // 空の配列
				samples: [], // 空の配列
			};

			await saveAll(deps, { data: testData, otelContext: { parentSpanId: '', parentTraceId: '' } });

			// アイテムは作成されるが、avgRatingとreviewCountはnullまたは0になることを確認
			const item = await db.select().from(schema.items).where(eq(schema.items.id, 1)).get();

			expect(item).toBeDefined();
			expect(item!.reviewCount).toBe(0); // 空配列なので0

			// 関連するレビューやサンプルが存在しないことを確認
			const reviews = await db.select().from(schema.reviews).where(eq(schema.reviews.itemId, 1)).all();
			expect(reviews).toHaveLength(0);

			const samples = await db.select().from(schema.samples).where(eq(schema.samples.itemId, 1)).all();
			expect(samples).toHaveLength(0);
		});
	});

	describe('idempotency tests', () => {
		it('アイテム挿入において冪等性を保つ', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-idempotent',
					url: 'https://example.com/idempotent',
					title: 'Idempotent Test',
					description: 'Testing idempotent operations',
				},
				reviews: [],
				samples: [],
			};

			const requestData = {
				data: testData,
				otelContext: { parentSpanId: '', parentTraceId: '' },
			};

			// 1回目の実行
			await saveAll(deps, requestData);

			const itemsAfterFirst = await db.select().from(schema.items).all();
			expect(itemsAfterFirst).toHaveLength(1);
			const firstItemId = itemsAfterFirst[0].id;

			// 2回目の実行（同じデータ）
			await saveAll(deps, requestData);

			// itemは重複せず、同じIDが使われることを確認
			const itemsAfterSecond = await db.select().from(schema.items).all();
			expect(itemsAfterSecond).toHaveLength(1);
			expect(itemsAfterSecond[0].id).toBe(firstItemId);
		});

		it('重複サンプルURLを処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-duplicate-samples',
					url: 'https://example.com/duplicate-samples',
					title: 'Duplicate Samples Test',
					description: 'Testing duplicate sample URLs',
				},
				reviews: [],
				samples: [
					'https://example.com/sample1.jpg',
					'https://example.com/sample2.jpg',
					'https://example.com/sample1.jpg', // 重複
					'https://example.com/sample3.jpg',
				],
			};

			await saveAll(deps, {
				data: testData,
				otelContext: { parentSpanId: '', parentTraceId: '' },
			});

			const items = await db.select().from(schema.items).all();
			expect(items).toHaveLength(1);

			const zz = await db.select().from(schema.samples).all();
			expect(zz).toHaveLength(4);

			const samples = await db.select().from(schema.samples).where(eq(schema.samples.itemId, 1)).all();

			// 現在の実装では重複がそのまま入る（制限事項として記録）
			expect(samples).toHaveLength(4);

			// 重複したURLが両方とも存在することを確認
			const urls = samples.map((s) => s.url);
			expect(urls.filter((url) => url === 'https://example.com/sample1.jpg')).toHaveLength(2);
		});
	});

	describe('reviewer handling edge cases', () => {
		it('同名異IDのレビュワーを処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-same-name-reviewer',
					url: 'https://example.com/same-name',
					title: 'Same Name Reviewer Test',
					description: 'Testing reviewers with same name',
				},
				reviews: [
					{
						id: 'review-1',
						title: 'First review',
						body: 'First review by John',
						rating: 4,
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: { id: 'john-1', name: 'John Smith' },
					},
					{
						id: 'review-2',
						title: 'Second review',
						body: 'Second review by different John',
						rating: 5,
						createdAt: '2024-01-02T00:00:00Z',
						reviewer: { id: 'john-2', name: 'John Smith' }, // 同名、異なるID
					},
				],
				samples: [],
			};

			await saveAll(deps, {
				data: testData,
				otelContext: { parentSpanId: '', parentTraceId: '' },
			});

			// 現在の実装では名前でマッピングするため、同名の場合は同じレビュワーとして扱われる
			const reviewers = await db.select().from(schema.reviewers).where(eq(schema.reviewers.name, 'John Smith')).all();
			expect(reviewers).toHaveLength(1); // 1人だけ作成される

			const reviews = await db.select().from(schema.reviews).where(eq(schema.reviews.itemId, 1)).all();
			expect(reviews).toHaveLength(2);
			expect(reviews[0].reviewerId).toBe(reviews[1].reviewerId); // 同じレビュワーIDを参照
		});

		it('レビュワーマッピング失敗を適切に処理できる', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-missing-reviewer',
					url: 'https://example.com/missing-reviewer',
					title: 'Missing Reviewer Test',
					description: 'Testing missing reviewer scenario',
				},
				reviews: [
					{
						id: 'review-missing',
						title: 'Review with missing reviewer',
						body: 'This should not happen in normal flow',
						rating: 3,
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: { id: 'missing-reviewer', name: 'Missing Reviewer' },
					},
				],
				samples: [],
			};

			// 正常に動作することを確認（現在の実装では問題なし）
			await expect(
				saveAll(deps, {
					data: testData,
					otelContext: { parentSpanId: '', parentTraceId: '' },
				}),
			).resolves.not.toThrow();

			const reviews = await db.select().from(schema.reviews).where(eq(schema.reviews.itemId, 1)).all();
			expect(reviews).toHaveLength(1);
			expect(reviews[0].reviewerId).toBeTypeOf('number');
		});
	});

	describe('floating point precision', () => {
		it('平均評価計算を精度よく行える', async () => {
			const testData: InsertAllDataInput['data'] = {
				site: 'm',
				item: {
					siteSpecificId: 'test-precision',
					url: 'https://example.com/precision',
					title: 'Precision Test',
					description: 'Testing floating point precision',
				},
				reviews: [
					{
						id: 'review-1',
						title: 'Review 1',
						body: 'Rating 1',
						rating: 1,
						createdAt: '2024-01-01T00:00:00Z',
						reviewer: { id: 'reviewer-1', name: 'Reviewer 1' },
					},
					{
						id: 'review-2',
						title: 'Review 2',
						body: 'Rating 2',
						rating: 2,
						createdAt: '2024-01-02T00:00:00Z',
						reviewer: { id: 'reviewer-2', name: 'Reviewer 2' },
					},
					{
						id: 'review-3',
						title: 'Review 3',
						body: 'Rating 5',
						rating: 5,
						createdAt: '2024-01-03T00:00:00Z',
						reviewer: { id: 'reviewer-3', name: 'Reviewer 3' },
					},
				],
				samples: [],
			};

			await saveAll(deps, {
				data: testData,
				otelContext: { parentSpanId: '', parentTraceId: '' },
			});

			const item = await db.select().from(schema.items).where(eq(schema.items.id, 1)).get();

			// (1 + 2 + 5) / 3 = 8/3 ≈ 2.6667
			expect(item!.avgRating).toBeCloseTo(2.6667, 4);
			expect(item!.reviewCount).toBe(3);
		});
	});
});
