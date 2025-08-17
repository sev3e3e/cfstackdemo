import { ok, err, Result } from "neverthrow";
import type { DEMO_CommonSiteScrapedData } from "@cfstackdemo/types";
import parse from "node-html-parser";

export async function ScrapeItem(
  html: string
): Promise<Result<DEMO_CommonSiteScrapedData, unknown>> {
  if (!html || html === "") {
    return err(new Error("HTML content is empty"));
  }

  const parseResult = Result.fromThrowable(
    () => parse(html),
    (e) => e
  )();
  if (parseResult.isErr()) {
    return err(parseResult.error);
  }

  const root = parseResult.value;

  // Extract thumbnail URL from product image
  const thumbElement = root.querySelector("img.thumb");
  const thumbUrl = thumbElement?.getAttribute("src") || "";

  // Extract description
  const descriptionElement = root.querySelector(".description");
  const description = descriptionElement?.text || "";

  // Extract maker name
  const makerElement = root.querySelector(".maker");
  const makerText = makerElement?.text || "";
  const makerName = makerText.replace("メーカー: ", "").trim();

  // Extract prices
  const priceElements = root.querySelectorAll(".price-item");
  const prices = priceElements.map((priceEl) => {
    const nameElement = priceEl.querySelector("strong");
    const name = nameElement?.text || "";

    const salePriceElement = priceEl.querySelector(".sale-price");
    const normalPriceElement = priceEl.querySelector(".normal-price");

    const salePriceText = salePriceElement?.text || "0";
    const normalPriceText = normalPriceElement?.text || "0";

    const salePrice = parseInt(salePriceText.replace(/[¥,]/g, "")) || 0;
    const normalPrice = parseInt(normalPriceText.replace(/[¥,]/g, "")) || 0;

    return {
      name,
      normalPrice,
      salePrice,
    };
  });

  // Extract sample URLs
  const sampleElements = root.querySelectorAll(".sample-item");
  const samples = sampleElements.map((sampleEl) => {
    const text = sampleEl.text;
    // Extract URL from text, removing emoji prefix
    return text.replace(/^(?:🎬|🖼️)\s*/, "").trim();
  });

  // Extract reviews
  const reviewElements = root.querySelectorAll(".review");
  const reviews = reviewElements.map((reviewEl) => {
    const titleElement = reviewEl.querySelector(".review-header strong");
    const title = titleElement?.text || "";

    const ratingElement = reviewEl.querySelector(".rating");
    const ratingText = ratingElement?.text || "";
    const rating = (ratingText.match(/★/g) || []).length;

    const bodyElement = reviewEl.querySelector("p");
    const body = bodyElement?.innerHTML?.replace(/<br><br>/g, "\n\n") || "";

    const metaElement = reviewEl.querySelector(".review-meta");
    const metaText = metaElement?.text || "";

    // Extract review ID, reviewer name, reviewer ID, and date from format: "Review ID: uuid | Name (ID: uuid) - date"
    const metaMatch = metaText.match(
      /Review ID:\s+(.+?)\s+\|\s+(.+?)\s+\(ID:\s+(.+?)\)\s+-\s+(.+)$/
    );
    let reviewId = "";
    let reviewerName = "";
    let reviewerId = "";
    let dateStr = "";

    if (metaMatch) {
      reviewId = metaMatch[1].trim();
      reviewerName = metaMatch[2].trim();
      reviewerId = metaMatch[3].trim();
      dateStr = metaMatch[4].trim();
    }

    // Convert Japanese date format to ISO string
    let createdAt = new Date().toISOString();
    if (dateStr) {
      const [year, month, day] = dateStr.split("/");
      if (year && month && day) {
        createdAt = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day)
        ).toISOString();
      }
    }

    return {
      reviewId,
      title,
      body,
      rating,
      createdAt,
      reviewer: {
        id: reviewerId,
        name: reviewerName,
      },
    };
  });

  return ok({
    thumbUrl,
    description,
    samples,
    prices,
    maker: {
      name: makerName,
    },
    reviews,
  });
}

export type SiteFItemSummary = {
  id: string;
  title: string;
  url: string;
  thumb: string;
};

export type SiteFItemDetail = {
  description: string;
  sampleImageUrls: string[];
  sampleMovieUrl: string;
  prices: { name: string; price: number };
  maker: {
    id: number;
    name: string;
  };
  reviews: {
    reviewId: string;
    title: string;
    body: string;
    rating: number;
    createdAt: string;
    reviewer: {
      id: string;
      name: string;
    };
  }[];
};
