import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

import { TraceViewListSpan, useTraceViewStoreContext } from "@/components/traces/trace-view/trace-view-store.tsx";
import { cn } from "@/lib/utils.ts";

import SpanTypeIcon from "../../span-type-icon.tsx";

interface MiniTreeProps {
  span: TraceViewListSpan;
}

export function MiniTree({ span }: MiniTreeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathName = usePathname();

  const { getSpanBranch, getSpanNameInfo, selectSpanById } = useTraceViewStoreContext((state) => ({
    getSpanBranch: state.getSpanBranch,
    getSpanNameInfo: state.getSpanNameInfo,
    selectSpanById: state.selectSpanById,
  }));

  const fullSpanBranch = getSpanBranch(span);

  const allSpans = fullSpanBranch.map((branchSpan) => ({
    spanId: branchSpan.spanId,
    name: branchSpan.name,
    spanType: branchSpan.spanType,
    isCurrent: branchSpan.spanId === span.spanId,
  }));

  const ROW_HEIGHT = 22;
  const DEPTH_INDENT = 24;

  const handleSpanClick = (spanId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    selectSpanById(spanId);

    const params = new URLSearchParams(searchParams);
    params.set("spanId", spanId);
    router.push(`${pathName}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col min-w-[180px] max-w-[400px]">
      {allSpans.map((span, index) => {
        const spanInfo = getSpanNameInfo(span.spanId) || { name: span.name };
        const displayName = spanInfo.name;
        const count = spanInfo.count;
        const depth = index;

        return (
          <div
            key={span.spanId}
            className="flex items-center gap-0 relative group"
            style={{ height: ROW_HEIGHT, paddingLeft: depth * DEPTH_INDENT }}
          >
            {/* Enhanced tree connector - L-shaped line with gradient */}
            {depth > 0 && (
              <div
                className={cn(
                  "border-l-2 border-b-2 border-border/50 rounded-bl-lg absolute transition-all duration-200",
                  "group-hover:border-border shadow-sm"
                )}
                style={{
                  height: ROW_HEIGHT / 2,
                  width: 10,
                  top: 2,
                  left: (depth - 1) * DEPTH_INDENT + 15,
                }}
              />
            )}

            {/* Enhanced vertical line for parent continuation */}
            {depth > 0 &&
              Array.from({ length: depth - 1 }).map((_, i) => (
                <div
                  key={i}
                  className="border-l border-border/30 absolute transition-all duration-200 group-hover:border-border/40"
                  style={{
                    height: ROW_HEIGHT,
                    left: i * DEPTH_INDENT + 1,
                    top: 0,
                  }}
                />
              ))}

            {/* Enhanced span info with improved styling */}
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-md text-[11px] flex-1 min-w-0 cursor-pointer transition-all duration-200",
                "hover:bg-muted/50 hover:shadow-sm",
                span.isCurrent 
                  ? "font-semibold bg-primary/10 text-foreground shadow-sm" 
                  : "text-secondary-foreground hover:text-foreground"
              )}
              onClick={handleSpanClick(span.spanId)}
            >
              <div className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                <SpanTypeIcon
                  containerWidth={18}
                  containerHeight={18}
                  spanType={span.spanType}
                  iconClassName="size-3.5"
                  className="flex-shrink-0"
                />
              </div>
              <span className="truncate transition-all duration-200" title={displayName}>
                {displayName}
              </span>
              {count && (
                <span className="text-secondary-foreground px-1.5 py-0.5 bg-muted/80 rounded-full text-[10px] font-medium flex-shrink-0 shadow-sm transition-all duration-200 group-hover:bg-muted group-hover:shadow-md">
                  {count}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
