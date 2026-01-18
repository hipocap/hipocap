"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Edit, Save } from "lucide-react";
import { useParams } from "next/navigation";

import { Policy, updatePolicy } from "@/lib/actions/policies";
import { useToast } from "@/lib/hooks/use-toast";
import { useAutoSave } from "@/lib/hooks/use-auto-save";

import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";

interface SeverityRulesEditorProps {
  policy: Policy;
  severityRules: Record<string, any>;
  onChange: (severityRules: Record<string, any>) => void;
}

const SEVERITY_LEVELS = ["safe", "low", "medium", "high", "critical"];

export default function SeverityRulesEditor({
  policy,
  severityRules,
  onChange,
}: SeverityRulesEditorProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [editingSeverity, setEditingSeverity] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Local state for severity rules - syncs with props but used for auto-save
  const [localSeverityRules, setLocalSeverityRules] = useState<Record<string, any>>(severityRules);
  
  // Sync local state with props when props change
  useEffect(() => {
    setLocalSeverityRules(severityRules);
  }, [severityRules]);

  const [formData, setFormData] = useState({
    allow_function_calls: true,
    allow_output_use: true,
    block: false,
  });

  // Use refs to ensure we always use the latest values in the save callback
  const policyIdRef = useRef(policy.id);
  const projectIdRef = useRef(projectId as string);
  
  useEffect(() => {
    policyIdRef.current = policy.id;
    projectIdRef.current = projectId as string;
  }, [policy.id, projectId]);

  // Memoize the save callback to prevent recreating it on every render
  const handleAutoSave = useCallback(
    async (updatedRules: typeof localSeverityRules) => {
      try {
        await updatePolicy(projectIdRef.current, policyIdRef.current, { severity_rules: updatedRules });
        toast({
          title: "Severity rules saved",
          description: "Changes have been automatically saved.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save severity rules",
          variant: "destructive",
        });
        throw error;
      }
    },
    [] // Empty deps - we use refs for latest values
  );

  // Auto-save when local severity rules change
  const { isSaving } = useAutoSave(localSeverityRules, {
    delay: 1000,
    enabled: true,
    onSave: handleAutoSave,
  });

  const handleEditSeverity = (severity: string) => {
    const rule = localSeverityRules[severity] || {
      allow_function_calls: true,
      allow_output_use: true,
      block: false,
    };
    setFormData({
      allow_function_calls: rule.allow_function_calls ?? true,
      allow_output_use: rule.allow_output_use ?? true,
      block: rule.block ?? false,
    });
    setEditingSeverity(severity);
    setIsDialogOpen(true);
  };

  const handleSaveSeverity = async () => {
    if (!editingSeverity) return;

    const updatedRules = { ...localSeverityRules };
    updatedRules[editingSeverity] = {
      allow_function_calls: formData.allow_function_calls,
      allow_output_use: formData.allow_output_use,
      block: formData.block,
    };

    // Update local state first, then notify parent
    setLocalSeverityRules(updatedRules);
    onChange(updatedRules);
    setIsDialogOpen(false);
    setEditingSeverity(null);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "safe":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "high":
        return "bg-[#49db7e]/10 text-[#49db7e] dark:bg-[#49db7e]/20 dark:text-[#49db7e]";
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Severity Rules</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Define rules for each severity level (safe, low, medium, high, critical).
          </p>
        </div>
        {isSaving && (
          <Badge variant="secondary" className="text-xs">
            Saving...
          </Badge>
        )}
      </div>

      <div className="grid gap-4">
        {SEVERITY_LEVELS.map((severity) => {
          const rule = localSeverityRules[severity] || {
            allow_function_calls: true,
            allow_output_use: true,
            block: false,
          };

          return (
            <Card key={severity}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base capitalize flex items-center gap-2">
                      <Badge className={getSeverityColor(severity)}>{severity}</Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Configure rules for {severity} severity level
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditSeverity(severity)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={rule.allow_function_calls ?? true} disabled />
                    <Label className="text-sm font-normal">
                      Allow function calls: {rule.allow_function_calls ? "Yes" : "No"}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={rule.allow_output_use ?? true} disabled />
                    <Label className="text-sm font-normal">
                      Allow output use: {rule.allow_output_use ? "Yes" : "No"}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={rule.block ?? false} disabled />
                    <Label className="text-sm font-normal">
                      Block: {rule.block ? "Yes" : "No"}
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Severity Rule: {editingSeverity}</DialogTitle>
            <DialogDescription>
              Configure the rules for the {editingSeverity} severity level
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-function-calls"
                checked={formData.allow_function_calls}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allow_function_calls: checked as boolean })
                }
              />
              <Label htmlFor="allow-function-calls" className="text-sm font-normal cursor-pointer">
                Allow function calls
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-output-use"
                checked={formData.allow_output_use}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allow_output_use: checked as boolean })
                }
              />
              <Label htmlFor="allow-output-use" className="text-sm font-normal cursor-pointer">
                Allow output use
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="block"
                checked={formData.block}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, block: checked as boolean })
                }
              />
              <Label htmlFor="block" className="text-sm font-normal cursor-pointer">
                Block (force block regardless of other settings)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSeverity}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

