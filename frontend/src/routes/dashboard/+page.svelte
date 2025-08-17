<script lang="ts">
  import type { PageData } from "./$types";
  import GanttChart from "$lib/components/ui/gantt/GanttChart.svelte";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "$lib/components/ui/tabs";
  import { writable } from "svelte/store";
  import { onMount } from "svelte";

  export let data: PageData;

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

  $: traceSpans = data.traceData.data as TraceSpan[];
  $: logEntries = data.logData.data as unknown as LogEntry[];

  // Selection state
  let selectedSpan: TraceSpan | null = null;
  let selectedSpanId: string | null = null;

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
  const windowHeight = writable<number>(0);

  onMount(() => {
    function updateHeight() {
      windowHeight.set(window.innerHeight);
    }

    updateHeight(); // 初期値設定
    window.addEventListener("resize", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  });
</script>

<svelte:head>
  <title>Dashboard - Trace & Log Visualization</title>
</svelte:head>

<div class="h-screen bg-gray-50 min-h-0">
  <!-- Header -->
  <div class="p-4 bg-white border-b">
    <h1 class="text-2xl font-bold">Trace & Log Dashboard</h1>
    <p class="text-gray-600">
      Interactive distributed tracing and logging analysis
    </p>
  </div>

  <Tabs value="traces" class="flex-1 flex flex-col min-h-0 ">
    <TabsList class="mx-4 mt-4">
      <TabsTrigger value="traces">Traces</TabsTrigger>
      <TabsTrigger value="logs">Logs</TabsTrigger>
    </TabsList>

    <!-- TabsContent 親が flex で高さを持つようにする -->
    <TabsContent value="traces" class="flex flex-1 h-full min-h-0 gap-4">
      <!-- Left Column -->
      <div class="flex-1">
        <Card class="h-full flex flex-col">
          <CardHeader class="flex-shrink-0">
            <CardTitle>Trace Timeline</CardTitle>
            <CardDescription>Click on spans to view details</CardDescription>
          </CardHeader>
          <CardContent class="flex-1 min-h-0">
            <div class="border rounded h-full">
              {#if traceSpans.length > 0}
                <GanttChart
                  traceData={{ data: traceSpans }}
                  {selectedSpanId}
                  on:spanSelect={handleSpanSelect}
                  on:spanDeselect={handleSpanDeselect}
                />
              {:else}
                <div
                  class="flex items-center justify-center h-full text-gray-500"
                >
                  No trace data available
                </div>
              {/if}
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Right Column -->
      <Card class="w-96 bg-white p-4 flex flex-col">
        {#if selectedSpan}
          <!-- 固定ヘッダー部 -->
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
            class="flex-1 min-h-0 overflow-y-auto space-y-2 max-h-[572px] px-0"
          >
            {#each Object.entries(selectedSpan) as [key, value]}
              <div class="border rounded p-3 bg-gray-50">
                <div class="font-mono text-xs font-semibold text-blue-700 mb-2">
                  {key}
                </div>
                <div class="text-base font-mono break-all">
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
          <div class="flex justify-center items-center max-h-[572px] h-screen">
            <div class="text-center text-gray-500 flex-1">
              <p class="text-lg">Select a span to view trace data</p>
              <div class="mt-4 grid grid-cols-1 gap-4 text-sm">
                <div>
                  <div class="text-lg font-bold">{traceSpans.length}</div>
                  <div>Spans</div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </Card>
    </TabsContent>

    <!-- Logs Tab -->
    <TabsContent value="logs" class="flex-1 p-4 m-0">
      <Card class="h-full">
        <CardHeader class="flex-shrink-0">
          <CardTitle>Log Entries ({logEntries.length})</CardTitle>
          <CardDescription>All system log entries</CardDescription>
        </CardHeader>
        <CardContent class="flex-1 min-h-0">
          <div class="h-full overflow-y-auto space-y-3">
            {#each logEntries as log}
              <div class="border rounded p-4 bg-white hover:bg-gray-50">
                <div class="mb-3">
                  <span
                    class="px-2 py-1 text-xs rounded border {getLevelClass(
                      log.level
                    )} mr-2"
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span class="text-xs text-gray-600"
                    >{formatTime(log._time)}</span
                  >
                </div>

                <div class="bg-gray-100 p-3 rounded font-mono text-xs">
                  <pre class="whitespace-pre-wrap break-all">{JSON.stringify(
                      log
                    )}</pre>
                </div>
              </div>
            {/each}

            {#if logEntries.length === 0}
              <div class="text-center text-gray-500 py-8">
                No log entries available
              </div>
            {/if}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>
