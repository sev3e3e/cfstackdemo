type PriceItem = {
  name: string;
  normalPrice: number;
  salePrice: number;
};

type SavePriceInput = {
  data: {
    date: string; // ISO 8601 (e.g., "2025-08-23")
    prices: PriceItem[];
    sale: { id: string; name: string; url: string };
  };
};

/**
 * 基準データから過去へ向かって1〜3日間隔で10〜20件のデータを生成します。
 * 価格は小さなランダムウォークで変動し、負値にならず、割引価格は通常価格を超えません。
 */
export function generatePastData(
  base: SavePriceInput["data"],
  opts?: {
    count?: number; // 生成件数（基準含む）。未指定時は10〜20で自動決定
    minGapDays?: number; // 最小間隔日数（既定:1）
    maxGapDays?: number; // 最大間隔日数（既定:3）
    seed?: number; // 乱数シード（再現用）
    normalDriftPct?: [number, number]; // 通常価格の変動率範囲
    saleDriftPct?: [number, number]; // セール価格の変動率範囲
  }
): SavePriceInput["data"][] {
  const minGap = Math.max(1, opts?.minGapDays ?? 1);
  const maxGap = Math.max(minGap, opts?.maxGapDays ?? 3);
  const count =
    opts?.count ??
    randInt(
      10,
      20,
      opts?.seed !== undefined ? mulberry32(opts.seed) : undefined
    );

  const rnd = opts?.seed !== undefined ? mulberry32(opts.seed) : Math.random;
  const [nMin, nMax] = opts?.normalDriftPct ?? [-0.1, 0.1];
  const [sMin, sMax] = opts?.saleDriftPct ?? [-0.16, 0.16];

  const out: SavePriceInput["data"][] = [];
  // 最初に基準データを格納
  out.push(cloneData(base));

  let cursor = new Date(base.date);

  for (let i = 1; i < count; i++) {
    // 日付を過去へ進める
    const gap = randInt(minGap, maxGap, rnd);
    cursor = shiftDays(cursor, -gap);

    // 直前データを基に価格をドリフト
    const prev = out[i - 1];
    const nextPrices: PriceItem[] = prev.prices.map((p) => {
      const nDrift = lerp(nMin, nMax, rnd()); // 通常価格の変動率
      const sDrift = lerp(sMin, sMax, rnd()); // セール価格の変動率

      let normal = Math.max(0, round2(p.normalPrice * (1 + nDrift)));
      let sale = Math.max(0, round2(p.salePrice * (1 + sDrift)));

      // セール価格が通常価格を超えないよう調整
      if (sale > normal) {
        sale = round2(normal * lerp(0.7, 0.99, rnd())); // 70%〜99%の範囲で抑制
      }

      return { name: p.name, normalPrice: normal, salePrice: sale };
    });

    out.push({
      date: toISODate(cursor),
      prices: nextPrices,
      sale: { ...prev.sale }, // セール情報は同一とする
    });
  }

  return out;
}

// ---------- 小道具 ----------

function cloneData(d: SavePriceInput["data"]): SavePriceInput["data"] {
  return {
    date: d.date,
    prices: d.prices.map((p) => ({ ...p })),
    sale: { ...d.sale },
  };
}

function toISODate(d: Date): string {
  // YYYY-MM-DD もしくは ISO 8601 完全形式が必要なら d.toISOString() を使用
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDays(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randInt(min: number, max: number, rnd?: () => number): number {
  const r = (rnd ?? Math.random)();
  return Math.floor(r * (max - min + 1)) + min;
}

// 乱数生成器（再現性確保用）
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
