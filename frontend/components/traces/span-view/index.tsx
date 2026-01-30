import { get, omit } from "lodash";
import { CircleAlert } from "lucide-react";
import { useParams } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import useSWR from "swr";

import { SpanControls } from "@/components/traces/span-controls";
import { HipocapAnalysisCard } from "@/components/traces/trace-view/hipocap-analysis-card";
import { hasHipocapAnalysis } from "@/components/traces/trace-view/utils";
import SpanViewSearchBar from "@/components/traces/span-view/search-bar.tsx";
import SpanContent from "@/components/traces/span-view/span-content";
import { SpanSearchProvider, useSpanSearchContext } from "@/components/traces/span-view/span-search-context";
import { SpanViewStateProvider } from "@/components/traces/span-view/span-view-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import ContentRenderer from "@/components/ui/content-renderer/index";
import { Skeleton } from "@/components/ui/skeleton";
import { Event } from "@/lib/events/types";
import { Span } from "@/lib/traces/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";

interface SpanViewProps {
  spanId: string;
  traceId: string;
}

const swrFetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorText = (await res.json()) as { error: string };

    throw new Error(errorText.error);
  }

  return res.json();
};

// Helper function to check if a value is null or undefined
const isNullOrUndefined = (value: any): boolean => {
  return value === null || value === undefined;
};

// Inner component that has access to SpanSearchContext
const SpanViewTabs = ({
  span,
  cleanedEvents,
  searchRef,
  searchOpen,
  setSearchOpen
}: {
  span: Span;
  cleanedEvents: any;
  searchRef: React.RefObject<HTMLInputElement | null>;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}) => {
  const searchContext = useSpanSearchContext();

  const hasHipocap = useMemo(() => hasHipocapAnalysis(span), [span]);
  const hasInput = useMemo(() => !isNullOrUndefined(span.input), [span.input]);
  const hasOutput = useMemo(() => !isNullOrUndefined(span.output), [span.output]);

  // Determine the default tab - prioritize hipocap, then input, then output, then attributes
  const defaultTab = useMemo(() => {
    if (hasHipocap) return "hipocap-analysis";
    if (hasInput) return "span-input";
    if (hasOutput) return "span-output";
    return "attributes";
  }, [hasInput, hasOutput, hasHipocap]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs className="flex flex-col grow overflow-hidden gap-0" defaultValue={defaultTab} tabIndex={0}>
        {/* Tabs Navigation - Horizontal Layout */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
          <TabsList className="border-none text-xs h-8 bg-transparent">
            {hasHipocap && (
              <TabsTrigger value="hipocap-analysis" className="text-xs px-3 h-7">
                Hipocap Analysis
              </TabsTrigger>
            )}
            {hasInput && (
              <TabsTrigger value="span-input" className="text-xs px-3 h-7">
                Span Input
              </TabsTrigger>
            )}
            {hasOutput && (
              <TabsTrigger value="span-output" className="text-xs px-3 h-7">
                Span Output
              </TabsTrigger>
            )}
            <TabsTrigger value="attributes" className="text-xs px-3 h-7">
              Attributes
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs px-3 h-7">
              Events
            </TabsTrigger>
          </TabsList>
          <SpanViewSearchBar ref={searchRef} open={searchOpen} setOpen={setSearchOpen} />
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasHipocap && (
            <TabsContent value="hipocap-analysis" className="w-full h-full overflow-y-auto m-0">
              <div className="p-4">
                <HipocapAnalysisCard span={span} />
              </div>
            </TabsContent>
          )}
          {hasInput && (
            <TabsContent value="span-input" className="w-full h-full m-0">
              <SpanContent span={span} type="input" />
            </TabsContent>
          )}
          {hasOutput && (
            <TabsContent value="span-output" className="w-full h-full m-0">
              <SpanContent span={span} type="output" />
            </TabsContent>
          )}
          <TabsContent value="attributes" className="w-full h-full m-0">
            <ContentRenderer
              className="rounded-none border-0"
              codeEditorClassName="rounded-none border-none bg-background contain-strict"
              readOnly
              value={JSON.stringify(span.attributes)}
              defaultMode="yaml"
              searchTerm={searchContext?.searchTerm || ""}
            />
          </TabsContent>
          <TabsContent value="events" className="w-full h-full m-0">
            <ContentRenderer
              className="rounded-none border-0"
              codeEditorClassName="rounded-none border-none bg-background contain-strict"
              readOnly
              value={JSON.stringify(cleanedEvents)}
              defaultMode="yaml"
              searchTerm={searchContext?.searchTerm || ""}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export function SpanView({ spanId, traceId }: SpanViewProps) {
  const { projectId } = useParams();
  const [searchOpen, setSearchOpen] = useState(false);

  // Check if this is a virtual Hipocap event span ID or function attempt span ID and redirect to parent
  const actualSpanId = useMemo(() => {
    // If spanId looks like a virtual span ID (contains -hipocap-event- or -function-attempt-), extract parent
    if (spanId?.includes("-hipocap-event-")) {
      return spanId.split("-hipocap-event-")[0];
    }
    if (spanId?.includes("-function-attempt-")) {
      return spanId.split("-function-attempt-")[0];
    }
    return spanId;
  }, [spanId]);

  const {
    data: span,
    isLoading,
    error,
  } = useSWR<Span>(
    actualSpanId ? `/api/projects/${projectId}/traces/${traceId}/spans/${actualSpanId}` : null,
    swrFetcher
  );
  const { data: events } = useSWR<Event[]>(
    actualSpanId ? `/api/projects/${projectId}/traces/${traceId}/spans/${actualSpanId}/events` : null,
    swrFetcher
  );

  const cleanedEvents = useMemo(() => events?.map((event) => omit(event, ["spanId", "projectId"])), [events]);
  const searchRef = useRef<HTMLInputElement>(null);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    searchRef?.current?.focus();
  }, []);

  useHotkeys("meta+f", openSearch, {
    enableOnFormTags: ["input"],
    preventDefault: true,
  });

  useHotkeys("esc", () => setSearchOpen(false), {
    enableOnFormTags: ["input"],
    preventDefault: true,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-2 p-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <div className="flex items-start gap-4">
            <CircleAlert className="w-4 h-4" />
            <div className="flex-1 space-y-1">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : JSON.stringify(error, null, 2)}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  if (span && get(span.attributes, "gen_ai.prompt.user")) {
    return (
      <div className="whitespace-pre-wrap p-4 border rounded-md bg-muted/50">
        {get(span.attributes, "gen_ai.prompt.user")}
      </div>
    );
  }

  if (span) {
    return (
      <SpanViewStateProvider>
        <SpanSearchProvider>
          <SpanControls events={cleanedEvents} span={span}>
            <SpanViewTabs
              span={span}
              cleanedEvents={cleanedEvents}
              searchRef={searchRef}
              searchOpen={searchOpen}
              setSearchOpen={setSearchOpen}
            />
          </SpanControls>
        </SpanSearchProvider>
      </SpanViewStateProvider>
    );
  }
}
