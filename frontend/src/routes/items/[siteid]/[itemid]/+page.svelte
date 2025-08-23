<script lang="ts">
  import type { PageData } from "./$types";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Avatar from "$lib/components/ui/avatar/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Chart from "$lib/components/ui/chart/index.js";
  import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "$lib/components/ui/tabs";
  import { ArrowLeft } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { AreaChart } from "layerchart";
  import { curveNatural } from "d3-shape";
  import { scaleUtc } from "d3-scale";

  export let data: PageData;
  $: item = data.item;

  function formatDate(dateString: string | null): string {
    if (!dateString) return "Unknown date";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  }

  function smartBack() {
    const referrer = document.referrer;
    const currentHost = window.location.origin;

    // ??????????????????
    if (!referrer || !referrer.startsWith(currentHost) || history.length <= 1) {
      goto("/items"); // Default fallback
    } else {
      // ????????????
      history.back();
    }
  }

  // フラット化して1行=1カテゴリ×1日
  const rows = data.pricehistory.flatMap((d) =>
    (d.prices ?? []).map((p) => ({
      date: new Date(d.date),
      name: p.name,
      normal: p.normalPrice,
      sale: p.salePrice,
    }))
  );

  // 日付昇順→カテゴリ名昇順
  rows.sort((a, b) => {
    const t = a.date.getTime() - b.date.getTime();
    return t !== 0 ? t : a.name.localeCompare(b.name, "ja");
  });

  const nf = new Intl.NumberFormat("ja-JP");

  // chart functions

  // 1) シリーズ名を抽出（重複なし）
  function extractSeries(data: typeof data.pricehistory): string[] {
    return Array.from(
      new Set(data.flatMap((d) => d.prices.map((p) => p.name)))
    );
  }

  // 2) AreaChart用データへ整形
  function buildChartData(
    data: typeof data.pricehistory,
    value: "salePrice" | "normalPrice" = "salePrice"
  ) {
    return data.map((d) => {
      const row: Record<string, any> = { date: new Date(d.date) };
      for (const p of d.prices) row[p.name] = p[value] ?? 0;
      return row;
    });
  }

  // 3) シリーズ定義を生成（chartConfigが無い場合は簡易配色を割当て）
  function buildSeriesDefs(
    names: string[],
    chartConfig?: Record<string, { color: string }>
  ) {
    const palette = [
      "#2563eb",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#14b8a6",
      "#e11d48",
      "#22c55e",
    ];
    return names.map((name, i) => ({
      key: name,
      label: name,
      color: chartConfig?.[name]?.color ?? palette[i % palette.length],
    }));
  }

  const seriesNames = extractSeries(data.pricehistory);
  const _chartData = buildChartData(data.pricehistory, "salePrice"); // or "normalPrice"
  const _series = buildSeriesDefs(seriesNames); // chartConfigがある場合のみ
</script>

<svelte:head>
  <title>{item?.title || "Item Details"} - Demo Site</title>
  <meta
    name="description"
    content={item?.description || "View detailed information about this item"}
  />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  {#if item}
    <!-- Back navigation -->
    <div class="mb-6">
      <Button variant="outline" size="sm" onclick={smartBack}>
        <ArrowLeft />Back to Items
      </Button>
    </div>

    <!-- Main item details -->
    <Card.Root class="mb-8">
      <Card.Header class="">
        <div class="flex items-start md:gap-6 gap-4 min-w-0">
          <div class="flex-1 min-w-0">
            <Card.Title
              class="text-2xl font-bold text-gray-900 dark:text-white mb-2"
            >
              {item.title}
            </Card.Title>
            <Card.Description
              class="text-gray-600 dark:text-gray-400 text-base "
            >
              {item.description || "No description available"}
            </Card.Description>

            <div class="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
              <Badge variant="secondary">
                Site ID: {item.siteId}
              </Badge>
              <!-- 340px????? -->
              <Badge variant="outline" class="text-xs">
                ID: {item.siteSpecificId}
              </Badge>
            </div>
          </div>

          {#if item.thumbUrl}
            <Avatar.Root class="w-20 h-20 shrink-0">
              <Avatar.Image src={item.thumbUrl} alt={item.title} />
              <Avatar.Fallback class="text-lg">
                {item.title.slice(0, 2).toUpperCase()}
              </Avatar.Fallback>
            </Avatar.Root>
          {/if}
        </div>
      </Card.Header>

      <Card.Content>
        <div class="space-y-6">
          <!-- Rating and Reviews Summary -->
          {#if item.avgRating !== null}
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1">
                <span class="text-lg"
                  ><svg viewBox="0 0 100 100" width="22" height="22">
                    <polygon
                      points="50,5 61,39 98,39 67,59 78,93 50,72 22,93 33,59 2,39 39,39"
                      fill="gold"
                    />
                  </svg>
                </span>
                <span class="text-2xl font-bold text-gray-900 dark:text-white">
                  {item.avgRating.toFixed(1)}
                </span>
              </div>
              {#if item.reviewCount !== null}
                <Badge variant="outline" class="text-sm">
                  {item.reviewCount}
                  {item.reviewCount === 1 ? "review" : "reviews"}
                </Badge>
              {/if}
            </div>
          {/if}

          <!-- External Link -->
          <div>
            <Button
              variant="default"
              size="lg"
              onclick={() => window.open(item.url, "_blank")}
              class="w-full sm:w-auto"
            >
              View Original Item
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- PriceHistory Section -->
    {#if data.pricehistory && data.pricehistory.length > 0}
      <Card.Root class="mb-8">
        <Card.Header>
          <Card.Title
            class="text-xl font-semibold text-gray-900 dark:text-white"
          >
            Prices
          </Card.Title>
          <Card.Description>Item prices with table and chart</Card.Description>
        </Card.Header>
        <Card.Content>
          <Tabs value="table">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="chart">Chart</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <!-- table -->
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>日付</Table.Head>
                    <Table.Head>カテゴリ</Table.Head>
                    <Table.Head>通常価格</Table.Head>
                    <Table.Head>セール価格</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#if rows.length === 0}
                    <Table.Row>
                      <Table.Cell colspan={4}>データがありません</Table.Cell>
                    </Table.Row>
                  {:else}
                    {#each rows as r}
                      <Table.Row>
                        <Table.Cell>{r.date.toLocaleString("ja-JP")}</Table.Cell
                        >
                        <Table.Cell>{r.name}</Table.Cell>
                        <Table.Cell>¥{nf.format(r.normal)}</Table.Cell>
                        <Table.Cell>¥{nf.format(r.sale)}</Table.Cell>
                      </Table.Row>
                    {/each}
                  {/if}
                </Table.Body>
              </Table.Root></TabsContent
            >

            <!-- chart -->
            <TabsContent value="chart">
              <Chart.Container config={{}}>
                <AreaChart
                  legend
                  data={_chartData}
                  x="date"
                  xScale={scaleUtc()}
                  yPadding={[0, 25]}
                  series={_series}
                  seriesLayout="stack"
                  props={{
                    area: {
                      curve: curveNatural,
                      "fill-opacity": 0.4,
                      line: { class: "stroke-1" },
                      motion: "tween",
                    },
                    xAxis: {
                      format: (v: Date) =>
                        v.toLocaleDateString("en-US", { month: "short" }),
                    },
                    yAxis: { format: () => "" },
                  }}
                >
                  {#snippet tooltip()}
                    <Chart.Tooltip
                      labelFormatter={(v: Date) =>
                        v.toLocaleDateString("en-US", { month: "long" })}
                      indicator="line"
                    />
                  {/snippet}
                </AreaChart>
              </Chart.Container>
            </TabsContent>
          </Tabs>
        </Card.Content>
      </Card.Root>
    {/if}

    <!-- Samples Section -->
    {#if item.samples && item.samples.length > 0}
      <Card.Root class="mb-8">
        <Card.Header>
          <Card.Title
            class="text-xl font-semibold text-gray-900 dark:text-white"
          >
            Samples ({item.samples.length})
          </Card.Title>
          <Card.Description>Available samples for this item</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-3">
            {#each item.samples as sample, index}
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="flex-1">
                  <a
                    href={sample.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium break-all"
                  >
                    Sample {index + 1}
                  </a>
                  <p
                    class="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all"
                  >
                    {sample.url}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => window.open(sample.url, "_blank")}
                  class="ml-4 flex-shrink-0"
                >
                  Open
                </Button>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}

    <!-- Reviews Section -->
    {#if item.reviews && item.reviews.length > 0}
      <Card.Root>
        <Card.Header>
          <Card.Title
            class="text-xl font-semibold text-gray-900 dark:text-white"
          >
            Reviews ({item.reviews.length})
          </Card.Title>
          <Card.Description>User reviews and ratings</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-6">
            {#each item.reviews as review}
              <div
                class="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0 last:pb-0"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1">
                    {#if review.title}
                      <h4 class="font-semibold text-gray-900 dark:text-white">
                        {review.title}
                      </h4>
                    {/if}
                    <div class="flex items-center gap-2 mt-1">
                      {#if review.rating !== null}
                        <div class="flex items-center gap-1">
                          <div class="flex items-center gap-1">
                            <svg viewBox="0 0 100 100" width="22" height="22">
                              <polygon
                                points="50,5 61,39 98,39 67,59 78,93 50,72 22,93 33,59 2,39 39,39"
                                fill="gold"
                              />
                            </svg>
                            {review.rating}
                          </div>
                          <span
                            class="text-xs text-gray-600 dark:text-gray-400"
                          >
                            / 5
                          </span>
                        </div>
                      {/if}
                      <Badge variant="outline" class="text-xs">
                        Review ID: {review.reviewId}
                      </Badge>
                    </div>
                  </div>
                  <div
                    class="text-sm text-gray-500 dark:text-gray-400 text-right"
                  >
                    {formatDate(review.createdAt)}
                  </div>
                </div>

                {#if review.body}
                  <div class="prose prose-sm max-w-none dark:prose-invert">
                    <p
                      class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
                    >
                      {review.body}
                    </p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  {:else}
    <!-- Loading/Error State -->
    <div class="text-center py-12">
      <div class="space-y-4">
        <div class="text-gray-500 dark:text-gray-400">
          <svg
            class="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          Item not found
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The requested item could not be found or is no longer available.
        </p>
        <Button variant="outline" onclick={smartBack}>
          <ArrowLeft />Back to Items
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .prose {
    max-width: none;
  }
</style>
