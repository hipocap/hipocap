"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import { useParams } from "next/navigation";

import { Policy, updatePolicy, deleteContextRule } from "@/lib/actions/policies";
import { useToast } from "@/lib/hooks/use-toast";
import { useAutoSave } from "@/lib/hooks/use-auto-save";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

interface ContextRulesEditorProps {
  policy: Policy;
  contextRules: Array<any>;
  onChange: (contextRules: Array<any>) => void;
  onPolicyUpdate: (updatedPolicy: Policy) => void;
}

const SEVERITY_OPERATORS = [
  { value: ">=", label: "Greater than or equal (>=)" },
  { value: ">", label: "Greater than (>)" },
  { value: "<=", label: "Less than or equal (<=)" },
  { value: "<", label: "Less than (<)" },
  { value: "=", label: "Equal (=)" },
];

const SEVERITY_LEVELS = ["safe", "low", "medium", "high", "critical"];

export default function ContextRulesEditor({
  policy,
  contextRules,
  onChange,
  onPolicyUpdate,
}: ContextRulesEditorProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get all available functions from policy
  const availableFunctions = Object.keys(policy.functions || {});

  const [formData, setFormData] = useState({
    function: "",
    condition: {
      severity: "",
      severity_operator: ">=",
      contains_keywords: [] as string[],
    },
    action: {
      block: false,
      reason: "",
    },
  });

  const [keywordInput, setKeywordInput] = useState("");

  // Local state for context rules - syncs with props but used for auto-save
  const [localContextRules, setLocalContextRules] = useState<Array<any>>(contextRules);
  
  // Sync local state with props when props change (e.g., after deletion)
  useEffect(() => {
    setLocalContextRules(contextRules);
  }, [contextRules]);

  // Use refs to ensure we always use the latest values in the save callback
  const policyIdRef = useRef(policy.id);
  const projectIdRef = useRef(projectId as string);
  
  useEffect(() => {
    policyIdRef.current = policy.id;
    projectIdRef.current = projectId as string;
  }, [policy.id, projectId]);

  // Memoize the save callback to prevent recreating it on every render
  const handleAutoSave = useCallback(
    async (updatedRules: typeof localContextRules) => {
      try {
        await updatePolicy(projectIdRef.current, policyIdRef.current, { context_rules: updatedRules });
        toast({
          title: "Context rules saved",
          description: "Changes have been automatically saved.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save context rules",
          variant: "destructive",
        });
        throw error;
      }
    },
    [] // Empty deps - we use refs for latest values
  );

  // Auto-save when local context rules change
  const { isSaving } = useAutoSave(localContextRules, {
    delay: 1000,
    enabled: true,
    onSave: handleAutoSave,
  });

  const handleAddRule = () => {
    setFormData({
      function: "",
      condition: {
        severity: "",
        severity_operator: ">=",
        contains_keywords: [],
      },
      action: {
        block: false,
        reason: "",
      },
    });
    setKeywordInput("");
    setEditingIndex(null);
    setIsDialogOpen(true);
  };

  const handleEditRule = (index: number) => {
    const rule = localContextRules[index];
    const severityCondition = rule.condition?.severity || "";
    let severityOperator = ">=";
    let severityLevel = "";

    if (severityCondition.startsWith(">=")) {
      severityOperator = ">=";
      severityLevel = severityCondition.substring(2);
    } else if (severityCondition.startsWith(">")) {
      severityOperator = ">";
      severityLevel = severityCondition.substring(1);
    } else if (severityCondition.startsWith("<=")) {
      severityOperator = "<=";
      severityLevel = severityCondition.substring(2);
    } else if (severityCondition.startsWith("<")) {
      severityOperator = "<";
      severityLevel = severityCondition.substring(1);
    } else if (severityCondition) {
      severityOperator = "=";
      severityLevel = severityCondition;
    }

    setFormData({
      function: rule.function || "",
      condition: {
        severity: severityLevel,
        severity_operator: severityOperator,
        contains_keywords: rule.condition?.contains_keywords || [],
      },
      action: {
        block: rule.action?.block || false,
        reason: rule.action?.reason || "",
      },
    });
    setKeywordInput("");
    setEditingIndex(index);
    setIsDialogOpen(true);
  };

  const handleDeleteRule = (index: number) => {
    setRuleToDelete(index);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (ruleToDelete === null) return;

    try {
      const updatedPolicy = await deleteContextRule(projectId as string, policy.id, ruleToDelete);
      onPolicyUpdate(updatedPolicy);
      toast({
        title: "Context rule deleted",
        description: "The context rule has been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete context rule",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const handleSaveRule = async () => {
    if (!formData.function.trim()) {
      toast({
        title: "Validation Error",
        description: "Function name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.condition.severity && formData.condition.contains_keywords.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one condition (severity or keywords) is required",
        variant: "destructive",
      });
      return;
    }

    const updatedRules = [...localContextRules];
    const condition: any = {};

    if (formData.condition.severity) {
      if (formData.condition.severity_operator === "=") {
        condition.severity = formData.condition.severity;
      } else {
        condition.severity = `${formData.condition.severity_operator}${formData.condition.severity}`;
      }
    }

    if (formData.condition.contains_keywords.length > 0) {
      condition.contains_keywords = formData.condition.contains_keywords;
    }

    const rule = {
      function: formData.function,
      condition,
      action: {
        block: formData.action.block,
        reason: formData.action.reason || undefined,
      },
    };

    if (editingIndex !== null) {
      updatedRules[editingIndex] = rule;
    } else {
      updatedRules.push(rule);
    }

    // Update local state first, then notify parent
    setLocalContextRules(updatedRules);
    onChange(updatedRules);
    setIsDialogOpen(false);
    setEditingIndex(null);
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.condition.contains_keywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        condition: {
          ...formData.condition,
          contains_keywords: [...formData.condition.contains_keywords, keywordInput.trim()],
        },
      });
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      condition: {
        ...formData.condition,
        contains_keywords: formData.condition.contains_keywords.filter((k) => k !== keyword),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Context Rules</h3>
          <p className="text-sm text-muted-foreground">
            Define context-based rules that trigger actions based on severity and keywords.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <Badge variant="secondary" className="text-xs">
              Saving...
            </Badge>
          )}
          <Button onClick={handleAddRule} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {localContextRules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground mb-4">No context rules defined</p>
            <Button onClick={handleAddRule} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {localContextRules.map((rule, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Rule #{index + 1}</CardTitle>
                    <CardDescription className="mt-1">Function: {rule.function}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditRule(index)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRule(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Condition</Label>
                    <div className="mt-1 space-y-1">
                      {rule.condition?.severity && (
                        <Badge variant="outline">Severity: {rule.condition.severity}</Badge>
                      )}
                      {rule.condition?.contains_keywords &&
                        rule.condition.contains_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {rule.condition.contains_keywords.map((keyword: string) => (
                              <Badge key={keyword} variant="secondary">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Action</Label>
                    <div className="mt-1">
                      {rule.action?.block && (
                        <Badge variant="destructive">Block</Badge>
                      )}
                      {rule.action?.reason && (
                        <p className="text-sm text-muted-foreground mt-1">{rule.action.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Edit Context Rule" : "Add Context Rule"}</DialogTitle>
            <DialogDescription>
              {editingIndex !== null
                ? "Update the context rule configuration"
                : "Create a new context-based rule"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule-function">Function *</Label>
              <Select
                value={formData.function}
                onValueChange={(value) => setFormData({ ...formData, function: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a function" />
                </SelectTrigger>
                <SelectContent>
                  {availableFunctions.map((func) => (
                    <SelectItem key={func} value={func}>
                      {func}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4 border rounded-md p-4">
              <Label className="text-base font-semibold">Condition</Label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="severity-operator">Severity Operator</Label>
                    <Select
                      value={formData.condition.severity_operator}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          condition: { ...formData.condition, severity_operator: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severity-level">Severity Level</Label>
                    <Select
                      value={formData.condition.severity || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          condition: { ...formData.condition, severity: value === "none" ? "" : value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {SEVERITY_LEVELS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords</Label>
                  <div className="flex gap-2">
                    <Input
                      id="keywords"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKeyword();
                        }
                      }}
                      placeholder="Enter keyword and press Enter"
                    />
                    <Button type="button" onClick={addKeyword} variant="outline">
                      Add
                    </Button>
                  </div>
                  {formData.condition.contains_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.condition.contains_keywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeKeyword(keyword)}
                        >
                          {keyword} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4 border rounded-md p-4">
              <Label className="text-base font-semibold">Action</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="block-action"
                    checked={formData.action.block}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        action: { ...formData.action, block: checked as boolean },
                      })
                    }
                  />
                  <Label htmlFor="block-action" className="text-sm font-normal cursor-pointer">
                    Block
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-reason">Reason</Label>
                  <Textarea
                    id="action-reason"
                    value={formData.action.reason}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        action: { ...formData.action, reason: e.target.value },
                      })
                    }
                    placeholder="Reason for the action..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule}>
              <Save className="h-4 w-4 mr-2" />
              {editingIndex !== null ? "Update" : "Add"} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Context Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this context rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

