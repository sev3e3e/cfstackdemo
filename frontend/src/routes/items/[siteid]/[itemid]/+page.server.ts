import { ConvertNumberIdToSite } from "@cfstackdemo/utility";
import type { PageServerLoad } from "./$types";
import { generatePastData } from "./lib";

export const load: PageServerLoad = async ({ params, platform }) => {
  const { siteid, itemid } = params;

  const item = await platform?.env?.MainD1Worker.getItem(
    Number(siteid),
    itemid,
    platform?.env.ENVIRONMENT
  );

  const pricehistory = await platform?.env.MainR2Worker.readPriceHistory(
    ConvertNumberIdToSite(Number(siteid)),
    itemid
  );

  const ph = pricehistory ? generatePastData(pricehistory[0]) : undefined;

  return {
    item: item,
    pricehistory: ph,
  };
};
