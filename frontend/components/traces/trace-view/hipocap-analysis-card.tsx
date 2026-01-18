"use client";

import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Shield, ShieldAlert, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { extractHipocapAnalysis } from "@/components/traces/trace-view/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface HipocapAnalysisCardProps {
  span: { attributes: Record<string, any> };
}

export function HipocapAnalysisCard({ span }: HipocapAnalysisCardProps) {
  const analysis = useMemo(() => extractHipocapAnalysis(span), [span]);
  const [inputAnalysisOpen, setInputAnalysisOpen] = useState(false);
  const [llmAnalysisOpen, setLlmAnalysisOpen] = useState(false);

  if (!analysis) return null;

  const { functionName, finalDecision, safeToUse, reason, finalScore, blockedAt, severity, inputAnalysis, llmAnalysis } = analysis;

  // Get decision badge info
  const getDecisionInfo = () => {
    const decisionLower = (finalDecision || "").toLowerCase();
    if (decisionLower === "allowed" || decisionLower === "approved") {
      return {
        icon: CheckCircle2,
        color: "text-green-600",
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/50",
        label: finalDecision || "ALLOWED",
      };
    }
    if (decisionLower === "blocked" || decisionLower === "denied") {
      return {
        icon: XCircle,
        color: "text-red-600",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/50",
        label: finalDecision || "BLOCKED",
      };
    }
    if (decisionLower === "review_required" || decisionLower === "review") {
      return {
        icon: AlertCircle,
        color: "text-amber-600",
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/50",
        label: finalDecision || "REVIEW REQUIRED",
      };
    }
    return {
      icon: ShieldAlert,
      color: "text-blue-600",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/50",
      label: finalDecision || "UNKNOWN",
    };
  };

  // Get severity badge color
  const getSeverityColor = (severityValue?: string) => {
    if (!severityValue) return "bg-gray-500 text-white";
    const severityLower = severityValue.toLowerCase();
    switch (severityLower) {
      case "critical":
        return "bg-red-700 text-white";
      case "high":
        return "bg-red-600 text-white";
      case "medium":
        return "bg-amber-600 text-white";
      case "low":
        return "bg-amber-500 text-white";
      case "safe":
        return "bg-green-600 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  // Get score color based on value
  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-gray-500";
    if (score >= 0.7) return "bg-red-600";
    if (score >= 0.4) return "bg-amber-600";
    if (score >= 0.1) return "bg-amber-500";
    return "bg-green-600";
  };

  const decisionInfo = getDecisionInfo();
  const DecisionIcon = decisionInfo.icon;

  // Format score as percentage
  const formatScore = (score: number | null) => {
    if (score === null) return "N/A";
    return `${(score * 100).toFixed(2)}%`;
  };

  return (
    <Card className="mb-2 border-l-4" style={{ borderLeftColor: decisionInfo.color.replace("text-", "") }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Shield className="h-5 w-5 text-primary flex-shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">
              {functionName || "Hipocap Analysis"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              variant="outline"
              className={cn("text-xs font-medium", decisionInfo.bgColor, decisionInfo.borderColor, decisionInfo.color)}
            >
              <DecisionIcon className="h-3 w-3 mr-1" />
              {decisionInfo.label}
            </Badge>
            {safeToUse !== null && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  safeToUse ? "bg-green-500/20 text-green-600 border-green-500/50" : "bg-red-500/20 text-red-600 border-red-500/50"
                )}
              >
                {safeToUse ? "Safe" : "Unsafe"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Summary Section */}
        <div className="space-y-2">
          {finalScore !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Risk Score</span>
                <span className="font-medium">{formatScore(finalScore)}</span>
              </div>
              <Progress value={finalScore * 100} className="h-2" />
            </div>
          )}
          {severity && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Severity:</span>
              <Badge className={cn("text-xs", getSeverityColor(severity))}>
                {severity.toUpperCase()}
              </Badge>
            </div>
          )}
          {blockedAt && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Blocked At:</span>
              <span className="text-xs font-medium">{blockedAt}</span>
            </div>
          )}
          {reason && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Reason:</span>
              <p className="text-xs text-foreground leading-relaxed">{reason}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Input Analysis Section */}
        {inputAnalysis && (
          <Collapsible open={inputAnalysisOpen} onOpenChange={setInputAnalysisOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-md p-2 -mx-2">
              <div className="flex items-center gap-2">
                {inputAnalysisOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold">Input Analysis</span>
                {inputAnalysis.decision && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      inputAnalysis.decision === "PASS"
                        ? "bg-green-500/20 text-green-600 border-green-500/50"
                        : "bg-red-500/20 text-red-600 border-red-500/50"
                    )}
                  >
                    {inputAnalysis.decision}
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              <div className="space-y-2 text-xs">
                {inputAnalysis.phase && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Phase:</span>
                    <span className="font-medium">{inputAnalysis.phase}</span>
                  </div>
                )}
                {inputAnalysis.score !== undefined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Score:</span>
                      <span className="font-medium">{formatScore(inputAnalysis.score)}</span>
                    </div>
                    <Progress value={(inputAnalysis.score || 0) * 100} className="h-1.5" />
                  </div>
                )}
                {inputAnalysis.combined_severity && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Severity:</span>
                    <Badge className={cn("text-xs", getSeverityColor(inputAnalysis.combined_severity))}>
                      {inputAnalysis.combined_severity.toUpperCase()}
                    </Badge>
                  </div>
                )}
                {inputAnalysis.recommendation && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Recommendation:</span>
                    <p className="text-foreground leading-relaxed">{inputAnalysis.recommendation}</p>
                  </div>
                )}
                {inputAnalysis.analysis && (
                  <div className="space-y-2 pt-2 border-t">
                    {inputAnalysis.analysis.name_analysis && (
                      <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Function Name:</span>
                        <div className="pl-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Score:</span>
                            <span className="text-xs">{formatScore(inputAnalysis.analysis.name_analysis.score)}</span>
                            <Badge className={cn("text-xs", getSeverityColor(inputAnalysis.analysis.name_analysis.severity))}>
                              {inputAnalysis.analysis.name_analysis.severity?.toUpperCase() || "N/A"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                    {inputAnalysis.analysis.args_analysis && (
                      <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Arguments:</span>
                        <div className="pl-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Score:</span>
                            <span className="text-xs">{formatScore(inputAnalysis.analysis.args_analysis.score)}</span>
                            <Badge className={cn("text-xs", getSeverityColor(inputAnalysis.analysis.args_analysis.severity))}>
                              {inputAnalysis.analysis.args_analysis.severity?.toUpperCase() || "N/A"}
                            </Badge>
                          </div>
                          {inputAnalysis.analysis.args_analysis.result_preview && (
                            <div className="text-xs text-muted-foreground font-mono bg-muted p-1.5 rounded mt-1 overflow-x-auto">
                              {inputAnalysis.analysis.args_analysis.result_preview}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {inputAnalysis.analysis.result_analysis && (
                      <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Result:</span>
                        <div className="pl-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Score:</span>
                            <span className="text-xs">{formatScore(inputAnalysis.analysis.result_analysis.score)}</span>
                            <Badge className={cn("text-xs", getSeverityColor(inputAnalysis.analysis.result_analysis.severity))}>
                              {inputAnalysis.analysis.result_analysis.severity?.toUpperCase() || "N/A"}
                            </Badge>
                          </div>
                          {inputAnalysis.analysis.result_analysis.result_preview && (
                            <div className="text-xs text-muted-foreground font-mono bg-muted p-1.5 rounded mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                              {inputAnalysis.analysis.result_analysis.result_preview}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* LLM Analysis Section */}
        {llmAnalysis && (
          <>
            {inputAnalysis && <Separator />}
            <Collapsible open={llmAnalysisOpen} onOpenChange={setLlmAnalysisOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-md p-2 -mx-2">
                <div className="flex items-center gap-2">
                  {llmAnalysisOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-semibold">LLM Analysis</span>
                  {llmAnalysis.decision && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        llmAnalysis.decision === "ALLOW"
                          ? "bg-green-500/20 text-green-600 border-green-500/50"
                          : "bg-red-500/20 text-red-600 border-red-500/50"
                      )}
                    >
                      {llmAnalysis.decision}
                    </Badge>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="space-y-2 text-xs">
                  {llmAnalysis.phase && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Phase:</span>
                      <span className="font-medium">{llmAnalysis.phase}</span>
                    </div>
                  )}
                  {llmAnalysis.score !== undefined && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Score:</span>
                        <span className="font-medium">{formatScore(llmAnalysis.score)}</span>
                      </div>
                      <Progress value={(llmAnalysis.score || 0) * 100} className="h-1.5" />
                    </div>
                  )}
                  {llmAnalysis.severity && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Severity:</span>
                      <Badge className={cn("text-xs", getSeverityColor(llmAnalysis.severity))}>
                        {llmAnalysis.severity.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                  {llmAnalysis.summary && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Summary:</span>
                      <p className="text-foreground leading-relaxed">{llmAnalysis.summary}</p>
                    </div>
                  )}
                  {llmAnalysis.details && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Details:</span>
                      <p className="text-foreground leading-relaxed">{llmAnalysis.details}</p>
                    </div>
                  )}
                  {llmAnalysis.reason && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Reason:</span>
                      <p className="text-foreground leading-relaxed">{llmAnalysis.reason}</p>
                    </div>
                  )}
                  {(llmAnalysis.threats_found?.length > 0 ||
                    llmAnalysis.threat_indicators?.length > 0 ||
                    llmAnalysis.detected_patterns?.length > 0 ||
                    llmAnalysis.function_call_attempts?.length > 0 ||
                    llmAnalysis.policy_violations?.length > 0) && (
                    <div className="space-y-2 pt-2 border-t">
                      {llmAnalysis.threats_found?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Threats Found:</span>
                          <div className="flex flex-wrap gap-1">
                            {llmAnalysis.threats_found.map((threat: string, idx: number) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                {threat}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llmAnalysis.threat_indicators?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Threat Indicators:</span>
                          <div className="flex flex-wrap gap-1">
                            {llmAnalysis.threat_indicators.map((indicator: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                                {indicator}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llmAnalysis.detected_patterns?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Detected Patterns:</span>
                          <div className="flex flex-wrap gap-1">
                            {llmAnalysis.detected_patterns.map((pattern: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                                {pattern}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llmAnalysis.function_call_attempts?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Function Call Attempts:</span>
                          <div className="flex flex-wrap gap-1">
                            {llmAnalysis.function_call_attempts.map((func: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                                {func}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llmAnalysis.policy_violations?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Policy Violations:</span>
                          <div className="flex flex-wrap gap-1">
                            {llmAnalysis.policy_violations.map((violation: string, idx: number) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                {violation}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

