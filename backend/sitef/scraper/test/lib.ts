import type { DEMO_CommonSiteScrapedData } from "@cfstackdemo/types";
import { faker } from "@faker-js/faker/locale/en";

export interface GenerateScrapedDataOptions {
  samplesCount?: { min: number; max: number } | number;
  pricesCount?: { min: number; max: number } | number;
  reviewsCount?: { min: number; max: number } | number;
}

export function generateScrapedData(
  options: GenerateScrapedDataOptions = {}
): DEMO_CommonSiteScrapedData {
  const {
    samplesCount = { min: 1, max: 5 },
    pricesCount = { min: 2, max: 5 },
    reviewsCount = { min: 0, max: 10 },
  } = options;

  // 数値またはmin/maxオブジェクトから実際の数を決定
  const getSampleCount = (
    count: { min: number; max: number } | number
  ): number => {
    return typeof count === "number" ? count : faker.number.int(count);
  };

  const _normalp = faker.number.int({ min: 300, max: 1000 });
  const samplesTotal = getSampleCount(samplesCount);

  // 画像とムービーの比率を調整（最低1つは画像）
  const movieCount = Math.min(1, samplesTotal);
  const imageCount = Math.max(1, samplesTotal - movieCount);

  const sampleImgUrls = Array.from({ length: imageCount }, () =>
    faker.image.url()
  );
  const sampleMovieUrls = Array.from(
    { length: movieCount },
    () => faker.internet.url({ appendSlash: false }) + ".mp4"
  );

  return {
    thumbUrl: faker.image.url(),
    description: faker.commerce.productDescription(),
    samples: [...sampleImgUrls, ...sampleMovieUrls],
    prices: Array.from({ length: getSampleCount(pricesCount) }, () => ({
      name: faker.commerce.department(),
      normalPrice: _normalp,
      salePrice: _normalp - faker.number.int({ min: 100, max: 150 }),
    })),
    maker: {
      name: faker.company.name(),
    },
    reviews: Array.from({ length: getSampleCount(reviewsCount) }, () => {
      return {
        reviewId: faker.string.uuid(),
        title: faker.lorem.sentence({ min: 3, max: 8 }),
        body: faker.lorem.paragraphs(2, "\n\n"),
        rating: faker.number.int({ min: 1, max: 5 }),
        createdAt: faker.date.past({ years: 2 }).toISOString(),
        reviewer: {
          id: faker.string.uuid(),
          name: faker.person.fullName(),
        },
      };
    }),
  };
}

export function generateHtml(options: GenerateScrapedDataOptions = {}) {
  const {
    samplesCount = { min: 1, max: 5 },
    pricesCount = { min: 2, max: 5 },
    reviewsCount = { min: 0, max: 10 },
  } = options;

  const data = generateScrapedData({ pricesCount, reviewsCount, samplesCount });

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.maker.name} - 商品詳細</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .product-header { display: flex; gap: 20px; margin-bottom: 30px; }
        .thumb { max-width: 300px; height: auto; }
        .product-info { flex: 1; }
        .maker { color: #666; margin-bottom: 10px; }
        .prices { margin: 20px 0; }
        .price-item { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
        .sale-price { color: #e74c3c; font-weight: bold; }
        .normal-price { text-decoration: line-through; color: #999; }
        .samples { margin: 20px 0; }
        .sample-item { margin: 5px; padding: 5px; background: #e8f4fd; border-radius: 3px; display: inline-block; }
        .reviews { margin-top: 30px; }
        .review { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .rating { color: #f39c12; }
        .review-meta { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="product-header">
        <img src="${data.thumbUrl}" alt="商品画像" class="thumb">
        <div class="product-info">
            <div class="maker">メーカー: ${data.maker.name}</div>
            <p class="description">${data.description}</p>
            
            <div class="prices">
                <h3>価格一覧</h3>
                ${data.prices
                  .map(
                    (price) => `
                    <div class="price-item">
                        <strong>${price.name}</strong><br>
                        <span class="sale-price">¥${price.salePrice.toLocaleString()}</span>
                        <span class="normal-price">¥${price.normalPrice.toLocaleString()}</span>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    </div>

    <div class="samples">
        <h3>サンプル</h3>
        ${data.samples
          .map(
            (sample) => `
            <span class="sample-item">${
              sample.endsWith(".mp4") ? "🎬" : "🖼️"
            } ${sample}</span>
        `
          )
          .join("")}
    </div>

    <div class="reviews">
        <h3>レビュー (${data.reviews.length}件)</h3>
        ${data.reviews
          .map(
            (review) => `
            <div class="review">
                <div class="review-header">
                    <strong>${review.title}</strong>
                    <span class="rating">${"★".repeat(
                      review.rating
                    )}${"☆".repeat(5 - review.rating)}</span>
                </div>
                <p>${review.body.replace(/\n\n/g, "<br><br>")}</p>
                <div class="review-meta">
                    Review ID: ${review.reviewId} | ${
              review.reviewer.name
            } (ID: ${review.reviewer.id}) - ${new Date(
              review.createdAt
            ).toLocaleDateString("ja-JP")}
                </div>
            </div>
        `
          )
          .join("")}
    </div>

</body>
</html>`;

  return html;
}
