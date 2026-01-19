"use client";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Mono from "@/components/ui/mono";
import { HipocapTrace } from "@/lib/hipocap/types";
import { TIME_SECONDS_FORMAT } from "@/lib/utils";

interface TraceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trace: HipocapTrace | null;
}

export default function TraceDetailModal({ open, onOpenChange, trace }: TraceDetailModalProps) {
  if (!trace) return null;

  const isBlocked = trace.final_decision === "BLOCKED";
  const isAllowed = trace.final_decision === "ALLOWED";
  const isReview = trace.final_decision === "REVIEW_REQUIRED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Function Trace Details
            <Badge
              variant="outline"
              className={
                isBlocked
                  ? "text-red-600 border-red-600 bg-red-50"
                  : isAllowed
                  ? "text-green-600 border-green-600 bg-green-50"
                  : isReview
                  ? "text-yellow-600 border-yellow-600 bg-yellow-50"
                  : ""
              }
            >
              {trace.final_decision}
            </Badge>
          </DialogTitle>
          <DialogDescription>Complete information about this function analysis trace</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-2 min-h-0">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Trace ID</label>
                <p className="text-sm font-mono">{trace.id}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Function Name</label>
                <p className="text-sm font-mono">{trace.function_name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Created At</label>
                <p className="text-sm">
                  <ClientTimestampFormatter timestamp={trace.created_at} format={TIME_SECONDS_FORMAT} />
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Updated At</label>
                <p className="text-sm">
                  {trace.updated_at ? (
                    <ClientTimestampFormatter timestamp={trace.updated_at} format={TIME_SECONDS_FORMAT} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Decision Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Decision Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Final Decision</label>
                <p className="text-sm font-medium">{trace.final_decision}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Safe to Use</label>
                <p className="text-sm">{trace.safe_to_use ? "Yes" : "No"}</p>
              </div>
              {trace.blocked_at && (
                <div>
                  <label className="text-xs text-muted-foreground">Blocked At</label>
                  <p className="text-sm">{trace.blocked_at}</p>
                </div>
              )}
              {trace.reason && (
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Reason</label>
                  <p className="text-sm whitespace-pre-wrap">{trace.reason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Request Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Request Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trace.user_query && (
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">User Query</label>
                  <p className="text-sm whitespace-pre-wrap">{trace.user_query}</p>
                </div>
              )}
              {trace.user_role && (
                <div>
                  <label className="text-xs text-muted-foreground">User Role</label>
                  <p className="text-sm">{trace.user_role}</p>
                </div>
              )}
              {trace.target_function && (
                <div>
                  <label className="text-xs text-muted-foreground">Target Function</label>
                  <p className="text-sm font-mono">{trace.target_function}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Require Quarantine</label>
                <p className="text-sm">{trace.require_quarantine ? "Yes" : "No"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Quick Analysis</label>
                <p className="text-sm">{trace.quick_analysis ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>

          {/* Scores */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Risk Scores</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {trace.input_score !== null && trace.input_score !== undefined && (
                <div>
                  <label className="text-xs text-muted-foreground">Input Score</label>
                  <p className="text-sm font-mono">{(trace.input_score * 100).toFixed(1)}%</p>
                </div>
              )}
              {trace.quarantine_score !== null && trace.quarantine_score !== undefined && (
                <div>
                  <label className="text-xs text-muted-foreground">Quarantine Score</label>
                  <p className="text-sm font-mono">{(trace.quarantine_score * 100).toFixed(1)}%</p>
                </div>
              )}
              {trace.llm_score !== null && trace.llm_score !== undefined && (
                <div>
                  <label className="text-xs text-muted-foreground">LLM Score</label>
                  <p className="text-sm font-mono">{(trace.llm_score * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Policy Information */}
          {trace.policy_key && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Policy Information</h3>
              <div>
                <label className="text-xs text-muted-foreground">Policy Key</label>
                <p className="text-sm font-mono">{trace.policy_key}</p>
              </div>
            </div>
          )}

          {/* Review Information */}
          {trace.review_required && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Review Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Review Status</label>
                  <p className="text-sm">{trace.review_status}</p>
                </div>
                {trace.reviewed_by && (
                  <div>
                    <label className="text-xs text-muted-foreground">Reviewed By</label>
                    <p className="text-sm font-mono">{trace.reviewed_by}</p>
                  </div>
                )}
                {trace.reviewed_at && (
                  <div>
                    <label className="text-xs text-muted-foreground">Reviewed At</label>
                    <p className="text-sm">
                      <ClientTimestampFormatter timestamp={trace.reviewed_at} format={TIME_SECONDS_FORMAT} />
                    </p>
                  </div>
                )}
                {trace.hitl_reason && (
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">HITL Reason</label>
                    <p className="text-sm whitespace-pre-wrap">{trace.hitl_reason}</p>
                  </div>
                )}
                {trace.review_notes && (
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Review Notes</label>
                    <p className="text-sm whitespace-pre-wrap">{trace.review_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analysis Response */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Full Analysis Response</h3>
            <div className="rounded-md border bg-muted p-4 max-h-[400px] overflow-auto overflow-x-auto">
              <pre className="text-xs whitespace-pre-wrap break-words">
                <Mono>{JSON.stringify(trace.analysis_response, null, 2)}</Mono>
              </pre>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Metadata</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">User ID</label>
                <p className="text-sm font-mono">{trace.user_id}</p>
              </div>
              {trace.ip_address && (
                <div>
                  <label className="text-xs text-muted-foreground">IP Address</label>
                  <p className="text-sm font-mono">{trace.ip_address}</p>
                </div>
              )}
              {trace.user_agent && (
                <div>
                  <label className="text-xs text-muted-foreground">User Agent</label>
                  <p className="text-sm text-xs truncate">{trace.user_agent}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

