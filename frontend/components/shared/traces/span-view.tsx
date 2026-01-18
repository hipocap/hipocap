"use client";
import React, { useMemo } from "react";
import useSWR from "swr";

import ErrorCard from "@/components/traces/error-card";
import SpanTypeIcon from "@/components/traces/span-type-icon";
import SpanContent from "@/components/traces/span-view/span-content.tsx";
import { SpanViewStateProvider } from "@/components/traces/span-view/span-view-store";
import SpanStatsShields from "@/components/traces/stats-shields";
import ContentRenderer from "@/components/ui/content-renderer";
import MonoWithCopy from "@/components/ui/mono-with-copy";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Event } from "@/lib/events/types";
import { Span } from "@/lib/traces/types";
import { ErrorEventAttributes } from "@/lib/types";
import { swrFetcher } from "@/lib/utils";

interface SpanViewProps {
  spanId: string;
  traceId: string;
}

// Helper function to check if a value is null or undefined
const isNullOrUndefined = (value: any): boolean => {
  return value === null || value === undefined;
};

export function SpanView({ spanId, traceId }: SpanViewProps) {
  const { data: span, isLoading } = useSWR<Span>(`/api/shared/traces/${traceId}/spans/${spanId}`, swrFetcher);
  const { data: events = [] } = useSWR<Event[]>(`/api/shared/traces/${traceId}/spans/${spanId}/events`, swrFetcher);

  const cleanedEvents = useMemo(
    () =>
      events?.map((event) => {
        const { spanId, projectId, ...rest } = event;
        return rest;
      }),
    [events]
  );

  const errorEventAttributes = useMemo(
    () => cleanedEvents?.find((e) => e.name === "exception")?.attributes as ErrorEventAttributes,
    [cleanedEvents]
  );

  const hasInput = useMemo(() => !isNullOrUndefined(span?.input), [span?.input]);
  const hasOutput = useMemo(() => !isNullOrUndefined(span?.output), [span?.output]);

  // Determine the default tab - prioritize input, then output, then attributes
  const defaultTab = useMemo(() => {
    if (hasInput) return "span-input";
    if (hasOutput) return "span-output";
    return "attributes";
  }, [hasInput, hasOutput]);

  if (isLoading || !span) {
    return (
      <div className="flex flex-col space-y-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <SpanViewStateProvider>
      <Tabs className="flex flex-col h-full w-full" defaultValue={defaultTab}>
        <div className="flex-none">
          <div className="flex flex-col px-4 pt-2 gap-1">
            <div className="flex flex-col gap-1">
              <div className="flex flex-none items-center space-x-2">
                <SpanTypeIcon spanType={span.spanType} />
                <div className="text-xl items-center font-medium truncate">{span.name}</div>
              </div>
              <MonoWithCopy className="text-muted-foreground">{span.spanId}</MonoWithCopy>
            </div>
            <div className="flex flex-wrap py-1 gap-2">
              <SpanStatsShields span={span}>
                <div className="flex flex-row text-xs font-mono space-x-2 rounded-md p-0.5 px-2 border items-center">
                  {new Date(span.startTime).toLocaleString()}
                </div>
              </SpanStatsShields>
            </div>
            {errorEventAttributes && <ErrorCard attributes={errorEventAttributes} />}
          </div>
          <div className="px-2 pb-2 mt-2 border-b w-full">
            <TabsList className="border-none text-xs h-7">
              {hasInput && (
                <TabsTrigger value="span-input" className="text-xs">
                  Span Input
                </TabsTrigger>
              )}
              {hasOutput && (
                <TabsTrigger value="span-output" className="text-xs">
                  Span Output
                </TabsTrigger>
              )}
              <TabsTrigger value="attributes" className="text-xs">
                Attributes
              </TabsTrigger>
              <TabsTrigger value="events" className="text-xs">
                Events
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <div className="grow flex overflow-hidden">
          {hasInput && (
            <TabsContent value="span-input" className="w-full h-full">
              <SpanContent span={span} type="input" />
            </TabsContent>
          )}
          {hasOutput && (
            <TabsContent value="span-output" className="w-full h-full">
              <SpanContent span={span} type="output" />
            </TabsContent>
          )}
          <TabsContent value="attributes" className="w-full h-full">
            <ContentRenderer
              className="rounded-none border-0"
              codeEditorClassName="rounded-none border-none bg-background contain-strict"
              readOnly
              value={JSON.stringify(span.attributes)}
              defaultMode="yaml"
            />
          </TabsContent>
          <TabsContent value="events" className="w-full h-full">
            <ContentRenderer
              className="rounded-none border-0"
              codeEditorClassName="rounded-none border-none bg-background contain-strict"
              readOnly
              value={JSON.stringify(cleanedEvents)}
              defaultMode="yaml"
            />
          </TabsContent>
        </div>
      </Tabs>
    </SpanViewStateProvider>
  );
}
