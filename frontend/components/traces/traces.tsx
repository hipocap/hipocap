"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";

import TraceViewNavigationProvider, { getTracesConfig } from "@/components/traces/trace-view/navigation-context";
import { useUserContext } from "@/contexts/user-context";
import { Feature, isFeatureEnabled } from "@/lib/features/features";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import SessionsTable from "./sessions-table";
import SpansTable from "./spans-table";
import { TracesStoreProvider, useTracesStoreContext } from "./traces-store";
import TracesTable from "./traces-table";

enum TracesTab {
  TRACES = "traces",
  SESSIONS = "sessions",
  SPANS = "spans",
  ANALYTICS = "analytics",
}

type NavigationItem =
  | string
  | {
    traceId: string;
    spanId: string;
  };

function TracesContent() {
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const user = useUserContext();
  const posthog = usePostHog();
  const tracesTab = (searchParams.get("view") || TracesTab.TRACES) as TracesTab;

  const { setTraceId } = useTracesStoreContext((state) => ({
    setTraceId: state.setTraceId,
  }));

  if (isFeatureEnabled(Feature.POSTHOG)) {
    posthog.identify(user.email);
  }

  const resetUrlParams = (newView: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("filter");
    params.delete("textSearch");
    params.delete("traceId");
    params.delete("spanId");
    params.set("view", newView);
    setTraceId(null);
    router.push(`${pathName}?${params.toString()}`);
  };

  const handleNavigate = useCallback(
    (item: NavigationItem | null) => {
      if (item) {
        if (typeof item === "string") {
          // Navigate to full-screen trace view
          const traceParams = new URLSearchParams(searchParams);
          traceParams.delete("traceId");
          traceParams.delete("spanId");
          router.push(`/project/${projectId}/traces/${item}?${traceParams.toString()}`);
        } else {
          // Navigate to full-screen trace view with span selected
          const traceParams = new URLSearchParams(searchParams);
          traceParams.set("spanId", item.spanId);
          router.push(`/project/${projectId}/traces/${item.traceId}?${traceParams.toString()}`);
        }
      }
    },
    [projectId, router, searchParams]
  );

  return (
    <TraceViewNavigationProvider<NavigationItem> config={getTracesConfig()} onNavigate={handleNavigate}>
      <Tabs
        className="flex flex-1 overflow-hidden gap-4"
        value={tracesTab}
        onValueChange={(value) => resetUrlParams(value)}
      >
        <TabsList className="mx-4 h-8">
          <TabsTrigger className="text-xs" value="traces">
            Traces
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="spans">
            Spans
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="sessions">
            Sessions
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="analytics">
            Analytics
          </TabsTrigger>
        </TabsList>
        <TabsContent value="traces" asChild>
          <TracesTable showChart={false} />
        </TabsContent>
        <TabsContent value="spans" asChild>
          <SpansTable />
        </TabsContent>
        <TabsContent value="sessions" asChild>
          <SessionsTable />
        </TabsContent>
        <TabsContent value="analytics" asChild>
          <TracesTable showTable={false} />
        </TabsContent>
      </Tabs>
    </TraceViewNavigationProvider>
  );
}

export default function Traces() {
  const searchParams = useSearchParams();

  const traceId = searchParams.get("traceId");
  const spanId = searchParams.get("spanId");

  return (
    <TracesStoreProvider traceId={traceId} spanId={spanId}>
      <TracesContent />
    </TracesStoreProvider>
  );
}
