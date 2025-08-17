/**
 * AXIOM API で、特定の dataset から message が完全一致するイベントを取得します。
 * ライブラリ不使用（標準 fetch のみ）。
 */

type TabularField = { name: string; type: string };
type TabularTable = {
  name: string;
  sources: { name: string }[];
  fields: TabularField[];
  order?: { field: string; desc: boolean }[];
  range?: { field: string; start: string; end: string };
  // columns は「列ごとの配列」。rows ではない点に注意。
  columns: any[][];
};

type TabularResponse = {
  format: "tabular";
  status: unknown;
  tables: TabularTable[];
  datasetNames?: string[];
  fieldsMetaMap?: Record<string, unknown>;
};

type AxiomQueryBody = {
  apl: string;
  startTime?: string; // ISO 8601 (e.g. 2025-08-14T00:00:00Z)
  endTime?: string; // ISO 8601
};

type AxiomEnv = {
  token: string; // Axiom API Token (Bearer)
};

function ensureIso8601(date: Date): string {
  // toISOString は常に UTC（末尾 "Z"）になります。
  return date.toISOString();
}

/**
 * Tabular 形式（columns が列優先）を「行の配列」へ変換します。
 * tables[0] を対象に、fields の順序と columns の列配列から行を復元します。
 */
function tabularToRows(res: TabularResponse): Record<string, any>[] {
  if (!res.tables || res.tables.length === 0) return [];

  const t = res.tables[0];
  const fields = t.fields.map((f) => f.name);
  const columns = t.columns;

  if (columns.length !== fields.length) {
    throw new Error(
      `columns と fields の長さが一致しません: columns=${columns.length}, fields=${fields.length}`
    );
  }

  const rowCount = columns[0]?.length ?? 0;
  const rows: Record<string, any>[] = [];

  for (let r = 0; r < rowCount; r++) {
    const row: Record<string, any> = {};
    for (let c = 0; c < fields.length; c++) {
      row[fields[c]] = columns[c][r];
    }
    rows.push(row);
  }
  return rows;
}

/**
 * 特定 dataset から message 完全一致のイベントを取得します。
 * 指定期間はデフォルトで「直近 24 時間」です。
 */
export async function fetchEventsByMessage(
  ax: AxiomEnv,
  params: {
    apl: string;
    start?: Date;
    end?: Date;
  }
): Promise<Record<string, any>[]> {
  const {
    apl,
    start = new Date(Date.now() - 24 * 60 * 60 * 1000),
    end = new Date(),
  } = params;

  const body: AxiomQueryBody = {
    apl,
    startTime: ensureIso8601(start),
    endTime: ensureIso8601(end),
  };

  const url = `https://api.axiom.co/v1/datasets/_apl?format=tabular`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ax.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Axiom query failed: status=${res.status} ${res.statusText}, body=${text}`
    );
  }

  const json = (await res.json()) as TabularResponse;
  return tabularToRows(json);
}

/** 使い方例 */
async function example() {
  const rows = await fetchEventsByMessage(
    { domain: "api.axiom.co", token: process.env.AXIOM_TOKEN! },
    {
      dataset: "my-logs",
      message: "proxy.fetch.start",
      // 任意で期間・limit・投影フィールドを指定可能
      // start: new Date(Date.now() - 6 * 60 * 60 * 1000),
      // end: new Date(),
      // limit: 200,
      // selectFields: ['_time', 'message', 'status', 'uri'],
    }
  );

  // rows は「行オブジェクト配列」。必要に応じて処理する。
  console.log(rows);
}
