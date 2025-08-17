import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform }) => {
  const { siteid, itemid } = params;

  const item = await platform?.env?.MainD1Worker.getItem(
    Number(siteid),
    itemid,
    platform?.env.ENVIRONMENT
  );
  return {
    item: item,
  };
};
