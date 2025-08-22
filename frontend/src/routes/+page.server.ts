import type { PageServerLoad } from "./$types";
import { fetchEventsByMessage } from "$lib/axiom";

export const load: PageServerLoad = async ({ platform }) => {
  // UGLY: but....
  if (!platform?.env.AXIOM_ORG_ID || !platform?.env.AXIOM_API_TOKEN) {
    console.warn(
      "Axiom org id or Axiom API Token is not provided, use mocked datas."
    );

    const data = (await import("../mockedData/api.json")).default;
    const traceHistoryData = (await import("../mockedData/tracehistory.json"))
      .default;

    return {
      traceData: data.trace,
      logData: data.log,
      traceHistoryData: traceHistoryData.data,
    };
  }

  const traceHistoryQuery = `['cfstackdemo-trace'] | where (['service.name'] =~ 'sitef-entrypoint' and name =~ 'sitef entrypoint') | take 10 | sort by _time | project trace_id, _time`;

  const traceHistoryRows = await fetchEventsByMessage(
    { token: platform?.env.AXIOM_API_TOKEN },
    { apl: traceHistoryQuery }
  );

  const traceHistoryData = traceHistoryRows.map(removeNulls);

  // 初期データとして最初のtrace, logのみ取得する
  const traceQuery = `['cfstackdemo-trace'] | where ['trace_id'] =~ '${traceHistoryData[0].trace_id}'`;

  const traceRows = await fetchEventsByMessage(
    { token: platform?.env.AXIOM_API_TOKEN },
    { apl: traceQuery }
  );
  const traceData = traceRows.map(removeNulls);

  // log
  const logQuery = `['cfstackdemo-log'] | where ['fields.traceId'] =~ '${traceHistoryData[0].trace_id}'`;

  const logRows = await fetchEventsByMessage(
    { token: platform?.env.AXIOM_API_TOKEN },
    { apl: logQuery }
  );
  const logData = logRows.map(removeNulls);

  return {
    traceData,
    logData,
    traceHistoryData,
  };

  // return {
  //   traceData: traceData.data as any,
  //   logData: logData.data as any,
  //   traceHistoryData: traceHistoryData.data as any,
  // };
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
