import { get } from "lodash";
import { ChevronDown, Copy, Database, Loader, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { PropsWithChildren, useCallback, useMemo } from "react";

import EvaluatorScoresList from "@/components/evaluators/evaluator-scores-list";
import RegisterEvaluatorPopover from "@/components/evaluators/register-evaluator-popover";
import TagsContextProvider from "@/components/tags/tags-context";
import TagsList from "@/components/tags/tags-list";
import TagsTrigger from "@/components/tags/tags-trigger";
import AddToLabelingQueuePopover from "@/components/traces/add-to-labeling-queue-popover";
import ErrorCard from "@/components/traces/error-card";
import ExportSpansPopover from "@/components/traces/export-spans-popover";
import { useOpenInSql } from "@/components/traces/trace-view/use-open-in-sql.tsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Event } from "@/lib/events/types";
import { useToast } from "@/lib/hooks/use-toast";
import { Span, SpanType } from "@/lib/traces/types";
import { ErrorEventAttributes } from "@/lib/types";

import SpanTypeIcon from "./span-type-icon";
import SpanStatsShields from "./stats-shields";

interface SpanControlsProps {
  span: Span;
  events?: Omit<Event, "projectId" | "spanId">[];
}

export function SpanControls({ children, span, events }: PropsWithChildren<SpanControlsProps>) {
  const { projectId } = useParams();

  const errorEventAttributes = useMemo(
    () => events?.find((e) => e.name === "exception")?.attributes as ErrorEventAttributes,
    [events]
  );

  const { toast } = useToast();
  const { openInSql, isLoading } = useOpenInSql({
    projectId: projectId as string,
    params: { type: "span", spanId: span.spanId },
  });

  const handleCopySpanId = useCallback(async () => {
    if (span?.spanId) {
      await navigator.clipboard.writeText(span.spanId);
      toast({ title: "Copied span ID", duration: 1000 });
    }
  }, [span?.spanId, toast]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Top Header Bar with Metrics */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <SpanTypeIcon spanType={span.spanType} />
          <div className="flex flex-col min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-lg font-semibold focus-visible:outline-0 truncate text-left min-w-0"
                >
                  <span className="truncate">{span.name}</span>
                  <ChevronDown className="ml-1 min-w-3.5 size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleCopySpanId}>
                  <Copy size={14} />
                  Copy span ID
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isLoading} onClick={openInSql}>
                  {isLoading ? <Loader className="size-3.5" /> : <Database className="size-3.5" />}
                  Open in SQL editor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="text-xs font-mono text-muted-foreground px-2 mt-0.5">
              {new Date(span.startTime).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          <SpanStatsShields className="flex-wrap" span={span} />
        </div>
      </div>

      {/* Secondary Header with Model/Tools and Action Buttons */}
      <div className="flex items-center justify-between px-4 py-2 border-b gap-3 flex-shrink-0 bg-background">
        <div className="flex items-center gap-2 flex-wrap">
          <TagsContextProvider spanId={span.spanId}>
            <div className="flex gap-1.5 items-center">
              <TagsTrigger />
              <RegisterEvaluatorPopover spanPath={get(span.attributes, "lmnr.span.path", [])} />
              <AddToLabelingQueuePopover spanId={span.spanId} />
              <ExportSpansPopover span={span} />
            </div>
          </TagsContextProvider>
        </div>
        {span.spanType === SpanType.LLM && (
          <Link
            href={{ pathname: `/project/${projectId}/playgrounds/create`, query: { spanId: span.spanId } }}
            passHref
          >
            <Button variant="outlinePrimary" className="px-2 text-xs h-7 font-mono bg-primary/10">
              <PlayCircle className="mr-1" size={14} />
              Experiment in playground
            </Button>
          </Link>
        )}
      </div>

      {/* Tags and Evaluators Section */}
      <TagsContextProvider spanId={span.spanId}>
        <div className="px-4 py-2 border-b flex-shrink-0">
          <TagsList />
          <EvaluatorScoresList spanId={span.spanId} />
        </div>
      </TagsContextProvider>

      {/* Error Card */}
      {errorEventAttributes && (
        <div className="px-4 py-2 flex-shrink-0">
          <ErrorCard attributes={errorEventAttributes} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
