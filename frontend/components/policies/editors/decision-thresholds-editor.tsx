"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

import { Policy, updatePolicy } from "@/lib/actions/policies";
import { useToast } from "@/lib/hooks/use-toast";
import { useAutoSave } from "@/lib/hooks/use-auto-save";

import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import { Alert, AlertDescription } from "../../ui/alert";
import { AlertCircle } from "lucide-react";

interface DecisionThresholdsEditorProps {
  policy: Policy;
  decisionThresholds: Record<string, any>;
  onChange: (decisionThresholds: Record<string, any>) => void;
}

export default function DecisionThresholdsEditor({
  policy,
  decisionThresholds,
  onChange,
}: DecisionThresholdsEditorProps) {
  const { projectId } = useParams();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    block_threshold: 0.7,
    allow_threshold: 0.3,
    use_severity_fallback: true,
  });

  // Initialize form data from decisionThresholds
  useEffect(() => {
    if (decisionThresholds) {
      setFormData({
        block_threshold: decisionThresholds.block_threshold ?? 0.7,
        allow_threshold: decisionThresholds.allow_threshold ?? 0.3,
        use_severity_fallback: decisionThresholds.use_severity_fallback ?? true,
      });
    }
  }, [decisionThresholds]);

  // Use refs to ensure we always use the latest values in the save callback
  const policyIdRef = useRef(policy.id);
  const projectIdRef = useRef(projectId as string);
  const onChangeRef = useRef(onChange);
  
  useEffect(() => {
    policyIdRef.current = policy.id;
    projectIdRef.current = projectId as string;
    onChangeRef.current = onChange;
  }, [policy.id, projectId, onChange]);

  // Memoize the save callback to prevent recreating it on every render
  const handleAutoSave = useCallback(
    async (updatedData: typeof formData) => {
      try {
        await updatePolicy(projectIdRef.current, policyIdRef.current, {
          decision_thresholds: updatedData,
        });
        onChangeRef.current(updatedData);
        toast({
          title: "Decision thresholds saved",
          description: "Changes have been automatically saved.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save decision thresholds",
          variant: "destructive",
        });
        throw error;
      }
    },
    [] // Empty deps - we use refs for latest values
  );

  // Auto-save when decision thresholds change
  const { isSaving } = useAutoSave(formData, {
    delay: 1000,
    enabled: true,
    onSave: handleAutoSave,
  });

  const handleChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
  };

  const validationError =
    formData.block_threshold <= formData.allow_threshold
      ? "Block threshold must be greater than allow threshold"
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Decision Thresholds</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Configure score thresholds for ALLOW/BLOCK decisions. Scores range from 0.0 (safe) to 1.0 (unsafe).
          </p>
        </div>
        {isSaving && (
          <Badge variant="secondary" className="text-xs">
            Saving...
          </Badge>
        )}
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Threshold Configuration</CardTitle>
          <CardDescription className="leading-relaxed">
            Set the score thresholds that determine when to ALLOW or BLOCK function calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="block-threshold">Block Threshold *</Label>
            <Input
              id="block-threshold"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.block_threshold}
              onChange={(e) => handleChange("block_threshold", parseFloat(e.target.value) || 0)}
              className={validationError ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Scores at or above this threshold will be BLOCKED (0.0 - 1.0). Default: 0.7
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="allow-threshold">Allow Threshold *</Label>
            <Input
              id="allow-threshold"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.allow_threshold}
              onChange={(e) => handleChange("allow_threshold", parseFloat(e.target.value) || 0)}
              className={validationError ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Scores below this threshold will be ALLOWED (0.0 - 1.0). Default: 0.3
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-severity-fallback"
                checked={formData.use_severity_fallback}
                onCheckedChange={(checked) =>
                  handleChange("use_severity_fallback", checked as boolean)
                }
              />
              <Label htmlFor="use-severity-fallback" className="text-sm font-normal cursor-pointer">
                Use Severity Fallback
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
              When enabled, if a score falls between the allow and block thresholds, severity rules will be used to determine the decision.
            </p>
          </div>

          <div className="pt-6 border-t">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Decision Logic</Label>
              <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  • Score ≥ {formData.block_threshold.toFixed(2)} → <strong>BLOCKED</strong>
                </p>
                <p>
                  • Score &lt; {formData.allow_threshold.toFixed(2)} → <strong>ALLOWED</strong>
                </p>
                {formData.use_severity_fallback && (
                  <p>
                    • {formData.allow_threshold.toFixed(2)} ≤ Score &lt; {formData.block_threshold.toFixed(2)} →{" "}
                    <strong>Use Severity Rules</strong>
                  </p>
                )}
                {!formData.use_severity_fallback && (
                  <p>
                    • {formData.allow_threshold.toFixed(2)} ≤ Score &lt; {formData.block_threshold.toFixed(2)} →{" "}
                    <strong>BLOCKED</strong> (default)
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

