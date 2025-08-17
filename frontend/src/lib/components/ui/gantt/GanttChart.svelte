<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import {
    select,
    min,
    max,
    scaleTime,
    scaleBand,
    scaleOrdinal,
    axisBottom,
    timeFormat,
    schemeCategory10,
  } from "d3";

  export let traceData: any;
  export let selectedSpanId: string | null = null;

  const dispatch = createEventDispatcher<{
    spanSelect: { span: TraceSpan };
    spanDeselect: {};
  }>();

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;
  let containerWidth = 800;
  let containerHeight = 400;

  interface TraceSpan {
    span_id: string;
    parent_span_id?: string;
    name: string;
    _time: string;
    duration: string;
    service: { name: string };
    depth?: number;
    children?: TraceSpan[];
  }

  function parseDuration(duration: string): number {
    if (duration === "0s") return 0;
    const match = duration.match(/^(\d+\.?\d*)([a-z]+)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case "ms":
        return value;
      case "s":
        return value * 1000;
      default:
        return value;
    }
  }

  function processTraceData(data: any[]): TraceSpan[] {
    return data.map((span) => ({
      ...span, // Keep ALL original properties
      service: { name: span["service.name"] || "unknown" },
    }));
  }

  function buildHierarchy(spans: TraceSpan[]): TraceSpan[] {
    // Create a map for quick lookup and add depth property
    const spanMap = new Map<string, TraceSpan>();
    spans.forEach((span) => {
      spanMap.set(span.span_id, { ...span, depth: 0 });
    });

    // Calculate depth for each span
    function calculateDepth(
      spanId: string,
      visited = new Set<string>()
    ): number {
      if (visited.has(spanId)) return 0; // Avoid circular references
      visited.add(spanId);

      const span = spanMap.get(spanId);
      if (!span || !span.parent_span_id) return 0;

      const parent = spanMap.get(span.parent_span_id);
      if (!parent) return 0;

      return calculateDepth(span.parent_span_id, visited) + 1;
    }

    // Set depth for all spans
    spans.forEach((span) => {
      const spanWithDepth = spanMap.get(span.span_id)!;
      spanWithDepth.depth = calculateDepth(span.span_id);
    });

    // Sort spans to maintain hierarchical order
    const sortedSpans = Array.from(spanMap.values()).sort((a, b) => {
      // First by start time
      const timeA = new Date(a._time).getTime();
      const timeB = new Date(b._time).getTime();
      if (timeA !== timeB) return timeA - timeB;

      // Then by depth (parents before children)
      return a.depth! - b.depth!;
    });

    return sortedSpans;
  }

  function updateContainerSize() {
    if (containerElement) {
      const rect = containerElement.getBoundingClientRect();
      containerWidth = rect.width;
      containerHeight = rect.height;
    }
  }

  function drawGanttChart() {
    if (!traceData?.data || !svgElement || !containerElement) return;

    updateContainerSize();
    const processedSpans = processTraceData(traceData.data);
    const spans = buildHierarchy(processedSpans);

    select(svgElement).selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 280 };
    const width = containerWidth - margin.left - margin.right;
    const height =
      Math.max(300, spans.length * 30) + margin.top + margin.bottom;

    svgElement.setAttribute("width", containerWidth.toString());
    svgElement.setAttribute("height", height.toString());

    const svg = select(svgElement);
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const minTime = min(spans, (d) => new Date(d._time))!;
    const maxTime = max(spans, (d) => {
      const startTime = new Date(d._time);
      const duration = parseDuration(d.duration);
      return new Date(startTime.getTime() + duration);
    })!;

    const xScale = scaleTime().domain([minTime, maxTime]).range([0, width]);

    const yScale = scaleBand()
      .domain(spans.map((d) => d.span_id))
      .range([0, spans.length * 30])
      .padding(0.05); // Reduce padding between rows to minimize gaps

    const colorScale = scaleOrdinal(schemeCategory10).domain([
      ...new Set(spans.map((d) => d.service.name)),
    ]);

    g.selectAll(".bar")
      .data(spans)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(new Date(d._time)))
      .attr("y", (d) => yScale(d.span_id)!)
      .attr("width", (d) => {
        const duration = parseDuration(d.duration);
        return duration > 0
          ? Math.max(
              2,
              xScale(new Date(new Date(d._time).getTime() + duration)) -
                xScale(new Date(d._time))
            )
          : 2;
      })
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => colorScale(d.service.name))
      .attr("opacity", (d) => (selectedSpanId === d.span_id ? 1 : 0.7))
      .attr("stroke", (d) =>
        selectedSpanId === d.span_id ? "#374151" : "none"
      )
      .attr("stroke-width", (d) => (selectedSpanId === d.span_id ? 2 : 0))
      .style("cursor", "pointer")
      .on("click", function (_, d) {
        if (selectedSpanId === d.span_id) {
          dispatch("spanDeselect", {}, {});
        } else {
          dispatch("spanSelect", { span: d });
        }
      })
      .on("mouseenter", function (_, d) {
        // Highlight only this span's elements
        g.selectAll(".bar")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", "#374151")
          .attr("stroke-width", 2);
        g.selectAll(".label-square")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", "#374151")
          .attr("stroke-width", 2);
        g.selectAll(".label")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("font-weight", "bold");
      })
      .on("mouseleave", function (_, d) {
        // Reset to selection state
        g.selectAll(".bar")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", selectedSpanId === d.span_id ? "#374151" : "none")
          .attr("stroke-width", selectedSpanId === d.span_id ? 2 : 0);
        g.selectAll(".label-square")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", selectedSpanId === d.span_id ? "#374151" : "none")
          .attr("stroke-width", selectedSpanId === d.span_id ? 2 : 0);
        g.selectAll(".label")
          .filter((span: any) => span.span_id === d.span_id)
          .attr(
            "font-weight",
            selectedSpanId === d.span_id ? "bold" : "normal"
          );
      });

    // Add color squares for labels
    g.selectAll(".label-square")
      .data(spans)
      .enter()
      .append("rect")
      .attr("class", "label-square")
      .attr("x", (d) => -260 + (d.depth || 0) * 20)
      .attr("y", (d) => yScale(d.span_id)! + yScale.bandwidth() / 2 - 5)
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", (d) => colorScale(d.service.name))
      .attr("opacity", (d) => (selectedSpanId === d.span_id ? 1 : 0.7))
      .attr("stroke", (d) =>
        selectedSpanId === d.span_id ? "#374151" : "none"
      )
      .attr("stroke-width", (d) => (selectedSpanId === d.span_id ? 2 : 0))
      .style("cursor", "pointer")
      .on("click", function (_, d) {
        if (selectedSpanId === d.span_id) {
          dispatch("spanDeselect", {}, {});
        } else {
          dispatch("spanSelect", { span: d });
        }
      })
      .on("mouseenter", function (_, d) {
        // Highlight only this span's elements
        g.selectAll(".bar")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", "#374151")
          .attr("stroke-width", 2);
        g.selectAll(".label-square")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", "#374151")
          .attr("stroke-width", 2);
        g.selectAll(".label")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("font-weight", "bold");
      })
      .on("mouseleave", function (_, d) {
        // Reset to selection state
        g.selectAll(".bar")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", selectedSpanId === d.span_id ? "#374151" : "none")
          .attr("stroke-width", selectedSpanId === d.span_id ? 2 : 0);
        g.selectAll(".label-square")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", selectedSpanId === d.span_id ? "#374151" : "none")
          .attr("stroke-width", selectedSpanId === d.span_id ? 2 : 0);
        g.selectAll(".label")
          .filter((span: any) => span.span_id === d.span_id)
          .attr(
            "font-weight",
            selectedSpanId === d.span_id ? "bold" : "normal"
          );
      });

    g.selectAll(".label")
      .data(spans)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", (d) => -245 + (d.depth || 0) * 20) // Offset for square + margin
      .attr("y", (d) => yScale(d.span_id)! + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("opacity", (d) => (selectedSpanId === d.span_id ? 1 : 0.8))
      .attr("font-weight", (d) =>
        selectedSpanId === d.span_id ? "bold" : "normal"
      )
      .style("cursor", "pointer")
      .text((d) => {
        const indent = "  ".repeat(d.depth || 0); // Add visual indentation
        const prefix = d.depth ? "└─ " : "";
        return `${indent}${prefix}${d.name} (${d.duration})`;
      })
      .on("click", function (_, d) {
        if (selectedSpanId === d.span_id) {
          dispatch("spanDeselect", {}, {});
        } else {
          dispatch("spanSelect", { span: d });
        }
      })
      .on("mouseenter", function (_, d) {
        // Highlight only this span's elements
        g.selectAll(".bar")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", "#374151")
          .attr("stroke-width", 2);
        g.selectAll(".label-square")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", "#374151")
          .attr("stroke-width", 2);
        g.selectAll(".label")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("font-weight", "bold");
      })
      .on("mouseleave", function (_, d) {
        // Reset to selection state
        g.selectAll(".bar")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", selectedSpanId === d.span_id ? "#374151" : "none")
          .attr("stroke-width", selectedSpanId === d.span_id ? 2 : 0);
        g.selectAll(".label-square")
          .filter((span: any) => span.span_id === d.span_id)
          .attr("stroke", selectedSpanId === d.span_id ? "#374151" : "none")
          .attr("stroke-width", selectedSpanId === d.span_id ? 2 : 0);
        g.selectAll(".label")
          .filter((span: any) => span.span_id === d.span_id)
          .attr(
            "font-weight",
            selectedSpanId === d.span_id ? "bold" : "normal"
          );
      });

    const xAxis = axisBottom(xScale).tickFormat((d) =>
      timeFormat("%H:%M:%S")(d as Date)
    );

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${spans.length * 30})`)
      .call(xAxis as any);

    const legend = g
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 150}, 10)`);

    const services = [...new Set(spans.map((d) => d.service.name))];

    legend
      .selectAll(".legend-item")
      .data(services)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 15})`)
      .each(function (d) {
        const item = select(this);

        item
          .append("rect")
          .attr("width", 10)
          .attr("height", 10)
          .attr("fill", colorScale(d));

        item
          .append("text")
          .attr("x", 15)
          .attr("y", 5)
          .attr("dy", "0.35em")
          .attr("font-size", "10px")
          .text(d);
      });
  }

  onMount(() => {
    drawGanttChart();

    // Add resize listener
    const resizeObserver = new ResizeObserver(() => {
      drawGanttChart();
    });

    if (containerElement) {
      resizeObserver.observe(containerElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  $: if (traceData || selectedSpanId !== undefined) {
    drawGanttChart();
  }
</script>

<div class="gantt-container w-full h-full" bind:this={containerElement}>
  <svg bind:this={svgElement} class="w-full"></svg>
</div>

<style>
  .gantt-container {
    display: flex;
    flex-direction: column;
  }

  svg {
    flex: 1;
    min-height: 0;
  }

  :global(.x-axis) {
    font-size: 10px;
  }

  :global(.bar:hover) {
    opacity: 1 !important;
    stroke: #333;
    stroke-width: 1px;
  }
</style>
