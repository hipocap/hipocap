import { TooltipPortal } from "@radix-ui/react-tooltip";
import {ArrowLeft, ChevronDown, ChevronsRight, ChevronUp, CirclePlay, Copy, Database, Expand, Loader} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { memo, useCallback, useMemo } from "react";

import ShareTraceButton from "@/components/traces/share-trace-button";
import LangGraphViewTrigger from "@/components/traces/trace-view/lang-graph-view-trigger";
import { useTraceViewNavigation } from "@/components/traces/trace-view/navigation-context";
import { useTraceViewStoreContext } from "@/components/traces/trace-view/trace-view-store.tsx";
import { useOpenInSql } from "@/components/traces/trace-view/use-open-in-sql.tsx";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";

import { TraceStatsShields } from "../stats-shields";

interface HeaderProps {
  handleClose: () => void;
}

const Header = ({ handleClose }: HeaderProps) => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const { navigateDown, navigateUp } = useTraceViewNavigation();
  const { trace, browserSession, setBrowserSession, langGraph, setLangGraph, getHasLangGraph } =
    useTraceViewStoreContext((state) => ({
      trace: state.trace,
      browserSession: state.browserSession,
      setBrowserSession: state.setBrowserSession,
      langGraph: state.langGraph,
      setLangGraph: state.setLangGraph,
      getHasLangGraph: state.getHasLangGraph,
    }));

  const { toast } = useToast();
  const { openInSql, isLoading } = useOpenInSql({ projectId: projectId as string, params: { type: 'trace', traceId: String(trace?.id) } });

  const handleCopyTraceId = useCallback(async () => {
    if (trace?.id) {
      await navigator.clipboard.writeText(trace.id);
      toast({ title: "Copied trace ID", duration: 1000 });
    }
  }, [trace?.id, toast]);

  const fullScreenParams = useMemo(() => {
    const ps = new URLSearchParams(searchParams);
    if (params.evaluationId) {
      ps.set("evaluationId", params.evaluationId as string);
    }
    return ps;
  }, [params.evaluationId, searchParams]);

  const hasLangGraph = useMemo(() => getHasLangGraph(), [getHasLangGraph]);

  const handleBack = useCallback(() => {
    // Navigate back to traces list, preserving query parameters
    const backParams = new URLSearchParams(searchParams);
    backParams.delete("traceId");
    backParams.delete("spanId");
    router.push(`/project/${projectId}/traces?${backParams.toString()}`);
  }, [projectId, router, searchParams]);

  return (
    <div className="relative min-h-[50px] flex flex-col gap-1.5 px-3 py-1.5 bg-gradient-to-br from-background via-background/95 to-muted/20 border-b border-border/50 backdrop-blur-sm">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between w-full gap-4">
        {/* Left Section - Navigation */}
        <div className="flex items-center gap-2">
          {params?.traceId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200 border border-transparent hover:border-primary/20" 
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent>Back to traces</TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}
          {!params?.traceId && (
            <>
              <Button 
                variant={"ghost"} 
                className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200 border border-transparent hover:border-primary/20" 
                onClick={handleClose}
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </Button>
              {trace && (
                <Link passHref href={`/project/${projectId}/traces/${trace?.id}?${fullScreenParams.toString()}`}>
                  <Button 
                    variant="ghost" 
                    className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200 border border-transparent hover:border-primary/20"
                  >
                    <Expand className="w-3.5 h-3.5" size={14} />
                  </Button>
                </Link>
              )}
              {trace && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="h-7 px-2.5 rounded-lg text-xs font-semibold focus-visible:outline-0 bg-muted/40 hover:bg-muted/60 border border-border/50 transition-all duration-200"
                    >
                      Trace
                      <ChevronDown className="ml-1 size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-xl border-border/50">
                    <DropdownMenuItem onClick={handleCopyTraceId} className="rounded-lg">
                      <Copy size={14} />
                      Copy trace ID
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isLoading} onClick={openInSql} className="rounded-lg">
                      {isLoading ? <Loader className="size-3.5" /> : <Database className="size-3.5" />}
                      Open in SQL editor
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>

        {/* Middle Section - Stats */}
        {trace && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TraceStatsShields className="box-border w-full" trace={trace} />
          </div>
        )}

        {/* Right Section - Actions */}
        <div className="flex items-center gap-1.5">
          {!params?.traceId && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    disabled={!trace} 
                    onClick={navigateDown} 
                    className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200 border border-transparent hover:border-primary/20 disabled:opacity-40" 
                    variant="ghost"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent className="flex items-center">
                    Navigate down (
                    <kbd className="inline-flex items-center justify-center w-3 h-3 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-lg shadow-md">
                      j
                    </kbd>
                    )
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    disabled={!trace} 
                    onClick={navigateUp} 
                    className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200 border border-transparent hover:border-primary/20 disabled:opacity-40" 
                    variant="ghost"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent className="flex items-center">
                    Navigate up (
                    <kbd className="inline-flex items-center justify-center w-3 h-3 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-lg shadow-md">
                      k
                    </kbd>
                    )
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={!trace}
                className={cn(
                  "h-7 w-7 rounded-lg transition-all duration-200 border",
                  browserSession 
                    ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30" 
                    : "border-transparent hover:border-primary/20 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                )}
                variant="ghost"
                onClick={() => setBrowserSession(!browserSession)}
              >
                <CirclePlay className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent>{browserSession ? "Hide Media Viewer" : "Show Media Viewer"}</TooltipContent>
            </TooltipPortal>
          </Tooltip>
          {hasLangGraph && <LangGraphViewTrigger setOpen={setLangGraph} open={langGraph} />}
          {trace && <ShareTraceButton projectId={projectId} />}
        </div>
      </div>
    </div>
  );
};

export default memo(Header);
