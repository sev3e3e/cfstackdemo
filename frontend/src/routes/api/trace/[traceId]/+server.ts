import { fetchEventsByMessage } from "$lib/axiom";
import api from "../../../../api.json";

export async function GET({ params, platform }) {
  // const traceId = params.traceId;

  // const aplQuery = `['cfstackdemo-trace'] | where trace_id =~ '${traceId}'`;

  // const rows = await fetchEventsByMessage(
  //   { token: platform?.env.AXIOM_API_TOKEN },
  //   { apl: aplQuery }
  // );

  // const cleanedResults = rows.map(removeNulls);

  // // log
  // const logQuery = `['cfstackdemo-log'] | where ['fields.traceId'] =~ '${traceId}'`;

  // const logRows = await fetchEventsByMessage(
  //   { token: platform?.env.AXIOM_API_TOKEN },
  //   { apl: logQuery }
  // );
  // const logData = logRows.map(removeNulls);

  // return new Response(
  //   JSON.stringify({
  //     trace: cleanedResults,
  //     log: logData,
  //   }),
  //   {
  //     headers: { "Content-Type": "application/json" },
  //   }
  // );
  return new Response(JSON.stringify(api));
}

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
