"use client";

import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Copy, Shield, ShieldAlert, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { HipocapAnalysisResponse } from "@/lib/hipocap/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AnalysisResultsProps {
  result: HipocapAnalysisResponse;
}

export function AnalysisResults({ result }: AnalysisResultsProps) {
  const { toast } = useToast();
  const [inputAnalysisOpen, setInputAnalysisOpen] = useState(true);
  const [llmAnalysisOpen, setLlmAnalysisOpen] = useState(false);
  const [quarantineAnalysisOpen, setQuarantineAnalysisOpen] = useState(false);

  const {
    final_decision,
    final_score,
    safe_to_use,
    blocked_at,
    reason,
    input_analysis,
    llm_analysis,
    quarantine_analysis,
    keyword_detection,
    rbac_blocked,
    chaining_blocked,
    severity_rule,
    output_restriction,
    context_rule,
    warning,
    function_chaining_info,
  } = result;

  // Get decision badge info
  const getDecisionInfo = () => {
    const decisionLower = (final_decision || "").toLowerCase();
    if (decisionLower === "allowed" || decisionLower === "approved") {
      return {
        icon: CheckCircle2,
        color: "text-green-600",
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/50",
        label: final_decision || "ALLOWED",
      };
    }
    if (decisionLower === "blocked" || decisionLower === "denied") {
      return {
        icon: XCircle,
        color: "text-red-600",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/50",
        label: final_decision || "BLOCKED",
      };
    }
    if (decisionLower === "review_required" || decisionLower === "review") {
      return {
        icon: AlertCircle,
        color: "text-amber-600",
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/50",
        label: final_decision || "REVIEW REQUIRED",
      };
    }
    return {
      icon: ShieldAlert,
      color: "text-blue-600",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/50",
      label: final_decision || "UNKNOWN",
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
  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return "bg-gray-500";
    if (score >= 0.7) return "bg-red-600";
    if (score >= 0.4) return "bg-amber-600";
    if (score >= 0.1) return "bg-amber-500";
    return "bg-green-600";
  };

  const decisionInfo = getDecisionInfo();
  const DecisionIcon = decisionInfo.icon;

  // Format score as percentage
  const formatScore = (score: number | null | undefined) => {
    if (score === null || score === undefined) return "N/A";
    return `${(score * 100).toFixed(2)}%`;
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast({
      title: "Copied",
      description: "Analysis results copied to clipboard",
    });
  };

  return (
    <div className="space-y-4">
      {/* Main Result Card */}
      <Card className="border-l-4" style={{ borderLeftColor: decisionInfo.color.replace("text-", "") }}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Shield className="h-5 w-5 text-primary flex-shrink-0" />
              <CardTitle className="text-lg font-semibold">Analysis Results</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", decisionInfo.bgColor, decisionInfo.borderColor, decisionInfo.color)}
              >
                <DecisionIcon className="h-3 w-3 mr-1" />
                {decisionInfo.label}
              </Badge>
              {safe_to_use !== null && safe_to_use !== undefined && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    safe_to_use ? "bg-green-500/20 text-green-600 border-green-500/50" : "bg-red-500/20 text-red-600 border-red-500/50"
                  )}
                >
                  {safe_to_use ? "Safe" : "Unsafe"}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleCopyResult}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary Section */}
          <div className="space-y-2">
            {final_score !== null && final_score !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="font-medium">{formatScore(final_score)}</span>
                </div>
                <Progress value={final_score * 100} className="h-2" />
              </div>
            )}
            {blocked_at && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Blocked At:</span>
                <span className="text-sm font-medium">{blocked_at}</span>
              </div>
            )}
            {reason && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Reason:</span>
                <p className="text-sm text-foreground leading-relaxed">{reason}</p>
              </div>
            )}
            {warning && (
              <div className="rounded-md bg-amber-500/20 border border-amber-500/50 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Warning</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{warning}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Additional Status Badges */}
          {(rbac_blocked || chaining_blocked) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {rbac_blocked && (
                  <Badge variant="destructive" className="text-xs">
                    RBAC Blocked
                  </Badge>
                )}
                {chaining_blocked && (
                  <Badge variant="destructive" className="text-xs">
                    Function Chaining Blocked
                  </Badge>
                )}
              </div>
            </>
          )}

          {/* Keyword Detection */}
          {keyword_detection && keyword_detection.detected && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Keyword Detection:</span>
                  <Badge variant="destructive" className="text-xs">
                    Detected
                  </Badge>
                </div>
                {keyword_detection.keywords && keyword_detection.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {keyword_detection.keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Input Analysis Section */}
      {input_analysis && (
        <Card>
          <CardHeader>
            <Collapsible open={inputAnalysisOpen} onOpenChange={setInputAnalysisOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-md p-2 -mx-2">
                <div className="flex items-center gap-2">
                  {inputAnalysisOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">Input Analysis</CardTitle>
                  {input_analysis.decision && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        input_analysis.decision === "PASS"
                          ? "bg-green-500/20 text-green-600 border-green-500/50"
                          : "bg-red-500/20 text-red-600 border-red-500/50"
                      )}
                    >
                      {input_analysis.decision}
                    </Badge>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="space-y-2 text-sm">
                  {input_analysis.phase && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Phase:</span>
                      <span className="font-medium">{input_analysis.phase}</span>
                    </div>
                  )}
                  {input_analysis.score !== undefined && input_analysis.score !== null && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Score:</span>
                        <span className="font-medium">{formatScore(input_analysis.score)}</span>
                      </div>
                      <Progress value={(input_analysis.score || 0) * 100} className="h-1.5" />
                    </div>
                  )}
                  {input_analysis.combined_severity && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Severity:</span>
                      <Badge className={cn("text-xs", getSeverityColor(input_analysis.combined_severity))}>
                        {input_analysis.combined_severity.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                  {input_analysis.recommendation && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Recommendation:</span>
                      <p className="text-foreground leading-relaxed">{input_analysis.recommendation}</p>
                    </div>
                  )}
                  {input_analysis.analysis && (
                    <div className="space-y-2 pt-2 border-t">
                      {input_analysis.analysis.name_analysis && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Function Name:</span>
                          <div className="pl-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Score:</span>
                              <span className="text-xs">{formatScore(input_analysis.analysis.name_analysis.score)}</span>
                              {input_analysis.analysis.name_analysis.severity && (
                                <Badge className={cn("text-xs", getSeverityColor(input_analysis.analysis.name_analysis.severity))}>
                                  {input_analysis.analysis.name_analysis.severity.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {input_analysis.analysis.args_analysis && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Arguments:</span>
                          <div className="pl-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Score:</span>
                              <span className="text-xs">{formatScore(input_analysis.analysis.args_analysis.score)}</span>
                              {input_analysis.analysis.args_analysis.severity && (
                                <Badge className={cn("text-xs", getSeverityColor(input_analysis.analysis.args_analysis.severity))}>
                                  {input_analysis.analysis.args_analysis.severity.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            {input_analysis.analysis.args_analysis.result_preview && (
                              <div className="text-xs text-muted-foreground font-mono bg-muted p-1.5 rounded mt-1 overflow-x-auto">
                                {input_analysis.analysis.args_analysis.result_preview}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {input_analysis.analysis.result_analysis && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Result:</span>
                          <div className="pl-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Score:</span>
                              <span className="text-xs">{formatScore(input_analysis.analysis.result_analysis.score)}</span>
                              {input_analysis.analysis.result_analysis.severity && (
                                <Badge className={cn("text-xs", getSeverityColor(input_analysis.analysis.result_analysis.severity))}>
                                  {input_analysis.analysis.result_analysis.severity.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            {input_analysis.analysis.result_analysis.result_preview && (
                              <div className="text-xs text-muted-foreground font-mono bg-muted p-1.5 rounded mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                                {input_analysis.analysis.result_analysis.result_preview}
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
          </CardHeader>
        </Card>
      )}

      {/* LLM Analysis Section */}
      {llm_analysis && (
        <Card>
          <CardHeader>
            <Collapsible open={llmAnalysisOpen} onOpenChange={setLlmAnalysisOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-md p-2 -mx-2">
                <div className="flex items-center gap-2">
                  {llmAnalysisOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">LLM Analysis</CardTitle>
                  {llm_analysis.decision && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        llm_analysis.decision === "ALLOW"
                          ? "bg-green-500/20 text-green-600 border-green-500/50"
                          : "bg-red-500/20 text-red-600 border-red-500/50"
                      )}
                    >
                      {llm_analysis.decision}
                    </Badge>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="space-y-2 text-sm">
                  {llm_analysis.phase && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Phase:</span>
                      <span className="font-medium">{llm_analysis.phase}</span>
                    </div>
                  )}
                  {llm_analysis.score !== undefined && llm_analysis.score !== null && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Score:</span>
                        <span className="font-medium">{formatScore(llm_analysis.score)}</span>
                      </div>
                      <Progress value={(llm_analysis.score || 0) * 100} className="h-1.5" />
                    </div>
                  )}
                  {llm_analysis.severity && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Severity:</span>
                      <Badge className={cn("text-xs", getSeverityColor(llm_analysis.severity))}>
                        {llm_analysis.severity.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                  {llm_analysis.summary && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Summary:</span>
                      <p className="text-foreground leading-relaxed">{llm_analysis.summary}</p>
                    </div>
                  )}
                  {llm_analysis.details && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Details:</span>
                      <p className="text-foreground leading-relaxed">{llm_analysis.details}</p>
                    </div>
                  )}
                  {llm_analysis.reason && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium">Reason:</span>
                      <p className="text-foreground leading-relaxed">{llm_analysis.reason}</p>
                    </div>
                  )}
                  {(Array.isArray(llm_analysis.threats_found) && llm_analysis.threats_found.length > 0 ||
                    Array.isArray(llm_analysis.threat_indicators) && llm_analysis.threat_indicators.length > 0 ||
                    Array.isArray(llm_analysis.detected_patterns) && llm_analysis.detected_patterns.length > 0 ||
                    Array.isArray(llm_analysis.function_call_attempts) && llm_analysis.function_call_attempts.length > 0 ||
                    Array.isArray(llm_analysis.policy_violations) && llm_analysis.policy_violations.length > 0) && (
                    <div className="space-y-2 pt-2 border-t">
                      {llm_analysis.threats_found && llm_analysis.threats_found.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Threats Found:</span>
                          <div className="flex flex-wrap gap-1">
                            {llm_analysis.threats_found.map((threat, idx) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                {threat}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llm_analysis.threat_indicators && llm_analysis.threat_indicators.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Threat Indicators:</span>
                          <div className="flex flex-wrap gap-1">
                            {llm_analysis.threat_indicators.map((indicator, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                                {indicator}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llm_analysis.detected_patterns && llm_analysis.detected_patterns.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Detected Patterns:</span>
                          <div className="flex flex-wrap gap-1">
                            {llm_analysis.detected_patterns.map((pattern, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                                {pattern}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llm_analysis.function_call_attempts && llm_analysis.function_call_attempts.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Function Call Attempts:</span>
                          <div className="flex flex-wrap gap-1">
                            {llm_analysis.function_call_attempts.map((func, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                                {func}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {llm_analysis.policy_violations && llm_analysis.policy_violations.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">Policy Violations:</span>
                          <div className="flex flex-wrap gap-1">
                            {llm_analysis.policy_violations.map((violation, idx) => (
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
          </CardHeader>
        </Card>
      )}

      {/* Quarantine Analysis Section */}
      {quarantine_analysis && (
        <Card>
          <CardHeader>
            <Collapsible open={quarantineAnalysisOpen} onOpenChange={setQuarantineAnalysisOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-md p-2 -mx-2">
                <div className="flex items-center gap-2">
                  {quarantineAnalysisOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">Quarantine Analysis</CardTitle>
                  {quarantine_analysis.decision && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        quarantine_analysis.decision === "PASS" || quarantine_analysis.decision === "ALLOW"
                          ? "bg-green-500/20 text-green-600 border-green-500/50"
                          : "bg-red-500/20 text-red-600 border-red-500/50"
                      )}
                    >
                      {quarantine_analysis.decision}
                    </Badge>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="space-y-2 text-sm">
                  {quarantine_analysis.phase && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Phase:</span>
                      <span className="font-medium">{quarantine_analysis.phase}</span>
                    </div>
                  )}
                  {quarantine_analysis.score !== undefined && quarantine_analysis.score !== null && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Score:</span>
                        <span className="font-medium">{formatScore(quarantine_analysis.score)}</span>
                      </div>
                      <Progress value={(quarantine_analysis.score || 0) * 100} className="h-1.5" />
                    </div>
                  )}
                  {quarantine_analysis.severity && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Severity:</span>
                      <Badge className={cn("text-xs", getSeverityColor(quarantine_analysis.severity))}>
                        {quarantine_analysis.severity.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                  {quarantine_analysis.recommendation && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Recommendation:</span>
                      <p className="text-foreground leading-relaxed">{quarantine_analysis.recommendation}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
        </Card>
      )}

      {/* Additional Rules and Info */}
      {(severity_rule || output_restriction || context_rule || function_chaining_info) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {severity_rule && (
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Severity Rule:</span>
                <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(severity_rule, null, 2)}
                </pre>
              </div>
            )}
            {output_restriction && (
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Output Restriction:</span>
                <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(output_restriction, null, 2)}
                </pre>
              </div>
            )}
            {context_rule && (
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Context Rule:</span>
                <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(context_rule, null, 2)}
                </pre>
              </div>
            )}
            {function_chaining_info && (
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Function Chaining Info:</span>
                <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(function_chaining_info, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}



