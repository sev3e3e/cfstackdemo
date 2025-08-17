import { fetchEventsByMessage } from "$lib/axiom";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform, url }) => {
  //   const axiom = new Axiom({
  //     token: platform?.env.AXIOM_API_TOKEN,
  //     orgId: platform?.env.AXIOM_ORG_ID,
  //   });

  const aplQuery = `['cfstackdemo-trace'] | where (['service.name'] =~ 'sitef-entrypoint' and name =~ 'sitef entrypoint') | take 10 | sort by _time | project trace_id, _time`;

  //   const res = await axiom.query(aplQuery, {
  //     startTime: "2023-10-23T15:46:25.089482+02:00",
  //     format: "tabular",
  //   });

  //   if (!res.tables || res.tables.length === 0) {
  //     console.warn("no tables found");
  //     return;
  //   }

  const rows = await fetchEventsByMessage(
    { token: platform?.env.AXIOM_API_TOKEN },
    {
      apl: aplQuery,
    }
  );

  const cleanedResults = rows.map(removeNulls);

  return {
    data: cleanedResults,
  };
};

function removeNulls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeNulls).filter((v) => v !== null && v !== undefined);
  }
  if (obj && typeof obj === "object") {
    const cleaned: Record<string, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      const cleanedValue = removeNulls(value);
      if (cleanedValue !== null && cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    });
    return cleaned;
  }
  return obj;
}
