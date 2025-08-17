<script lang="ts">
  import { GanttChart } from '$lib/components/ui/gantt';
  import traceData from '../../trace.json';
</script>

<svelte:head>
  <title>Trace Demo - Gantt Chart</title>
</svelte:head>

<div class="container mx-auto p-8">
  <h1 class="text-3xl font-bold mb-8">Distributed Tracing Visualization</h1>
  
  <div class="mb-6">
    <p class="text-gray-600">
      This Gantt chart visualizes the distributed trace data from the Cloudflare Workers backend.
      Each bar represents a span with its duration, showing the execution flow across different services.
    </p>
  </div>
  
  <GanttChart {traceData} />
</div>