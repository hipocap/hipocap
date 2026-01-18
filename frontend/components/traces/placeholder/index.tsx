"use client";

import { ArrowUpRight, Radio } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtime } from "@/lib/hooks/use-realtime";

import ApiKeyGenerator from "../../onboarding/api-key-generator.tsx";
import UserIdGenerator from "../../onboarding/user-id-generator.tsx";
import Header from "../../ui/header";

const InstallTabsSection = dynamic(() => import("./tabs-section.tsx").then((mod) => mod.InstallTabsSection), {
  ssr: false,
});

const InitializationTabsSection = dynamic(
  () => import("./tabs-section.tsx").then((mod) => mod.InitializationTabsSection),
  {
    ssr: false,
  }
);

export default function TracesPagePlaceholder() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const [isConnected, setIsConnected] = useState(false);

  const eventHandlers = useMemo(
    () => ({
      trace_update: () => {
        localStorage.setItem("traces-table:realtime", JSON.stringify(true));
        router.refresh();
      },
    }),
    [router]
  );

  const onConnectionUpdate = useCallback(
    (status: boolean) => () => {
      setIsConnected(status);
    },
    []
  );

  useRealtime({
    key: "traces",
    projectId: params.projectId,
    enabled: true,
    onConnect: onConnectionUpdate(true),
    onError: onConnectionUpdate(false),
    eventHandlers,
  });

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Header path={"traces"} />
      <ScrollArea>
        <div className="flex flex-col mx-auto p-6 max-w-3xl gap-8 pb-16">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">Get started with Tracing</h1>
            <p className="text-muted-foreground">
              You don{"'"}t have any traces yet. Follow these steps to start sending traces.
            </p>
            {isConnected && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border border-border/50">
                <Radio className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm text-muted-foreground">Waiting for incoming traces...</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Install Hipocap SDK</h2>
            <InstallTabsSection />
          </div>

          <UserIdGenerator title="Get your User ID" />

          <ApiKeyGenerator context="traces" />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-medium">Initialize Hipocap</h2>
              <p className="text-sm text-muted-foreground">Add 2 lines of code at the top of your project.</p>
            </div>
            <InitializationTabsSection />
          </div>

          <div className="flex items-center gap-6 text-sm">
            {/* <a
              href=""
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              Documentation
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a> */}
            <a
              href="
https://discord.gg/ubSrVQmJef"
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              Need help? Join Discord
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
