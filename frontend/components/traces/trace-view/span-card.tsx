import { ChevronDown, ChevronRight, CircleDollarSign, Coins, ShieldAlert, X, Bolt } from "lucide-react";
import React, { useMemo, useRef } from "react";

import { SpanDisplayTooltip } from "@/components/traces/trace-view/span-display-tooltip.tsx";
import { TraceViewSpan, useTraceViewStoreContext } from "@/components/traces/trace-view/trace-view-store.tsx";
import { getLLMMetrics, getSpanDisplayName, getHipocapAnalysisDuration, hasHipocapAnalysis } from "@/components/traces/trace-view/utils.ts";
import { isStringDateOld } from "@/lib/traces/utils";
import { cn, getDurationString } from "@/lib/utils";

import { Skeleton } from "../../ui/skeleton";
import { NoSpanTooltip } from "../no-span-tooltip";
import SpanTypeIcon from "../span-type-icon";

const CARD_HEIGHT = 44;
const SQUARE_SIZE = 22;
const SQUARE_ICON_SIZE = 14;

const CARD_GAP = 6;

interface SpanCardProps {
  span: TraceViewSpan;
  parentY: number;
  depth: number;
  yOffset: number;
  onSpanSelect?: (span?: TraceViewSpan) => void;
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
});

export function SpanCard({ span, yOffset, parentY, onSpanSelect, depth }: SpanCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { selectedSpan, spans, toggleCollapse } = useTraceViewStoreContext((state) => ({
    selectedSpan: state.selectedSpan,
    spans: state.spans,
    toggleCollapse: state.toggleCollapse,
  }));
  const llmMetrics = getLLMMetrics(span);
  // Get child spans from the store
  const childSpans = useMemo(() => spans.filter((s) => s.parentSpanId === span.spanId), [spans, span.spanId]);

  const hasChildren = childSpans && childSpans.length > 0;
  
  // Get duration for Hipocap analysis spans
  const hipocapDuration = useMemo(() => {
    if (hasHipocapAnalysis(span)) {
      return getHipocapAnalysisDuration(span);
    }
    return null;
  }, [span]);
  
  // Use Hipocap analysis duration if available, otherwise use regular duration
  const displayDuration = useMemo(() => {
    if (hipocapDuration) {
      return hipocapDuration;
    }
    return getDurationString(span.startTime, span.endTime);
  }, [hipocapDuration, span.startTime, span.endTime]);

  const isSelected = useMemo(() => selectedSpan?.spanId === span.spanId, [selectedSpan?.spanId, span.spanId]);

  // Check if this is a Hipocap event span (virtual span created from event)
  const isHipocapEventSpan = useMemo(() => {
    return span.attributes?.["hipocap.is_event_span"] === true;
  }, [span.attributes]);

  // Check if this is a function attempt span
  const isFunctionAttemptSpan = useMemo(() => {
    return span.attributes?.["hipocap.is_function_attempt"] === true;
  }, [span.attributes]);

  // Get function attempts count for parent spans
  const functionAttemptsCount = useMemo(() => {
    if (isFunctionAttemptSpan) return 0;
    const attempts = span.attributes?.["hipocap.function_attempts"] as string[] | undefined;
    return attempts?.length || 0;
  }, [span.attributes, isFunctionAttemptSpan]);

  // Get severity for Hipocap event spans
  const eventSeverity = useMemo(() => {
    if (!isHipocapEventSpan && !isFunctionAttemptSpan) return null;
    return span.attributes?.["hipocap.severity"] || null;
  }, [isHipocapEventSpan, isFunctionAttemptSpan, span.attributes]);

  // For Hipocap event spans, show severity-based styling
  const eventSeverityColor = useMemo(() => {
    if (!eventSeverity) return "text-amber-500";
    const severityLower = eventSeverity.toLowerCase();
    switch (severityLower) {
      case "critical":
        return "text-red-600";
      case "high":
        return "text-red-500";
      case "medium":
        return "text-amber-500";
      case "low":
        return "text-amber-400";
      case "safe":
        return "text-green-500";
      default:
        return "text-amber-500";
    }
  }, [eventSeverity]);

  return (
    <div className="flex w-full mb-1.5" ref={ref} style={{ marginLeft: depth * (CARD_GAP + 3) }}>
      {/* Connection indicator line */}
      {depth > 0 && (
        <div className="flex flex-col items-center mr-2 relative">
          <div className={cn(
            "w-0.5 flex-1 transition-all duration-200",
            isSelected ? "bg-primary" : "bg-border/40 group-hover/span:bg-border/60"
          )} style={{ minHeight: 8 }} />
          <div className={cn(
            "w-2 h-2 rounded-full transition-all duration-200 -mt-1",
            isSelected ? "bg-primary ring-2 ring-primary/20" : "bg-border/60 group-hover/span:bg-border"
          )} />
        </div>
      )}
      
      {/* Main card */}
      <div
        className={cn(
          "flex-1 cursor-pointer transition-all duration-300 relative group/span",
          "rounded-md border bg-card/50 backdrop-blur-sm",
          "hover:shadow-md hover:shadow-primary/10 hover:border-primary/30",
          "hover:-translate-y-0.5",
          isHipocapEventSpan 
            ? "border-amber-500/30 hover:border-amber-500/50 bg-gradient-to-br from-amber-50/30 via-card/50 to-card/50" 
            : "border-border/30 hover:border-primary/30",
          isSelected 
            ? "border-primary shadow-md shadow-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-card/50 ring ring-primary/10" 
            : ""
        )}
        style={{
          minHeight: CARD_HEIGHT,
          maxWidth: "calc(100% - 8px)",
        }}
        onClick={(e) => {
          if (!span.pending) {
            onSpanSelect?.(span);
          }
        }}
      >
        {/* Depth indicator bar */}
        {depth > 0 && (
          <div 
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-all duration-200",
              isSelected ? "bg-primary" : "bg-gradient-to-b from-primary/40 to-primary/20"
            )} 
          />
        )}
        
        {/* Card content */}
        <div className="flex items-center gap-2 p-2 relative z-10">
          {/* Icon with badge */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "rounded-md p-1.5 transition-all duration-200",
              "group-hover/span:scale-105 group-hover/span:shadow-md",
              isSelected && "scale-105 shadow-md",
              isHipocapEventSpan 
                ? "bg-amber-500/10 group-hover/span:bg-amber-500/20" 
                : "bg-muted/50 group-hover/span:bg-muted"
            )}>
              {isHipocapEventSpan ? (
                <ShieldAlert
                  className={cn(
                    "transition-all duration-200",
                    eventSeverityColor,
                    "drop-shadow-sm"
                  )}
                  size={SQUARE_ICON_SIZE}
                />
              ) : isFunctionAttemptSpan ? (
                <Bolt
                  className={cn(
                    "transition-all duration-200",
                    eventSeverityColor || "text-blue-500",
                    "drop-shadow-sm"
                  )}
                  size={SQUARE_ICON_SIZE}
                />
              ) : (
                <SpanTypeIcon
                  iconClassName="transition-all duration-200 drop-shadow-sm"
                  spanType={span.spanType}
                  containerWidth={SQUARE_SIZE}
                  containerHeight={SQUARE_SIZE}
                  size={SQUARE_ICON_SIZE}
                  status={span.status}
                  className={cn({ "text-muted-foreground": span.pending })}
                />
              )}
            </div>
          </div>
          
          {/* Content section */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <SpanDisplayTooltip isLLM={span.spanType === "LLM"} name={span.name}>
              <div className={cn(
                "text-xs font-medium truncate transition-all duration-200",
                span.pending && "text-muted-foreground",
                isHipocapEventSpan && "font-semibold",
                !span.pending && "group-hover/span:text-foreground",
                isSelected && "text-primary"
              )}>
                {getSpanDisplayName(span)}
              </div>
            </SpanDisplayTooltip>
            
            {/* Metadata row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {span.pending ? (
                isStringDateOld(span.startTime) ? (
                  <NoSpanTooltip>
                    <div className="flex rounded-md bg-destructive/10 p-1 shadow-sm transition-all duration-200 hover:bg-destructive/20">
                      <X className="w-3 h-3 text-destructive" />
                    </div>
                  </NoSpanTooltip>
                ) : (
                  <Skeleton className="h-5 w-16 rounded-full" />
                )
              ) : (
                <>
                  <div className="text-[10px] px-1.5 py-0.5 bg-muted/80 rounded-full font-medium shadow-sm transition-all duration-200 hover:bg-muted hover:shadow-md">
                    {displayDuration}
                  </div>
                  {llmMetrics && (
                    <>
                      <div className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-700 dark:text-blue-400 rounded-full inline-flex items-center gap-0.5 font-medium shadow-sm transition-all duration-200 hover:shadow-md">
                        <Coins className="w-2.5 h-2.5" />
                        {numberFormatter.format(llmMetrics.tokens)}
                      </div>
                      <div className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-green-500/20 to-green-500/10 text-green-700 dark:text-green-400 rounded-full inline-flex items-center gap-0.5 font-medium shadow-sm transition-all duration-200 hover:shadow-md">
                        <CircleDollarSign className="w-2.5 h-2.5" />
                        {llmMetrics.cost.toFixed(3)}
                      </div>
                    </>
                  )}
                  {functionAttemptsCount > 0 && (
                    <div className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-purple-500/25 to-purple-500/15 text-purple-700 dark:text-purple-400 rounded-full inline-flex items-center gap-0.5 font-medium shadow-sm transition-all duration-200 hover:shadow-md">
                      <Bolt className="w-2.5 h-2.5" />
                      {functionAttemptsCount}
                    </div>
                  )}
                  {hasChildren && (
                    <div className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">
                      {childSpans.length} {childSpans.length === 1 ? 'child' : 'children'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Collapse button */}
          {hasChildren && (
            <button
              className="z-30 p-1 hover:bg-muted/80 transition-all duration-200 text-muted-foreground rounded-md hover:text-foreground hover:shadow-sm flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(span.spanId);
              }}
            >
              {span.collapsed ? (
                <ChevronRight className="h-3 w-3 transition-transform duration-200" />
              ) : (
                <ChevronDown className="h-3 w-3 transition-transform duration-200" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
