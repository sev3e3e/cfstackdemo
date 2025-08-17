export type Site = "f" | "m" | "d" | "s";

// UGLY: demo. 本来はSite事に取得できるデータが違う
export type DEMO_CommonSiteQueueData = {
  id: string;
  title: string;
  url: string;
  sale: {
    id: string;
    name: string;
    url: string;
  };
  otelContext: {
    parentSpanId: string;
    parentTraceId: string;
  };
  env: Environment;
};

// UGLY: demo. 本来はSite事に取得できるデータが違う
export type DEMO_CommonSiteScrapedData = {
  description: string;
  thumbUrl: string;
  samples: string[];
  prices: {
    name: string;
    normalPrice: number;
    salePrice: number;
  }[];
  maker: {
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

export type Environment =
  | "development"
  | "staging"
  | "production"
  | "example"
  | "test";
