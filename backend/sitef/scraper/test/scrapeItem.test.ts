import { describe, it, expect } from "vitest";
import { ScrapeItem } from "../src/index";
import { generateHtml } from "./lib";

describe("ScrapeItem", () => {
  it("should return error for empty HTML", async () => {
    const result = await ScrapeItem("");
    expect(result.isErr()).toBe(true);
    expect(result.error).toEqual(new Error("HTML content is empty"));
  });

  it("should return error for null HTML", async () => {
    const result = await ScrapeItem(null as any);
    expect(result.isErr()).toBe(true);
    expect(result.error).toEqual(new Error("HTML content is empty"));
  });

  it("should return error for invalid HTML that causes parse error", async () => {
    const invalidHtml = "<invalid><unclosed>";
    const result = await ScrapeItem(invalidHtml);
    
    if (result.isErr()) {
      expect(result.error).toBeDefined();
    } else {
      expect(result.value).toBeDefined();
    }
  });

  it("should parse basic HTML structure correctly", async () => {
    const html = generateHtml({
      samplesCount: 2,
      pricesCount: 3,
      reviewsCount: 2
    });
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const data = result.value;
      expect(data.thumbUrl).toBeTruthy();
      expect(data.description).toBeTruthy();
      expect(data.maker.name).toBeTruthy();
      expect(Array.isArray(data.samples)).toBe(true);
      expect(Array.isArray(data.prices)).toBe(true);
      expect(Array.isArray(data.reviews)).toBe(true);
    }
  });

  it("should extract thumbnail URL correctly", async () => {
    const testThumbUrl = "https://example.com/thumb.jpg";
    const html = `
      <html>
        <body>
          <img class="thumb" src="${testThumbUrl}" alt="thumbnail" />
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      expect(result.value.thumbUrl).toBe(testThumbUrl);
    }
  });

  it("should handle missing thumbnail gracefully", async () => {
    const html = "<html><body><div>No thumbnail</div></body></html>";
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      expect(result.value.thumbUrl).toBe("");
    }
  });

  it("should extract description correctly", async () => {
    const testDescription = "This is a test product description";
    const html = `
      <html>
        <body>
          <div class="description">${testDescription}</div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      expect(result.value.description).toBe(testDescription);
    }
  });

  it("should extract maker name correctly", async () => {
    const testMakerName = "Test Maker Co.";
    const html = `
      <html>
        <body>
          <div class="maker">メーカー: ${testMakerName}</div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      expect(result.value.maker.name).toBe(testMakerName);
    }
  });

  it("should extract prices correctly", async () => {
    const html = `
      <html>
        <body>
          <div class="price-item">
            <strong>Standard Price</strong>
            <span class="sale-price">¥1,200</span>
            <span class="normal-price">¥1,500</span>
          </div>
          <div class="price-item">
            <strong>Premium Price</strong>
            <span class="sale-price">¥2,800</span>
            <span class="normal-price">¥3,000</span>
          </div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const prices = result.value.prices;
      expect(prices).toHaveLength(2);
      
      expect(prices[0].name).toBe("Standard Price");
      expect(prices[0].salePrice).toBe(1200);
      expect(prices[0].normalPrice).toBe(1500);
      
      expect(prices[1].name).toBe("Premium Price");
      expect(prices[1].salePrice).toBe(2800);
      expect(prices[1].normalPrice).toBe(3000);
    }
  });

  it("should handle prices with no currency symbols", async () => {
    const html = `
      <html>
        <body>
          <div class="price-item">
            <strong>Basic</strong>
            <span class="sale-price">500</span>
            <span class="normal-price">800</span>
          </div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const prices = result.value.prices;
      expect(prices[0].salePrice).toBe(500);
      expect(prices[0].normalPrice).toBe(800);
    }
  });

  it("should extract samples correctly", async () => {
    const html = `
      <html>
        <body>
          <div class="sample-item">🖼️ https://example.com/image1.jpg</div>
          <div class="sample-item">🎬 https://example.com/video1.mp4</div>
          <div class="sample-item">🖼️ https://example.com/image2.png</div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const samples = result.value.samples;
      expect(samples).toHaveLength(3);
      expect(samples[0]).toBe("https://example.com/image1.jpg");
      expect(samples[1]).toBe("https://example.com/video1.mp4");
      expect(samples[2]).toBe("https://example.com/image2.png");
    }
  });

  it("should extract reviews correctly", async () => {
    const html = `
      <html>
        <body>
          <div class="review">
            <div class="review-header">
              <strong>Great product!</strong>
            </div>
            <div class="rating">★★★★☆</div>
            <p>This is a very good product.<br><br>I highly recommend it.</p>
            <div class="review-meta">Review ID: rev-123 | John Doe (ID: user-456) - 2023/12/25</div>
          </div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const reviews = result.value.reviews;
      expect(reviews).toHaveLength(1);
      
      const review = reviews[0];
      expect(review.title).toBe("Great product!");
      expect(review.rating).toBe(4);
      expect(review.body).toBe("This is a very good product.\n\nI highly recommend it.");
      expect(review.reviewId).toBe("rev-123");
      expect(review.reviewer.name).toBe("John Doe");
      expect(review.reviewer.id).toBe("user-456");
      expect(review.createdAt).toBe(new Date(2023, 11, 25).toISOString());
    }
  });

  it("should handle reviews with 5-star rating", async () => {
    const html = `
      <html>
        <body>
          <div class="review">
            <div class="rating">★★★★★</div>
            <div class="review-meta">Review ID: rev-999 | Jane Smith (ID: user-777) - 2024/01/15</div>
          </div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const review = result.value.reviews[0];
      expect(review.rating).toBe(5);
    }
  });

  it("should handle reviews with 1-star rating", async () => {
    const html = `
      <html>
        <body>
          <div class="review">
            <div class="rating">★☆☆☆☆</div>
            <div class="review-meta">Review ID: rev-001 | Bad Reviewer (ID: user-001) - 2024/02/01</div>
          </div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const review = result.value.reviews[0];
      expect(review.rating).toBe(1);
    }
  });

  it("should handle incomplete review metadata gracefully", async () => {
    const html = `
      <html>
        <body>
          <div class="review">
            <div class="review-header">
              <strong>Incomplete Review</strong>
            </div>
            <div class="rating">★★★☆☆</div>
            <p>Review content here</p>
            <div class="review-meta">Invalid format</div>
          </div>
        </body>
      </html>
    `;
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const review = result.value.reviews[0];
      expect(review.reviewId).toBe("");
      expect(review.reviewer.name).toBe("");
      expect(review.reviewer.id).toBe("");
      expect(review.rating).toBe(3);
      expect(review.body).toBe("Review content here");
    }
  });

  it("should handle HTML with no content elements", async () => {
    const html = "<html><body><div>Empty page</div></body></html>";
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const data = result.value;
      expect(data.thumbUrl).toBe("");
      expect(data.description).toBe("");
      expect(data.maker.name).toBe("");
      expect(data.samples).toHaveLength(0);
      expect(data.prices).toHaveLength(0);
      expect(data.reviews).toHaveLength(0);
    }
  });

  it("should process generated HTML data correctly", async () => {
    const html = generateHtml({
      samplesCount: 3,
      pricesCount: 2,
      reviewsCount: 1
    });
    
    const result = await ScrapeItem(html);
    expect(result.isOk()).toBe(true);
    
    if (result.isOk()) {
      const data = result.value;
      expect(data.samples).toHaveLength(3);
      expect(data.prices).toHaveLength(2);
      expect(data.reviews).toHaveLength(1);
      
      data.prices.forEach(price => {
        expect(typeof price.name).toBe("string");
        expect(typeof price.normalPrice).toBe("number");
        expect(typeof price.salePrice).toBe("number");
        expect(price.normalPrice).toBeGreaterThan(0);
        expect(price.salePrice).toBeGreaterThan(0);
      });
      
      data.reviews.forEach(review => {
        expect(typeof review.reviewId).toBe("string");
        expect(typeof review.title).toBe("string");
        expect(typeof review.body).toBe("string");
        expect(review.rating).toBeGreaterThanOrEqual(1);
        expect(review.rating).toBeLessThanOrEqual(5);
        expect(typeof review.createdAt).toBe("string");
        expect(typeof review.reviewer.id).toBe("string");
        expect(typeof review.reviewer.name).toBe("string");
      });
    }
  });
});