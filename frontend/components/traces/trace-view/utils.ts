import { capitalize, get } from "lodash";

import { createSpanTypeIcon } from "@/components/traces/span-type-icon";
import { TraceViewSpan, TraceViewTrace } from "@/components/traces/trace-view/trace-view-store.tsx";
import { ColumnFilter } from "@/components/ui/infinite-datatable/ui/datatable-filter/utils";
import { aggregateSpanMetrics } from "@/lib/actions/spans/utils.ts";
import { RealtimeSpan, SpanType } from "@/lib/traces/types";

export const enrichSpansWithPending = (existingSpans: TraceViewSpan[]): TraceViewSpan[] => {
  const existingSpanIds = new Set(existingSpans.map((span) => span.spanId));
  const pendingSpans = new Map<string, TraceViewSpan>();

  // First, add all existing pending spans to the pendingSpans map
  for (const span of existingSpans) {
    if (span.pending) {
      pendingSpans.set(span.spanId, span);
    }
  }

  for (const span of existingSpans) {
    if (span.parentSpanId) {
      const parentSpanIds = span.attributes["lmnr.span.ids_path"] as string[] | undefined;
      const parentSpanNames = span.attributes["lmnr.span.path"] as string[] | undefined;

      if (
        parentSpanIds === undefined ||
        parentSpanNames === undefined ||
        parentSpanIds.length === 0 ||
        parentSpanNames.length === 0 ||
        parentSpanIds.length !== parentSpanNames.length
      ) {
        continue;
      }

      const startTime = new Date(span.startTime);
      const endTime = new Date(span.endTime);
      for (let i = 0; i < parentSpanIds.length; i++) {
        const spanId = parentSpanIds[i];
        const spanName = parentSpanNames[i];

        // Skip if this span exists and is not pending
        if (existingSpanIds.has(spanId) && !pendingSpans.has(spanId)) {
          continue;
        }

        if (pendingSpans.has(spanId)) {
          // Update the time range of the pending span to cover all its children
          const existingStartTime = new Date(pendingSpans.get(spanId)!.startTime);
          const existingEndTime = new Date(pendingSpans.get(spanId)!.endTime);
          pendingSpans.set(spanId, {
            ...pendingSpans.get(spanId)!,
            startTime: (startTime < existingStartTime ? startTime : existingStartTime).toISOString(),
            endTime: (endTime > existingEndTime ? endTime : existingEndTime).toISOString(),
          });
          continue;
        }

        const parentSpanId = i > 0 ? parentSpanIds[i - 1] : undefined;
        const pendingSpan: TraceViewSpan = {
          spanId,
          name: spanName,
          parentSpanId,
          startTime: new Date(span.startTime).toISOString(),
          endTime: new Date(span.endTime).toISOString(),
          attributes: {},
          events: [],
          inputCost: 0,
          outputCost: 0,
          totalCost: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          traceId: span.traceId,
          spanType: SpanType.DEFAULT,
          path: "",
          pending: true,
          status: span.status,
          collapsed: false,
        };
        pendingSpans.set(spanId, pendingSpan);
      }
    }
  }

  // Filter out existing spans that are pending (to avoid duplicates)
  const nonPendingExistingSpans = existingSpans.filter((span) => !span.pending);

  return [...nonPendingExistingSpans, ...pendingSpans.values()];
};

export const filterColumns: ColumnFilter[] = [
  {
    key: "span_id",
    name: "ID",
    dataType: "string",
  },
  {
    name: "Type",
    dataType: "enum",
    key: "span_type",
    options: Object.values(SpanType).map((v) => ({
      label: v,
      value: v,
      icon: createSpanTypeIcon(v, "w-4 h-4", 14),
    })),
  },
  {
    name: "Status",
    dataType: "enum",
    key: "status",
    options: ["success", "error"].map((v) => ({
      label: capitalize(v),
      value: v,
    })),
  },
  {
    key: "name",
    name: "Name",
    dataType: "string",
  },
  {
    key: "latency",
    name: "Latency",
    dataType: "number",
  },
  {
    key: "tokens",
    name: "Tokens",
    dataType: "number",
  },
  {
    key: "cost",
    name: "Cost",
    dataType: "number",
  },
  {
    key: "tags",
    name: "Tags",
    dataType: "string",
  },
  {
    key: "model",
    name: "Model",
    dataType: "string",
  },
];

export const getDefaultTraceViewWidth = () => {
  if (typeof window !== "undefined") {
    const viewportWidth = window.innerWidth;
    const seventyFivePercent = viewportWidth * 0.75;
    return Math.min(seventyFivePercent, 1100);
  }
  return 1000;
};

export const onRealtimeUpdateSpans =
  (
    setSpans: (spans: TraceViewSpan[] | ((prevSpans: TraceViewSpan[]) => TraceViewSpan[])) => void,
    setTrace: (trace?: TraceViewTrace | ((prevTrace?: TraceViewTrace) => TraceViewTrace | undefined)) => void,
    setShowBrowserSession: (show: boolean) => void
  ) =>
    (newSpan: RealtimeSpan) => {
      if (newSpan.attributes["lmnr.internal.has_browser_session"]) {
        setShowBrowserSession(true);
      }

      const inputTokens = get(newSpan.attributes, "gen_ai.usage.input_tokens", 0);
      const outputTokens = get(newSpan.attributes, "gen_ai.usage.output_tokens", 0);
      const totalTokens = inputTokens + outputTokens;
      const inputCost = get(newSpan.attributes, "gen_ai.usage.input_cost", 0);
      const outputCost = get(newSpan.attributes, "gen_ai.usage.output_cost", 0);
      const totalCost = get(newSpan.attributes, "gen_ai.usage.cost", inputCost + outputCost);
      const model = get(newSpan.attributes, "gen_ai.response.model") ?? get(newSpan.attributes, "gen_ai.request.model");

      setTrace((trace) => {
        if (!trace) return trace;

        const newTrace = { ...trace };

        newTrace.startTime =
          new Date(newTrace.startTime).getTime() < new Date(newSpan.startTime).getTime()
            ? newTrace.startTime
            : newSpan.startTime;
        newTrace.endTime =
          new Date(newTrace.endTime).getTime() > new Date(newSpan.endTime).getTime() ? newTrace.endTime : newSpan.endTime;
        newTrace.totalTokens += totalTokens;
        newTrace.inputTokens += inputTokens;
        newTrace.outputTokens += outputTokens;
        newTrace.inputCost += inputCost;
        newTrace.outputCost += outputCost;
        newTrace.totalCost += totalCost;
        return newTrace;
      });

      setSpans((spans) => {
        const newSpans = [...spans];
        const index = newSpans.findIndex((span) => span.spanId === newSpan.spanId);
        if (index !== -1) {
          // Always replace existing span, regardless of pending status
          newSpans[index] = {
            ...newSpan,
            totalTokens,
            inputTokens,
            outputTokens,
            inputCost,
            outputCost,
            totalCost,
            model,
            collapsed: newSpans[index].collapsed || false,
            events: [],
            path: "",
          };
        } else {
          newSpans.push({
            ...newSpan,
            totalTokens,
            inputTokens,
            outputTokens,
            inputCost,
            outputCost,
            totalCost,
            model,
            collapsed: false,
            events: [],
            path: "",
          });
        }

        newSpans.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        return aggregateSpanMetrics(enrichSpansWithPending(newSpans));
      });
    };

export const isSpanPathsEqual = (path1: string[] | null, path2: string[] | null): boolean => {
  if (!path1 || !path2) return false;
  if (path1.length !== path2.length) return false;
  return path1.every((item, index) => item === path2[index]);
};

export const findSpanToSelect = (
  spans: TraceViewSpan[],
  spanId: string | undefined,
  searchParams: URLSearchParams,
  spanPath: string[] | null
): TraceViewSpan | undefined => {
  // Filter out virtual spans for selection (only use real spans)
  const realSpans = spans.filter(
    (span) =>
      span.attributes?.["hipocap.is_event_span"] !== true &&
      span.attributes?.["hipocap.is_function_attempt"] !== true
  );

  // Priority 1: Span from URL (either prop or search params)
  const urlSpanId = spanId || searchParams.get("spanId");
  if (urlSpanId) {
    // Check if this is a virtual span ID (contains -hipocap-event- or -function-attempt-)
    if (urlSpanId.includes("-hipocap-event-") || urlSpanId.includes("-function-attempt-")) {
      // Extract the parent span ID (everything before the virtual span suffix)
      const parentSpanId = urlSpanId.split("-hipocap-event-")[0].split("-function-attempt-")[0];
      const parentSpan = realSpans.find((span) => span.spanId === parentSpanId);
      if (parentSpan) return parentSpan;
    }

    // Check if this is a virtual span in the spans array
    const spanFromUrl = spans.find((span) => span.spanId === urlSpanId);
    if (spanFromUrl) {
      // If it's a virtual span, find its parent instead
      const isVirtualSpan = spanFromUrl.attributes?.["hipocap.is_event_span"] === true ||
        spanFromUrl.attributes?.["hipocap.is_function_attempt"] === true;
      if (isVirtualSpan && spanFromUrl.parentSpanId) {
        const parentSpan = realSpans.find((span) => span.spanId === spanFromUrl.parentSpanId);
        if (parentSpan) return parentSpan;
      }
      // If it's a real span, return it
      if (!isVirtualSpan) {
        return spanFromUrl;
      }
    }

    // Try to find in real spans
    const realSpanFromUrl = realSpans.find((span) => span.spanId === urlSpanId);
    if (realSpanFromUrl) return realSpanFromUrl;
  }

  // Priority 2: Span matching saved path from local storage
  if (spanPath) {
    const spanFromPath = realSpans.find((span) => {
      const attributePath = span.attributes?.["lmnr.span.path"];
      return Array.isArray(attributePath) && isSpanPathsEqual(attributePath, spanPath);
    });
    if (spanFromPath) return spanFromPath;
  }

  // Priority 3: First span as fallback
  return realSpans?.[0];
};

export const getSpanDisplayName = (span: TraceViewSpan) => {
  const modelName = span.model;
  // For Hipocap spans, use the function name from attributes if available
  const hipocapFunctionName = span.attributes?.["hipocap.function_name"];
  if (hipocapFunctionName) {
    return hipocapFunctionName;
  }
  return span.spanType === "LLM" && modelName ? modelName : span.name;
};

export const getLLMMetrics = (span: TraceViewSpan) => {
  if (span.aggregatedMetrics?.hasLLMDescendants) {
    return {
      cost: span.aggregatedMetrics.totalCost,
      tokens: span.aggregatedMetrics.totalTokens,
    };
  }

  if (span.spanType !== "LLM") return null;

  const costValue = span.totalCost || (span.inputCost ?? 0) + (span.outputCost ?? 0);
  const tokensValue = span.totalTokens || (span.inputTokens ?? 0) + (span.outputTokens ?? 0);

  if (costValue === 0 && tokensValue === 0) return null;

  return {
    cost: costValue,
    tokens: tokensValue,
  };
};

/**
 * Check if a span has Hipocap analysis data (including shield operations)
 */
export const hasHipocapAnalysis = (span: { attributes?: Record<string, any> }): boolean => {
  if (!span?.attributes) return false;

  // Check for analyze operation attributes
  const functionName = get(span.attributes, "lmnr.association.properties.metadata.hipocap.function_name");
  const inputAnalysis = get(span.attributes, "lmnr.association.properties.metadata.hipocap.input_analysis");
  const llmAnalysis = get(span.attributes, "lmnr.association.properties.metadata.hipocap.llm_analysis");
  const finalDecision = get(span.attributes, "lmnr.association.properties.metadata.hipocap.final_decision");

  // Check for shield operation attributes
  const shieldDecision = get(span.attributes, "lmnr.association.properties.metadata.hipocap.shield_decision");
  const shieldKey = get(span.attributes, "lmnr.association.properties.metadata.hipocap.shield_key");

  return !!(functionName || inputAnalysis || llmAnalysis || finalDecision || shieldDecision || shieldKey);
};

/**
 * Extract and parse Hipocap analysis data from span attributes (including shield operations)
 */
export const extractHipocapAnalysis = (span: { attributes?: Record<string, any> }) => {
  if (!span?.attributes) return null;

  const tryParseJson = (value: any): any => {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  // Extract analyze operation attributes
  const functionName = get(span.attributes, "lmnr.association.properties.metadata.hipocap.function_name");
  const inputAnalysisStr = get(span.attributes, "lmnr.association.properties.metadata.hipocap.input_analysis");
  const llmAnalysisStr = get(span.attributes, "lmnr.association.properties.metadata.hipocap.llm_analysis");
  const finalDecision = get(span.attributes, "lmnr.association.properties.metadata.hipocap.final_decision");
  const safeToUse = get(span.attributes, "lmnr.association.properties.metadata.hipocap.safe_to_use");
  const reason = get(span.attributes, "lmnr.association.properties.metadata.hipocap.reason");
  const finalScore = get(span.attributes, "lmnr.association.properties.metadata.hipocap.final_score");
  const score = get(span.attributes, "lmnr.association.properties.metadata.hipocap.score");
  const blockedAt = get(span.attributes, "lmnr.association.properties.metadata.hipocap.blocked_at");
  const severity = get(span.attributes, "lmnr.association.properties.metadata.hipocap.severity");

  // Extract shield operation attributes
  const shieldDecision = get(span.attributes, "lmnr.association.properties.metadata.hipocap.shield_decision");
  const shieldReason = get(span.attributes, "lmnr.association.properties.metadata.hipocap.shield_reason");
  const shieldKey = get(span.attributes, "lmnr.association.properties.metadata.hipocap.shield_key");

  const inputAnalysis = tryParseJson(inputAnalysisStr);
  const llmAnalysis = tryParseJson(llmAnalysisStr);

  // Use final_score if available, otherwise fall back to score
  const riskScore = finalScore !== undefined ? finalScore : (score !== undefined ? score : null);

  // For shield operations, map shield attributes to the standard format
  const isShieldOperation = !!(shieldDecision || shieldKey);

  if (isShieldOperation) {
    return {
      functionName: shieldKey || "Shield Check",
      finalDecision: shieldDecision === "ALLOW" ? "ALLOWED" : shieldDecision === "BLOCK" ? "BLOCKED" : shieldDecision,
      safeToUse: shieldDecision === "ALLOW",
      reason: shieldReason || reason,
      finalScore: null, // Shields don't have scores
      blockedAt: shieldDecision === "BLOCK" ? "shield" : null,
      severity: shieldDecision === "BLOCK" ? "high" : "safe",
      inputAnalysis: null,
      llmAnalysis: null,
      isShield: true,
      shieldKey,
    };
  }

  return {
    functionName,
    finalDecision,
    safeToUse: safeToUse ?? null,
    reason,
    finalScore: riskScore,
    blockedAt,
    severity,
    inputAnalysis,
    llmAnalysis,
    isShield: false,
  };
};

/**
 * Get duration string for Hipocap analysis spans based on timestamps in analysis data
 * Falls back to regular span duration if no analysis timestamps are available
 */
export const getHipocapAnalysisDuration = (span: { attributes?: Record<string, any>; startTime: string; endTime: string }): string | null => {
  if (!span?.attributes) return null;

  const tryParseJson = (value: any): any => {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const inputAnalysisStr = get(span.attributes, "lmnr.association.properties.metadata.hipocap.input_analysis");
  const llmAnalysisStr = get(span.attributes, "lmnr.association.properties.metadata.hipocap.llm_analysis");

  const inputAnalysis = tryParseJson(inputAnalysisStr);
  const llmAnalysis = tryParseJson(llmAnalysisStr);

  const timestamps: number[] = [];

  // Extract timestamps from analysis data
  if (inputAnalysis?.timestamp) {
    timestamps.push(Number(inputAnalysis.timestamp));
  }
  if (llmAnalysis?.timestamp) {
    timestamps.push(Number(llmAnalysis.timestamp));
  }

  // If we have at least one timestamp, calculate duration
  if (timestamps.length > 0) {
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const durationSeconds = maxTimestamp - minTimestamp;

    // Only return custom duration if it's meaningful (greater than 0.01 seconds)
    // Otherwise fall back to regular span duration
    if (durationSeconds > 0.01) {
      return `${durationSeconds.toFixed(2)}s`;
    }
  }

  return null;
};
