import { get } from "lodash";
import { AlertTriangle, FileText, ListFilter, Minus, Plus, Search, Sparkles } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useLayoutEffect, useMemo } from "react";

import Header from "@/components/traces/trace-view/header";
import { HumanEvaluatorSpanView } from "@/components/traces/trace-view/human-evaluator-span-view";
import LangGraphView from "@/components/traces/trace-view/lang-graph-view.tsx";
import List from "@/components/traces/trace-view/list";
import Metadata from "@/components/traces/trace-view/metadata";
import Minimap from "@/components/traces/trace-view/minimap.tsx";
import SearchTraceSpansInput from "@/components/traces/trace-view/search";
import TraceViewStoreProvider, {
  MAX_ZOOM,
  MAX_TREE_VIEW_WIDTH,
  MIN_TREE_VIEW_WIDTH,
  MIN_ZOOM,
  TraceViewSpan,
  TraceViewTrace,
  useTraceViewStoreContext,
} from "@/components/traces/trace-view/trace-view-store.tsx";
import {
  enrichSpansWithPending,
  filterColumns,
  findSpanToSelect,
  onRealtimeUpdateSpans,
} from "@/components/traces/trace-view/utils";
import ViewDropdown from "@/components/traces/trace-view/view-dropdown";
import { Button } from "@/components/ui/button.tsx";
import { StatefulFilter, StatefulFilterList } from "@/components/ui/infinite-datatable/ui/datatable-filter";
import { useFiltersContextProvider } from "@/components/ui/infinite-datatable/ui/datatable-filter/context";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "@/lib/actions/common/filters";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { SpanType } from "@/lib/traces/types";
import { cn } from "@/lib/utils.ts";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../ui/resizable";
import SessionPlayer from "../session-player";
import { SpanView } from "../span-view";
import Chat from "./chat";
import { ScrollContextProvider } from "./scroll-context";
import Timeline from "./timeline";
import Tree from "./tree";

interface TraceViewProps {
  traceId: string;
  // Span id here to control span selection by spans table
  spanId?: string;
  propsTrace?: TraceViewTrace;
  onClose: () => void;
}

const PureTraceView = ({ traceId, spanId, onClose, propsTrace }: TraceViewProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathName = usePathname();
  const { projectId } = useParams();

  // Data states
  const {
    selectedSpan,
    setSelectedSpan,
    spans,
    setSpans,
    trace,
    setTrace,
    isSpansLoading,
    isTraceLoading,
    setIsTraceLoading,
    setIsSpansLoading,
    traceError,
    setTraceError,
    spansError,
    setSpansError,
    setSelectedEventId,
    setAutoOpenEventsTab,
  } = useTraceViewStoreContext((state) => ({
    selectedSpan: state.selectedSpan,
    setSelectedSpan: state.setSelectedSpan,
    spans: state.spans,
    setSpans: state.setSpans,
    trace: state.trace,
    setTrace: state.setTrace,
    isTraceLoading: state.isTraceLoading,
    isSpansLoading: state.isSpansLoading,
    setIsSpansLoading: state.setIsSpansLoading,
    setIsTraceLoading: state.setIsTraceLoading,
    traceError: state.traceError,
    setTraceError: state.setTraceError,
    spansError: state.spansError,
    setSpansError: state.setSpansError,
    setSelectedEventId: state.setSelectedEventId,
    setAutoOpenEventsTab: state.setAutoOpenEventsTab,
  }));

  // UI states
  const {
    tab,
    setTab,
    search,
    setSearch,
    searchEnabled,
    setSearchEnabled,
    browserSession,
    setBrowserSession,
    zoom,
    handleZoom,
    langGraph,
    getHasLangGraph,
    hasBrowserSession,
    setHasBrowserSession,
  } = useTraceViewStoreContext((state) => ({
    tab: state.tab,
    setTab: state.setTab,
    search: state.search,
    setSearch: state.setSearch,
    searchEnabled: state.searchEnabled,
    setSearchEnabled: state.setSearchEnabled,
    zoom: state.zoom,
    handleZoom: state.setZoom,
    browserSession: state.browserSession,
    setBrowserSession: state.setBrowserSession,
    setBrowserSessionTime: state.setSessionTime,
    langGraph: state.langGraph,
    getHasLangGraph: state.getHasLangGraph,
    hasBrowserSession: state.hasBrowserSession,
    setHasBrowserSession: state.setHasBrowserSession,
  }));

  // Local storage states
  const { treeWidth, spanPath, setSpanPath, setTreeWidth } = useTraceViewStoreContext((state) => ({
    treeWidth: state.treeWidth,
    setTreeWidth: state.setTreeWidth,
    spanPath: state.spanPath,
    setSpanPath: state.setSpanPath,
  }));

  const { value: filters, onChange: setFilters } = useFiltersContextProvider();
  const hasLangGraph = useMemo(() => getHasLangGraph(), [getHasLangGraph]);
  const llmSpanIds = useMemo(
    () => spans
      .filter((span) => 
        span.spanType === SpanType.LLM && 
        !span.attributes?.["hipocap.is_function_attempt"] &&
        !span.attributes?.["hipocap.is_event_span"]
      )
      .map((span) => span.spanId),
    [spans]
  );

  const handleFetchTrace = useCallback(async () => {
    try {
      setIsTraceLoading(true);
      setTraceError(undefined);

      if (propsTrace) {
        setTrace(propsTrace);
      } else {
        const response = await fetch(`/api/projects/${projectId}/traces/${traceId}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          const errorMessage = errorData.error || "Failed to load trace";

          setTraceError(errorMessage);
          return;
        }

        const traceData = (await response.json()) as TraceViewTrace;
        if (traceData.hasBrowserSession) {
          setHasBrowserSession(true);
          setBrowserSession(true);
        }
        setTrace(traceData);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load trace. Please try again.";
      setTraceError(errorMessage);
    } finally {
      setIsTraceLoading(false);
    }
  }, [
    projectId,
    propsTrace,
    setBrowserSession,
    setHasBrowserSession,
    setIsTraceLoading,
    setTrace,
    setTraceError,
    traceId,
  ]);

  const handleSpanSelect = useCallback(
    (span?: TraceViewSpan) => {
      if (!span) return;

      // If this is a virtual Hipocap event span or function attempt span, redirect to its parent
      let spanToSelect = span;
      let eventId: string | undefined;
      
      const isVirtualSpan = span.attributes?.["hipocap.is_event_span"] === true || 
                           span.attributes?.["hipocap.is_function_attempt"] === true;
      
      if (isVirtualSpan && span.parentSpanId) {
        const parentSpan = spans.find((s) => s.spanId === span.parentSpanId);
        if (parentSpan) {
          spanToSelect = parentSpan;
          // Extract the event ID from the virtual span attributes if it's an event span
          if (span.attributes?.["hipocap.is_event_span"]) {
            eventId = span.attributes?.["hipocap.event_id"];
            // Set flags to auto-open Events tab and highlight the event
            if (eventId) {
              setSelectedEventId(eventId);
              setAutoOpenEventsTab(true);
            }
          }
        }
      } else {
        // Clear event selection when selecting a regular span
        setSelectedEventId(undefined);
        setAutoOpenEventsTab(false);
      }

      setSelectedSpan(spanToSelect);

      const spanPath = spanToSelect.attributes?.["lmnr.span.path"];
      if (spanPath && Array.isArray(spanPath)) {
        setSpanPath(spanPath);
      }

      const currentSpanId = searchParams.get("spanId");
      // Always use the real span ID (not virtual span ID) in the URL
      if (currentSpanId !== spanToSelect.spanId) {
        const params = new URLSearchParams(searchParams);
        params.set("spanId", spanToSelect.spanId);
        router.replace(`${pathName}?${params.toString()}`);
      }
    },
    [setSelectedSpan, searchParams, setSpanPath, router, pathName, spans, setSelectedEventId, setAutoOpenEventsTab]
  );

  const fetchSpans = useCallback(
    async (search: string, filters: Filter[]) => {
      try {
        setIsSpansLoading(true);
        setSpansError(undefined);

        const params = new URLSearchParams();
        if (search) {
          params.set("search", search);
        }
        params.append("searchIn", "input");
        params.append("searchIn", "output");

        filters.forEach((filter) => params.append("filter", JSON.stringify(filter)));

        if (trace) {
          const startDate = new Date(new Date(trace.startTime).getTime() - 1000);
          const endDate = new Date(new Date(trace.endTime).getTime() + 1000);
          params.set("startDate", startDate.toISOString());
          params.set("endDate", endDate.toISOString());
        }

        const url = `/api/projects/${projectId}/traces/${traceId}/spans?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          const errorMessage = errorData.error || "Failed to load spans";

          setSpansError(errorMessage);
          return;
        }

        const results = (await response.json()) as TraceViewSpan[];
        const spans = search || filters?.length > 0 ? results : enrichSpansWithPending(results);

        setSpans(spans);

        if (spans.some((s) => Boolean(get(s.attributes, "lmnr.internal.has_browser_session"))) && !hasBrowserSession) {
          setHasBrowserSession(true);
          setBrowserSession(true);
        }

        if (spans.length > 0) {
          const selectedSpan = findSpanToSelect(spans, spanId, searchParams, spanPath);
          setSelectedSpan(selectedSpan);
        } else {
          setSelectedSpan(undefined);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Failed to load spans";
        setSpansError(errorMessage);

        console.error(e);
      } finally {
        setIsSpansLoading(false);
      }
    },
    [
      trace,
      setIsSpansLoading,
      setSpansError,
      projectId,
      traceId,
      setSpans,
      hasBrowserSession,
      setHasBrowserSession,
      setBrowserSession,
      setSelectedSpan,
    ]
  );

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("spanId");
    router.push(`${pathName}?${params.toString()}`);
    onClose();
  }, [onClose, pathName, router, searchParams]);

  const handleResizeTreeView = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = treeWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const containerWidth = window.innerWidth;
        // Calculate max width as 80% of viewport or the fixed MAX_TREE_VIEW_WIDTH, whichever is smaller
        // This ensures the right panel always has at least 20% of the viewport
        const maxWidth = Math.min(MAX_TREE_VIEW_WIDTH, containerWidth * 0.8);
        const newWidth = Math.max(
          MIN_TREE_VIEW_WIDTH,
          Math.min(maxWidth, startWidth + moveEvent.clientX - startX)
        );
        setTreeWidth(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [setTreeWidth, treeWidth]
  );

  const handleToggleSearch = useCallback(async () => {
    if (searchEnabled) {
      setSearchEnabled(false);
      setSearch("");
      if (search !== "") {
        await fetchSpans("", filters);
      }
    } else {
      setSearchEnabled(true);
    }
  }, [searchEnabled, setSearchEnabled, setSearch, search, fetchSpans, filters]);

  const handleAddFilter = useCallback(
    (filter: Filter) => {
      setFilters((prevFilters) => [...prevFilters, filter]);
    },
    [setFilters]
  );

  const isLoading = isTraceLoading && !trace;

  const eventHandlers = useMemo(
    () => ({
      span_update: (event: MessageEvent) => {
        const payload = JSON.parse(event.data);
        if (payload.spans && Array.isArray(payload.spans)) {
          for (const span of payload.spans) {
            onRealtimeUpdateSpans(setSpans, setTrace, setBrowserSession)(span);
          }
        }
      },
    }),
    [setBrowserSession, setSpans, setTrace]
  );

  useEffect(() => {
    if (!isSpansLoading) {
      const span = spans?.find((s) => s.spanId === spanId);
      if (spanId && span) {
        setSelectedSpan(span);
      }
    }
  }, [isSpansLoading, setSelectedSpan, spanId, spans]);

  useEffect(() => {
    handleFetchTrace();
  }, [handleFetchTrace]);

  useLayoutEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) {
      setSearch(urlSearch);
      setSearchEnabled(true);
    }
  }, []);

  useEffect(() => {
    fetchSpans(search, filters);

    return () => {
      setSpans([]);
      setTraceError(undefined);
      setSpansError(undefined);
    };
  }, [traceId, projectId, filters, setSpans, setTraceError, setSpansError]);

  useRealtime({
    key: `trace_${traceId}`,
    projectId: projectId as string,
    enabled: !!traceId && !!projectId,
    eventHandlers,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-x-2 p-2 border-b h-12">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex flex-col p-2 gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  if (traceError) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <Header handleClose={handleClose} />
        <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
          <div className="max-w-md mx-auto">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive mb-4">Error Loading Trace</h3>
            <p className="text-sm text-muted-foreground">{traceError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollContextProvider>
      <div className="flex h-full w-full">
        <div className="flex h-full flex-col flex-none relative" style={{ width: treeWidth }}>
          <Header handleClose={handleClose} />
          <div className="flex flex-col gap-3 px-4 py-3 bg-gradient-to-br from-muted/30 via-muted/20 to-transparent border-b border-border/40 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 flex-nowrap w-full overflow-x-auto no-scrollbar">
              <ViewDropdown />
              <div className="h-6 w-px bg-border/50" />
              <StatefulFilter columns={filterColumns}>
                <Button 
                  variant="outline" 
                  className="h-8 px-3.5 text-xs font-medium rounded-xl border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 hover:text-primary transition-all duration-200 shadow-sm"
                >
                  <ListFilter size={14} className="mr-1.5" />
                  Filters
                </Button>
              </StatefulFilter>
              <Button
                onClick={handleToggleSearch}
                variant="outline"
                className={cn(
                  "h-8 px-3.5 text-xs font-medium rounded-xl border transition-all duration-200 shadow-sm",
                  search || searchEnabled
                    ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 hover:text-primary"
                )}
              >
                <Search size={14} className="mr-1.5" />
                <span>Search</span>
              </Button>
              <Button
                onClick={() => setTab("metadata")}
                variant="outline"
                className={cn(
                  "h-8 px-3.5 text-xs font-medium rounded-xl border transition-all duration-200 shadow-sm",
                  tab === "metadata"
                    ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 hover:text-primary"
                )}
              >
                <FileText size={14} className="mr-1.5" />
                <span>Metadata</span>
              </Button>
              {/* <Button
                onClick={() => setTab("chat")}
                variant="outline"
                className={cn(
                  "h-8 px-3.5 text-xs font-medium rounded-xl border transition-all duration-200 shadow-sm bg-gradient-to-r",
                  tab === "chat"
                    ? "border-primary/50 bg-gradient-to-r from-primary/20 via-primary/15 to-primary/10 text-primary hover:from-primary/25 hover:via-primary/20 hover:to-primary/15"
                    : "border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 hover:text-primary"
                )}
              >
                <Sparkles size={14} className="mr-1.5" />
                <span>Ask AI</span>
              </Button> */}
              {tab === "timeline" && (
                <>
                  <div className="h-6 w-px bg-border/50 ml-auto" />
                  <Button
                    disabled={zoom === MAX_ZOOM}
                    className="h-8 w-8 rounded-xl border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 hover:text-primary disabled:opacity-40 transition-all duration-200 shadow-sm"
                    variant="outline"
                    size="icon"
                    onClick={() => handleZoom("in")}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    disabled={zoom === MIN_ZOOM}
                    className="h-8 w-8 rounded-xl border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 hover:text-primary disabled:opacity-40 transition-all duration-200 shadow-sm"
                    variant="outline"
                    size="icon"
                    onClick={() => handleZoom("out")}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
            <StatefulFilterList className="py-2 text-xs px-2 rounded-lg bg-background/30 border border-border/30" />
          </div>
          {(search || searchEnabled) && (
            <SearchTraceSpansInput spans={spans} submit={fetchSpans} filters={filters} onAddFilter={handleAddFilter} />
          )}
          {spansError ? (
            <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive mb-3" />
              <h4 className="text-sm font-semibold text-destructive mb-2">Error Loading Spans</h4>
              <p className="text-xs text-muted-foreground">{spansError}</p>
            </div>
          ) : (
            <ResizablePanelGroup id="trace-view-panels" direction="vertical">
              <ResizablePanel className="flex flex-col flex-1 h-full overflow-hidden relative">
                {tab === "metadata" && trace && <Metadata trace={trace} />}
                {tab === "chat" && trace && (
                  <Chat
                    trace={trace}
                    onSetSpanId={(spanId) => {
                      const span = spans.find((span) => span.spanId === spanId);
                      if (span) {
                        handleSpanSelect(span);
                      }
                    }}
                  />
                )}
                {tab === "timeline" && <Timeline />}
                {tab === "reader" && (
                  <div className="flex flex-1 h-full overflow-hidden relative">
                    <List traceId={traceId} onSpanSelect={handleSpanSelect} />
                    <Minimap onSpanSelect={handleSpanSelect} />
                  </div>
                )}
                {tab === "tree" &&
                  (isSpansLoading ? (
                    <div className="flex flex-col gap-2 p-2 pb-4 w-full min-w-full">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : (
                    <div className="flex flex-1 h-full overflow-hidden relative">
                      <Tree onSpanSelect={handleSpanSelect} />
                      <Minimap onSpanSelect={handleSpanSelect} />
                    </div>
                  ))}
              </ResizablePanel>
              {browserSession && (
                <>
                  <ResizableHandle className="z-50" withHandle />
                  <ResizablePanel>
                    {!isLoading && (
                      <SessionPlayer
                        onClose={() => setBrowserSession(false)}
                        hasBrowserSession={hasBrowserSession}
                        traceId={traceId}
                        llmSpanIds={llmSpanIds}
                      />
                    )}
                  </ResizablePanel>
                </>
              )}
              {langGraph && hasLangGraph && <LangGraphView spans={spans} />}
            </ResizablePanelGroup>
          )}
          <div
            className="absolute top-0 right-0 h-full cursor-col-resize z-50 group w-2"
            onMouseDown={handleResizeTreeView}
          >
            <div className="absolute top-0 right-0 h-full w-px bg-border group-hover:w-1 group-hover:bg-blue-400 transition-colors" />
          </div>
        </div>
        <div className="grow overflow-hidden flex-wrap h-full w-full">
          {isSpansLoading ? (
            <div className="flex flex-col space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : selectedSpan ? (
            selectedSpan.spanType === SpanType.HUMAN_EVALUATOR ? (
              <HumanEvaluatorSpanView
                traceId={selectedSpan.traceId}
                spanId={selectedSpan.spanId}
                key={selectedSpan.spanId}
              />
            ) : (
              <SpanView key={selectedSpan.spanId} spanId={selectedSpan.spanId} traceId={traceId} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center size-full text-muted-foreground">
              <span className="text-xl font-medium mb-2">No span selected</span>
              <span className="text-base">Select a span from the trace tree to view its details</span>
            </div>
          )}
        </div>
      </div>
    </ScrollContextProvider>
  );
};

export default function TraceView(props: TraceViewProps) {
  return (
    <TraceViewStoreProvider>
      <PureTraceView {...props} />
    </TraceViewStoreProvider>
  );
}
