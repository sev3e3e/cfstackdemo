import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform, url }) => {
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "12", 10);
  const from = (page - 1) * limit;

  const items = await platform?.env?.MainD1Worker.getItems("production", {
    from,
    count: limit + 1,
  });

  const hasMore = items && items.length > limit;
  const itemsToReturn = items ? items.slice(0, limit) : [];

  return {
    items: itemsToReturn,
    pagination: {
      page,
      limit,
      hasMore,
    },
  };
};
