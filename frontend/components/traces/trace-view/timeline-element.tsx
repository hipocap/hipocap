import { VirtualItem } from "@tanstack/react-virtual";
import { CircleDollarSign, Coins } from "lucide-react";
import React, { memo, useLayoutEffect, useMemo, useRef, useState } from "react";

import { TraceViewSpan } from "@/components/traces/trace-view/trace-view-store.tsx";
import { TimelineData } from "@/components/traces/trace-view/trace-view-store-utils.ts";
import { getLLMMetrics, getSpanDisplayName, getHipocapAnalysisDuration, hasHipocapAnalysis } from "@/components/traces/trace-view/utils.ts";
import { SPAN_TYPE_TO_COLOR } from "@/lib/traces/utils";
import { cn, getDurationString } from "@/lib/utils";

const TEXT_PADDING = {
  WITH_EVENTS: 8,
  WITHOUT_EVENTS: 4,
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
});

const TimelineElement = ({
  setSelectedSpan,
  span,
  virtualRow,
  selectedSpan,
}: {
  span: TimelineData["spans"]["0"];
  virtualRow: VirtualItem;
  selectedSpan?: TraceViewSpan;
  setSelectedSpan: (span?: TraceViewSpan) => void;
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [textPosition, setTextPosition] = useState<"inside" | "outside">("inside");

  const isSelected = useMemo(() => selectedSpan?.spanId === span.span.spanId, [span.span.spanId, selectedSpan?.spanId]);

  const handleSpanSelect = () => {
    if (!span.span.pending) {
      setSelectedSpan(span.span);
    }
  };

  const llmMetrics = getLLMMetrics(span.span);
  
  // Get duration for Hipocap analysis spans
  const hipocapDuration = useMemo(() => {
    if (hasHipocapAnalysis(span.span)) {
      return getHipocapAnalysisDuration(span.span);
    }
    return null;
  }, [span.span]);
  
  // Use Hipocap analysis duration if available, otherwise use regular duration
  const displayDuration = useMemo(() => {
    if (hipocapDuration) {
      return hipocapDuration;
    }
    return getDurationString(span.span.startTime, span.span.endTime);
  }, [hipocapDuration, span.span.startTime, span.span.endTime]);

  useLayoutEffect(() => {
    if (!blockRef.current || !textRef.current) return;

    const measure = () => {
      if (textRef.current && blockRef.current) {
        const textWidth = textRef.current.offsetWidth;
        const blockWidth = blockRef.current.offsetWidth + 8;
        const availableWidth = blockWidth - (span.events.length > 0 ? 16 : 8) - 4;
        setTextPosition(textWidth <= availableWidth ? "inside" : "outside");
      }
    };

    const frameId = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(textRef.current);
    observer.observe(blockRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [span.span.name, span.span.model, span.span.spanType, span.events.length, span.width]);

  const spanTextElement = useMemo(() => {
    const textContent = (
      <div className={"flex items-center gap-1.5"}>
        <div className={"overflow-hidden text-ellipsis whitespace-nowrap text-nowrap"}>
          {getSpanDisplayName(span.span)}
        </div>
        {llmMetrics && (
          <>
            <span className={"text-white/70 inline-flex items-center gap-1"}>
              <Coins className="min-w-1" size={12} />
              {numberFormatter.format(llmMetrics.tokens)}
            </span>

            <span className={"text-white/70 flex w-fit items-center gap-1"}>
              <CircleDollarSign className="min-w-1" size={12} />
              {llmMetrics.cost.toFixed(3)}
            </span>
          </>
        )}
      </div>
    );

    const commonProps = {
      title: span.span.name,
      ref: textRef,
      className: "text-xs font-medium text-white/90",
    };

    if (textPosition === "inside") {
      return (
        <span
          {...commonProps}
          className={cn(commonProps.className, "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap")}
        >
          {textContent}
        </span>
      );
    }

    if (span.left > 50) {
      return (
        <span
          {...commonProps}
          className={cn(commonProps.className, "absolute text-right top-1/2 -translate-y-1/2")}
          style={{
            right: `calc(100% - ${span.left}% + 20px)`,
            maxWidth: `calc(${span.left}% - 16px)`,
          }}
        >
          {textContent}
        </span>
      );
    }

    return (
      <span {...commonProps} className={cn(commonProps.className, "ml-1 text-left text-white/90")}>
        {textContent}
      </span>
    );
  }, [span.span, span.left, span.events.length, llmMetrics, textPosition]);

  return (
    <div
      key={virtualRow.index}
      data-index={virtualRow.index}
      onClick={handleSpanSelect}
      className={cn("absolute w-full h-8 flex items-center hover:bg-muted cursor-pointer transition duration-200")}
      style={{
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {isSelected && <div className="h-full w-full absolute left-0 bg-primary/25" />}
      
      {/* Grid layout: timeline area (left) + duration (right) - ensures perfect alignment */}
      <div className="grid grid-cols-[1fr_auto] items-center w-full h-8 px-4 gap-4 relative z-20">
        {/* Left section: Timeline marker and content */}
        <div className="flex items-center min-w-0 relative h-full">
          {/* Timeline marker (colored block) - positioned based on time */}
          <div
            ref={blockRef}
            className="rounded relative flex items-center justify-center"
            style={{
              backgroundColor:
                span.span.status === "error" ? "rgba(204, 51, 51, 1)" : SPAN_TYPE_TO_COLOR[span.span.spanType],
              marginLeft: span.left + "%",
              width: `max(${span.width}%, 2px)`,
              height: 24,
              alignSelf: "center",
            }}
          >
            {span.events.map((event) => {
              // Helper function to check if an event is a Hipocap security event
              const isHipocapSecurityEvent = (eventName: string): boolean => {
                return eventName === "hipocap.security.threat_detected" || 
                       eventName === "hipocap.security.analysis_complete";
              };
              
              // Check if this is a Hipocap security event
              const isHipocapEvent = isHipocapSecurityEvent(event.name);
              // Attributes use dot notation (e.g., "hipocap.severity")
              const severity = event.attributes?.["hipocap.severity"];
              const finalDecision = event.attributes?.["hipocap.final_decision"];
              const reason = event.attributes?.["hipocap.reason"];
              
              // Color mapping for Hipocap severity levels
              const getHipocapEventColor = (severity?: string, decision?: string): string => {
                // For ALLOWED decisions, use a green color
                if (decision === "ALLOWED") {
                  return "rgba(34, 197, 94, 1)"; // green-500
                }
                
                if (!severity) return "rgba(73, 219, 126, 1)"; // green (default)
                
                const severityLower = severity.toLowerCase();
                switch (severityLower) {
                  case "critical":
                    return "rgba(220, 38, 38, 1)"; // red-600
                  case "high":
                    return "rgba(239, 68, 68, 1)"; // red-500
                  case "medium":
                    return "rgba(73, 219, 126, 1)"; // green
                  case "low":
                    return "rgba(73, 219, 126, 1)"; // green
                  case "safe":
                    return "rgba(34, 197, 94, 1)"; // green-500
                  default:
                    return "rgba(73, 219, 126, 1)"; // green (default)
                }
              };
              
              const eventColor = isHipocapEvent ? getHipocapEventColor(severity, finalDecision) : "rgba(73, 219, 126, 1)"; // green-400
              const eventWidth = isHipocapEvent ? 3 : 1; // Make Hipocap events more visible
              const eventTitle = isHipocapEvent 
                ? `Hipocap Security Analysis: ${finalDecision || "UNKNOWN"}${severity ? ` - ${severity} severity` : ""}${reason ? ` - ${reason}` : ""}`
                : event.name;
              
              return (
                <div
                  key={event.id}
                  className="absolute rounded top-1/2 -translate-y-1/2"
                  style={{
                    backgroundColor: eventColor,
                    width: `${eventWidth}px`,
                    left: event.left + "%",
                    height: 24,
                  }}
                  title={eventTitle}
                />
              );
            })}
            {textPosition === "inside" && spanTextElement}
          </div>
          
          {/* Node content (span name) - positioned after timeline marker when outside */}
          {textPosition === "outside" && (
            <div className="flex-1 min-w-0 flex items-center">
              {spanTextElement}
            </div>
          )}
        </div>
        
        {/* Right section: Runtime duration - always aligned on same row */}
        <div className="flex items-center justify-end flex-shrink-0 text-xs text-muted-foreground font-mono h-full">
          {displayDuration}
        </div>
      </div>
    </div>
  );
};

export default memo(TimelineElement);
