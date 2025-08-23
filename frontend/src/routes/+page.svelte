<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import {
    Github,
    ExternalLink,
    Zap,
    Code,
    Layers,
    Monitor,
    Server,
    Cloud,
  } from "@lucide/svelte";

  import type { PageData } from "./$types";
  import GanttChart from "$lib/components/ui/gantt/GanttChart.svelte";

  import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "$lib/components/ui/tabs";
  import * as Select from "$lib/components/ui/select/index.js";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  const technologies = [
    { name: "SvelteKit", icon: Code, category: "Frontend" },
    { name: "Svelte 5.0", icon: Layers, category: "Frontend" },
    { name: "TypeScript", icon: Code, category: "Language" },
    { name: "TailwindCSS v4", icon: Layers, category: "Styling" },
    { name: "Cloudflare Workers", icon: Cloud, category: "Backend" },
    { name: "Cloudflare Queue", icon: Cloud, category: "Backend" },
    { name: "Cloudflare D1", icon: Cloud, category: "Backend" },
    { name: "Cloudflare R2", icon: Cloud, category: "Backend" },

    { name: "Hono", icon: Server, category: "API Framework" },
    { name: "OpenTelemetry", icon: Monitor, category: "Observability" },
    { name: "Vite", icon: Zap, category: "Build Tool" },
    { name: "Vitest", icon: Code, category: "Testing" },
  ];

  const techByCategory = technologies.reduce(
    (acc, tech) => {
      if (!acc[tech.category]) acc[tech.category] = [];
      acc[tech.category].push(tech);
      return acc;
    },
    {} as Record<string, typeof technologies>
  );

  let { data }: { data: PageData } = $props();
  interface LogEntry {
    "@app.axiom-logging-version": string;
    _sysTime: string;
    _time: string;
    level: string;
    message: string;
    "platform.environment": string;
    source: string;
    fields: {
      [key: string]: any;
    };
  }

  // Use any to capture ALL properties from trace data
  type TraceSpan = any;

  // const traceSpans = $state(data.traceData as unknown as TraceSpan[]);
  const traceHistoryEntries = $state(data.traceHistoryData || []);

  // Trace selection and loading state
  let selectedTraceId = $state<string | null>(null);
  let currentTraceSpans = $state<TraceSpan[]>([]);
  let currentTraceLogs = $state<any[]>([]);
  let loadingTrace = $state(false);
  let lastScrapingTime = $state("");

  onMount(async () => {
    const [traces, logs] = await Promise.all([data.traceData, data.logData]);

    currentTraceSpans = traces;
    currentTraceLogs = logs;
    selectedTraceId = traces[0]?.trace_id ?? null;
    lastScrapingTime = traces[0]._time;
  });

  // Selection state
  let selectedSpan = $state<TraceSpan | null>(null);
  let selectedSpanId = $state<string | null>(null);

  // Watch for selectedTraceId changes
  $effect(() => {
    if (selectedTraceId) {
      loadTraceData(selectedTraceId);
    }
  });

  // Event handlers
  function handleSpanSelect(event: CustomEvent<{ span: TraceSpan }>) {
    selectedSpan = event.detail.span;
    selectedSpanId = event.detail.span.span_id;
  }

  function handleSpanDeselect() {
    selectedSpan = null;
    selectedSpanId = null;
  }

  function formatTime(time: string): string {
    return new Date(time).toLocaleTimeString();
  }

  // Function to load trace data by trace ID
  async function loadTraceData(traceId: string) {
    if (!browser) return;

    loadingTrace = true;
    try {
      const response = await fetch(`/api/trace/${traceId}`);
      if (response.ok) {
        const data = await response.json();
        currentTraceSpans = data.trace as any[];
        currentTraceLogs = data.log;
        // Reset selection when new trace is loaded
        selectedSpan = null;
        selectedSpanId = null;
      } else {
        console.error("Failed to load trace data");
      }
    } catch (error) {
      console.error("Error loading trace data:", error);
    } finally {
      loadingTrace = false;
    }
  }

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  function formatTimeShort(dateString: string): string {
    return new Date(dateString).toLocaleTimeString();
  }

  function getLevelClass(level: string): string {
    switch (level.toLowerCase()) {
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "warn":
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  let windowHeight = $state(0);

  $effect.root(() => {
    function updateHeight() {
      windowHeight = window.innerHeight;
    }

    updateHeight(); // 初期値設定
    window.addEventListener("resize", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  });
</script>

<div
  class="min-h-screen bg-gradient-to-br from-background to-slate-300/20 h-full"
>
  <div class="container mx-auto px-2 md:px-4 pt-16">
    <!-- Hero Section -->
    <div class="text-center md:mb-16 mb-8">
      <h1
        class="text-4xl md:text-6xl font-bold mb-3 pb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent"
      >
        CFStack Scraping Demo
      </h1>
      <div class="text-xl text-muted-foreground mb-8 mx-auto text-center">
        <p>外部サイトのデータをScrapingし保存, 表示するデモアプリです。</p>
        <p>
          フロントからバックエンドまでCloudflareで実装し、動作やパフォーマンスは
          OpenTelemetry で観測しています。
        </p>
      </div>

      <!-- buttons -->
      <div class="flex gap-4 justify-center">
        <Button
          size="lg"
          class="gap-2"
          href="https://github.com/sev3e3e"
          target="_blank"
        >
          <Github class="w-4 h-4" />
          View Repository
        </Button>
        <Button variant="outline" size="lg" class="gap-2" href="/items">
          <ExternalLink class="w-4 h-4" />
          See Data?
        </Button>
      </div>
    </div>

    <div class="grid gap-4">
      <!-- Technology Stack -->
      <Card class="mb-4">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Layers class="w-5 h-5" />
            Technology Stack
          </CardTitle>
          <CardDescription>
            Built with modern technologies for performance and developer
            experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid gap-5 md:grid-cols-2 grid-cols-1">
            {#each Object.entries(techByCategory) as [category, techs]}
              <div class="flex flex-col h-full">
                <div class="mb-3 h-full">
                  <h3
                    class="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground"
                  >
                    {category}
                  </h3>
                  <div class="flex flex-wrap gap-2 flex-1">
                    {#each techs as tech}
                      <Badge variant="secondary" class="gap-1.5 py-1.5 px-3">
                        <tech.icon class="w-3 h-3" />
                        {tech.name}
                      </Badge>
                    {/each}
                  </div>
                </div>

                {#if category !== Object.keys(techByCategory)[Object.keys(techByCategory).length - 1]}
                  <Separator />
                {/if}
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>

      <!-- Architecture Overview -->
      <Card class="mb-4">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Server class="w-5 h-5" />
            Architecture Overview
          </CardTitle>
          <CardDescription>
            Distributed architecture with multi-site deployment pattern
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="detail">Detail</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div class="flex flex-col gap-4 justify-center">
                <Button
                  size="lg"
                  class="gap-2 p-3"
                  href="/arch.svg"
                  target="_blank"
                >
                  <ExternalLink class="w-4 h-4" />
                  新しいタブで画像を開く
                </Button>
                <div
                  class=" bg-muted rounded-lg flex flex-col items-center justify-center"
                >
                  <img
                    src="/arch.svg"
                    alt="Infrastructure Diagram"
                    class="w-full h-full object-contain rounded-lg"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="detail">
              <div class="flex flex-col gap-4 justify-center">
                <Button
                  size="lg"
                  class="gap-2 p-3"
                  href="/arch_detail.svg"
                  target="_blank"
                >
                  <ExternalLink class="w-4 h-4" />
                  新しいタブで画像を開く
                </Button>
                <img
                  src="/arch_detail.svg"
                  alt="Infrastructure Diagram"
                  class="w-full h-full object-contain rounded-lg"
                />
              </div></TabsContent
            >
          </Tabs>
        </CardContent>
      </Card>
    </div>
  </div>

  <!-- Otel + Log Dashboard component -->
  <div class="min-h-0 container px-2 md:px-4 mx-auto">
    <!-- Header -->
    <div class="flex flex-col md:flex-row gap-3 md:items-center border-b">
      <!-- header -->
      <div
        class="md:p-4 md:border-r-2 border-slate-200 md:m-4 border-b pb-1 md:border-b-0"
      >
        <h1 class="text-2xl font-bold">Trace & Log & Interactive Demo</h1>
        <p class="text-gray-600">
          Interactive distributed tracing and logging analysis
        </p>
      </div>

      <!-- traceid selectbox -->
      <div class="md:flex gap-4 items-center">
        <!-- Trace History Dropdown -->
        <div class="flex flex-col gap-1 md:gap-2">
          <p class="text-sm font-medium">Trace / Log History</p>
          <Select.Root
            value={selectedTraceId || undefined}
            onValueChange={(value) => {
              selectedTraceId = value || null;
              if (value && browser) {
                loadTraceData(value);
              }
            }}
            type="single"
          >
            <Select.Trigger class="w-[350px]">
              {#if selectedTraceId && typeof selectedTraceId === "string"}
                {selectedTraceId} ({formatTimeShort(
                  traceHistoryEntries?.find(
                    (t) => t.trace_id === selectedTraceId
                  )?._time || ""
                )})
              {:else}
                Select a trace to analyze
              {/if}
            </Select.Trigger>
            <Select.Content>
              {#each traceHistoryEntries as trace}
                <Select.Item value={trace.trace_id}>
                  <div class="flex flex-col">
                    <span class="font-mono text-sm">{trace.trace_id}</span>
                    <span class="text-xs text-gray-500">{trace._time}</span>
                  </div>
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <div class="text-xs text-gray-600">
            {currentTraceSpans.length > 0
              ? currentTraceSpans[0]._time
              : "Invalid Date"}
          </div>
        </div>
      </div>

      <!-- Scraping Status and Control -->
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium">Scraping Status</p>
        <div class="flex gap-3 items-center">
          <div class="text-sm text-gray-600">
            Last run: {lastScrapingTime}
          </div>
        </div>
      </div>
    </div>

    <Tabs value="traces" class="flex-1 flex flex-col min-h-0 ">
      <TabsList class="mx-4 mt-4">
        <TabsTrigger value="traces">Traces</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
      </TabsList>

      <TabsContent
        value="traces"
        class="grid lg:grid-cols-[70%_30%] h-full min-h-0 gap-4 w-full"
      >
        <!-- Left Column -->
        <div class="flex-1">
          <Card class="h-full flex flex-col">
            <CardHeader class="flex-shrink-0">
              <CardTitle>Trace Timeline</CardTitle>
              <CardDescription>Click on spans to view details</CardDescription>
            </CardHeader>
            <CardContent class="flex-1 min-h-0">
              <div class="border rounded h-full">
                {#if loadingTrace}
                  <div
                    class="flex items-center justify-center h-full text-gray-500"
                  >
                    <div class="flex items-center gap-2">
                      <div
                        class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"
                      ></div>
                      Loading trace data...
                    </div>
                  </div>
                {:else if currentTraceSpans.length > 0}
                  <GanttChart
                    traceData={{ data: currentTraceSpans }}
                    {selectedSpanId}
                    on:spanSelect={handleSpanSelect}
                    on:spanDeselect={handleSpanDeselect}
                  />
                {:else}
                  <div
                    class="flex items-center justify-center h-full text-gray-500"
                  >
                    {selectedTraceId
                      ? "No spans found for selected trace"
                      : "Select a trace from history to view timeline"}
                  </div>
                {/if}
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Right Column -->
        <Card class="w-full p-4 flex flex-col">
          {#if selectedSpan}
            <CardHeader class="mt-2 flex-shrink-0 px-1">
              <CardTitle>Selected Trace Data</CardTitle>
              <CardDescription>
                <p class="text-sm text-gray-600">{selectedSpan.name}</p>
                <p class="text-xs text-gray-500">
                  Service: {selectedSpan["service.name"] ||
                    selectedSpan.service?.name}
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent
              class="flex-1 min-h-0 overflow-y-auto space-y-2 max-h-[572px] px-0 items-center justify-center mx-auto w-full"
            >
              {#each Object.entries(selectedSpan) as [key, value]}
                <div class="border rounded px-3 py-1">
                  <div
                    class="font-mono text-xs font-semibold text-blue-700 mb-1"
                  >
                    {key}
                  </div>
                  <div class="text-sm font-mono break-all py-1">
                    {#if typeof value === "object" && value !== null}
                      <pre class="whitespace-pre-wrap">{JSON.stringify(
                          value
                        )}</pre>
                    {:else}
                      {String(value)}
                    {/if}
                  </div>
                </div>
              {/each}
            </CardContent>
          {:else}
            <div
              class="flex justify-center items-center max-h-[572px] h-screen"
            >
              <div class="text-center text-gray-500 flex-1">
                <p class="text-xl">Select a span to view trace data</p>
                <div class="mt-4 grid grid-cols-1 gap-4 text-sm">
                  <div class="">
                    <div class="text-lg font-bold">
                      {currentTraceSpans.length}
                    </div>
                    <div>Spans</div>
                  </div>
                  {#if selectedTraceId}
                    <div class="text-xs text-gray-400 mt-2">
                      Trace ID: {selectedTraceId}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </Card>
      </TabsContent>

      <!-- Logs Tab -->
      <TabsContent value="logs" class="flex-1 m-0">
        <Card class="h-full">
          <CardHeader class="flex-shrink-0">
            <CardTitle>Log Entries ({currentTraceLogs.length})</CardTitle>
            <CardDescription>All system log entries</CardDescription>
          </CardHeader>
          <CardContent class="flex-1 min-h-0">
            {#if loadingTrace}
              <div
                class="flex items-center justify-center h-full text-gray-500"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"
                  ></div>
                  Loading log data...
                </div>
              </div>
            {:else}
              <div class="h-full overflow-y-auto flex flex-col gap-2 text-sm">
                {#each currentTraceLogs as log}
                  <div class="flex gap-2 bg-white hover:bg-gray-50 py-1">
                    <div class="flex gap-2">
                      <div class="">
                        <span
                          class="px-1 py-0.5 text-xs rounded border {getLevelClass(
                            log.level
                          )}"
                        >
                          {log.level.toUpperCase()}
                        </span>
                      </div>
                      <div class="text-xs text-gray-600 text-nowrap">
                        {formatDateTime(log._time)}
                      </div>
                    </div>
                    <pre class="whitespace-pre-wrap break-all">{JSON.stringify(
                        log
                      )}</pre>
                  </div>
                {/each}

                {#if currentTraceLogs.length === 0}
                  <div class="text-center text-gray-500 py-8">
                    No log entries available
                  </div>
                {/if}
              </div>
            {/if}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</div>
