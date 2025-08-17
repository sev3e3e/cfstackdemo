import { Hono } from "hono";
import { faker } from "@faker-js/faker";
import type { DEMO_CommonSiteScrapedData } from "@cfstackdemo/types";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/sitef/hidden-sale-api", (c) => {
  const query = c.req.query();

  const count = Number(query["count"] ?? 1);

  return c.json(
    Array.from({ length: count }, () => ({
      id: faker.string.uuid(),
      url: faker.internet.url(),
      name: `sale-${faker.number.int({ min: 0, max: 100 })}`,
      banner_img: faker.image.url(),
      banner_width: faker.number.int({ min: 800, max: 1920 }),
      banner_height: faker.number.int({ min: 400, max: 1080 }),
    }))
  );
});

app.get("/sitef/api/item", (c) => {
  const query = c.req.query();

  // const keyword = query["keyword"] ?? "";
  // const category = query["category"] ?? "";
  // const offset = Number(query["offset"] ?? "0");

  if (!query["count"]) {
    return c.text("no count param", 400);
  }

  const count = Number(query["count"]);

  return c.json(
    Array.from({ length: count }, () => ({
      id: faker.string.uuid(),
      title: faker.commerce.productName(),
      url: faker.internet.url(),
      sampleImageUrls: Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => faker.image.url()
      ),
      sampleMovieUrl: faker.internet.url({ appendSlash: false }) + ".mp4",
      prices: Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => ({
          name: faker.commerce.department(),
          price: faker.number.int({ min: 100, max: 50000 }),
        })
      ),
      maker: {
        id: faker.number.int({ min: 1, max: 1000 }),
        name: faker.company.name(),
      },
    }))
  );
});

function generateScrapedData(): DEMO_CommonSiteScrapedData {
  const _normalp = faker.number.int({ min: 300, max: 1000 });
  const sampleImgUrls = Array.from(
    { length: faker.number.int({ min: 1, max: 5 }) },
    () => faker.image.url()
  );
  const sampleMovieUrl = faker.internet.url({ appendSlash: false }) + ".mp4";

  return {
    thumbUrl: faker.image.url(),
    description: faker.commerce.productDescription(),
    samples: [...sampleImgUrls, sampleMovieUrl],
    prices: Array.from(
      { length: faker.number.int({ min: 2, max: 5 }) },
      () => ({
        name: faker.commerce.department(),
        normalPrice: _normalp,
        salePrice: _normalp - faker.number.int({ min: 100, max: 150 }),
      })
    ),
    maker: {
      name: faker.company.name(),
    },
    reviews: Array.from(
      { length: faker.number.int({ min: 0, max: 10 }) },
      () => {
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
      }
    ),
  };
}

app.get("/sitef/item/detail", (c) => {
  const data = generateScrapedData();

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
                    Review ID: ${review.reviewId} | ${review.reviewer.name} (ID: ${review.reviewer.id}) - ${new Date(
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

  return c.html(html);
});

export default app;
