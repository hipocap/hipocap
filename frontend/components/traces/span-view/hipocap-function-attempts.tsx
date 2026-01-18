import { AlertCircle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import React, { memo } from "react";

import { useSpanSearchContext } from "@/components/traces/span-view/span-search-context";
import { useSpanViewStore } from "@/components/traces/span-view/span-view-store";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ContentRenderer from "@/components/ui/content-renderer/index";
import { ResizableWrapper } from "./common";
import { cn } from "@/lib/utils";

interface FunctionAttemptProps {
  functionName: string;
  index: number;
  severity?: string;
  decision?: string;
  reason?: string;
  blockedAt?: string;
  presetKey: string;
  eventData?: any;
}

const PureFunctionAttemptPart = ({
  functionName,
  index,
  severity = "unknown",
  decision = "unknown",
  reason = "",
  blockedAt,
  presetKey,
  eventData,
}: FunctionAttemptProps) => {
  const storageKey = `resize-${presetKey}-attempt-${index}`;
  const setHeight = useSpanViewStore((state) => state.setHeight);
  const height = useSpanViewStore((state) => state.heights.get(storageKey) || null);
  const searchContext = useSpanSearchContext();

  const severityLower = severity.toLowerCase();
  const decisionLower = decision.toLowerCase();

  // Determine status and color based on decision and severity
  const getStatusInfo = () => {
    if (decisionLower === "blocked" || decisionLower === "denied") {
      return {
        icon: XCircle,
        color: "text-red-500",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/50",
        label: "Blocked",
      };
    }
    if (decisionLower === "allowed" || decisionLower === "approved") {
      return {
        icon: CheckCircle2,
        color: "text-green-500",
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/50",
        label: "Allowed",
      };
    }
    if (decisionLower === "review_required" || decisionLower === "review") {
      return {
        icon: AlertCircle,
        color: "text-amber-500",
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/50",
        label: "Review Required",
      };
    }
    return {
      icon: ShieldAlert,
      color: "text-blue-500",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/50",
      label: "Unknown",
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Get severity badge color
  const getSeverityColor = () => {
    switch (severityLower) {
      case "critical":
        return "bg-red-600 text-white";
      case "high":
        return "bg-red-500 text-white";
      case "medium":
        return "bg-amber-500 text-white";
      case "low":
        return "bg-amber-400 text-white";
      case "safe":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const attemptDetails = {
    functionName,
    severity,
    decision,
    reason,
    blockedAt,
    ...(eventData && { eventData }),
  };

  return (
    <div className={cn("flex flex-col gap-2 p-2 border rounded-md", statusInfo.bgColor, statusInfo.borderColor)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("min-w-4 min-h-4", statusInfo.color)} size={16} />
          <span className="font-medium text-sm">{functionName}</span>
          <Badge className={cn("text-xs", getSeverityColor())}>{severity}</Badge>
          <Badge variant="outline" className="text-xs">
            {statusInfo.label}
          </Badge>
        </div>
      </div>
      {reason && (
        <div className="text-xs text-muted-foreground">
          <strong>Reason:</strong> {reason}
        </div>
      )}
      {blockedAt && (
        <div className="text-xs text-muted-foreground">
          <strong>Blocked at:</strong> {blockedAt}
        </div>
      )}
      <ResizableWrapper height={height} onHeightChange={setHeight(storageKey)} className="border-0">
        <ContentRenderer
          readOnly
          defaultMode="json"
          codeEditorClassName="rounded"
          value={JSON.stringify(attemptDetails, null, 2)}
          presetKey={`editor-${presetKey}-attempt-${index}`}
          className="border-0 bg-muted/50"
          searchTerm={searchContext?.searchTerm || ""}
        />
      </ResizableWrapper>
    </div>
  );
};

export const FunctionAttemptPart = memo(PureFunctionAttemptPart);

interface HipocapFunctionAttemptsPartsProps {
  functionAttempts: string[];
  eventData?: Record<string, any>;
  presetKey: string;
}

const PureHipocapFunctionAttemptsParts = ({
  functionAttempts,
  eventData,
  presetKey,
}: HipocapFunctionAttemptsPartsProps) => {
  // Get the first event data (or use defaults)
  const firstEventData = eventData ? (Object.values(eventData)[0] as any) : {};
  const severity = firstEventData?.severity || "unknown";
  const decision = firstEventData?.decision || "unknown";
  const reason = firstEventData?.reason || "";
  const blockedAt = firstEventData?.blockedAt || "";

  if (!functionAttempts || functionAttempts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-muted-foreground px-2 py-1">
        Function Attempts ({functionAttempts.length})
      </div>
      {functionAttempts.map((functionName, index) => (
        <FunctionAttemptPart
          key={`${functionName}-${index}`}
          functionName={functionName}
          index={index}
          severity={severity}
          decision={decision}
          reason={reason}
          blockedAt={blockedAt}
          presetKey={presetKey}
          eventData={firstEventData}
        />
      ))}
    </div>
  );
};

export const HipocapFunctionAttemptsParts = memo(PureHipocapFunctionAttemptsParts);

