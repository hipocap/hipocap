"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Edit, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useParams } from "next/navigation";

import { Policy, updatePolicy, deleteFunction } from "@/lib/actions/policies";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

interface FunctionsEditorProps {
  policy: Policy;
  functions: Record<string, any>;
  onChange: (functions: Record<string, any>) => void;
  onPolicyUpdate: (updatedPolicy: Policy) => void;
}

export default function FunctionsEditor({
  policy,
  functions,
  onChange,
  onPolicyUpdate,
}: FunctionsEditorProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [editingFunction, setEditingFunction] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [functionToDelete, setFunctionToDelete] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set());

  // Local state for functions - syncs with props but used for auto-save
  const [localFunctions, setLocalFunctions] = useState<Record<string, any>>(functions);
  
  // Sync local state with props when props change (e.g., after deletion)
  useEffect(() => {
    setLocalFunctions(functions);
  }, [functions]);

  // Get all available roles from policy
  const availableRoles = Object.keys(policy.roles || {});
  const severityLevels = ["safe", "low", "medium", "high", "critical"];

  const [formData, setFormData] = useState({
    name: "",
    allowed_roles: [] as string[],
    output_restrictions: {
      cannot_trigger_functions: false,
      max_severity_for_use: "" as string,
    },
    review_required: false,
    hitl_rules: "",
    description: "",
    quarantine_exclude: "",
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
    async (updatedFunctions: typeof localFunctions) => {
      try {
        await updatePolicy(projectIdRef.current, policyIdRef.current, { functions: updatedFunctions });
        toast({
          title: "Functions saved",
          description: "Changes have been automatically saved.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save functions",
          variant: "destructive",
        });
        throw error;
      }
    },
    [] // Empty deps - we use refs for latest values
  );

  // Auto-save when local functions change
  const { isSaving } = useAutoSave(localFunctions, {
    delay: 1000,
    enabled: true,
    onSave: handleAutoSave,
  });

  const handleAddFunction = () => {
    setFormData({
      name: "",
      allowed_roles: [],
      output_restrictions: {
        cannot_trigger_functions: false,
        max_severity_for_use: "",
      },
      review_required: false,
      hitl_rules: "",
      description: "",
      quarantine_exclude: "",
    });
    setEditingFunction(null);
    setIsDialogOpen(true);
  };

  const handleEditFunction = (functionName: string) => {
    const func = localFunctions[functionName];
    setFormData({
      name: functionName,
      allowed_roles: func.allowed_roles || [],
      output_restrictions: func.output_restrictions || {
        cannot_trigger_functions: false,
        max_severity_for_use: "",
      },
      review_required: func.review_required || false,
      hitl_rules: func.hitl_rules || "",
      description: func.description || "",
      quarantine_exclude: func.quarantine_exclude || "",
    });
    setEditingFunction(functionName);
    setIsDialogOpen(true);
  };

  const handleDeleteFunction = (functionName: string) => {
    setFunctionToDelete(functionName);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!functionToDelete) return;

    try {
      const updatedPolicy = await deleteFunction(projectId as string, policy.id, functionToDelete);
      onPolicyUpdate(updatedPolicy);
      toast({
        title: "Function deleted",
        description: `Function "${functionToDelete}" has been deleted.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete function",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setFunctionToDelete(null);
    }
  };

  const handleSaveFunction = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Function name is required",
        variant: "destructive",
      });
      return;
    }

    const updatedFunctions = { ...localFunctions };
    const functionConfig: any = {
      allowed_roles: formData.allowed_roles,
      description: formData.description || undefined,
    };

    if (formData.output_restrictions.cannot_trigger_functions || formData.output_restrictions.max_severity_for_use) {
      functionConfig.output_restrictions = {
        ...(formData.output_restrictions.cannot_trigger_functions && {
          cannot_trigger_functions: true,
        }),
        ...(formData.output_restrictions.max_severity_for_use && {
          max_severity_for_use: formData.output_restrictions.max_severity_for_use,
        }),
      };
    }

    if (formData.review_required) {
      functionConfig.review_required = true;
    }

    if (formData.hitl_rules) {
      functionConfig.hitl_rules = formData.hitl_rules;
    }

    if (formData.quarantine_exclude) {
      functionConfig.quarantine_exclude = formData.quarantine_exclude;
    }

    updatedFunctions[formData.name] = functionConfig;

    // If editing and name changed, remove old function
    if (editingFunction && editingFunction !== formData.name) {
      delete updatedFunctions[editingFunction];
    }

    // Update local state first, then notify parent
    setLocalFunctions(updatedFunctions);
    onChange(updatedFunctions);
    setIsDialogOpen(false);
    setEditingFunction(null);
  };

  const toggleRole = (role: string) => {
    setFormData((prev) => {
      const allowed_roles = prev.allowed_roles.includes(role)
        ? prev.allowed_roles.filter((r) => r !== role)
        : [...prev.allowed_roles, role];
      return { ...prev, allowed_roles };
    });
  };

  const toggleExpanded = (functionName: string) => {
    setExpandedFunctions((prev) => {
      const next = new Set(prev);
      if (next.has(functionName)) {
        next.delete(functionName);
      } else {
        next.add(functionName);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Functions</h3>
          <p className="text-sm text-muted-foreground">
            Configure function permissions, restrictions, and review requirements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <Badge variant="secondary" className="text-xs">
              Saving...
            </Badge>
          )}
          <Button onClick={handleAddFunction} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Function
          </Button>
        </div>
      </div>

      {Object.keys(localFunctions).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground mb-4">No functions defined</p>
            <Button onClick={handleAddFunction} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Function
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {Object.entries(localFunctions).map(([functionName, func]) => (
            <Card key={functionName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{functionName}</CardTitle>
                    {func.description && (
                      <CardDescription className="mt-1">{func.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(functionName)}
                    >
                      {expandedFunctions.has(functionName) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditFunction(functionName)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFunction(functionName)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Collapsible open={expandedFunctions.has(functionName)}>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {func.allowed_roles && func.allowed_roles.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Allowed Roles</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {func.allowed_roles.map((role: string) => (
                            <Badge key={role} variant="secondary">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {func.output_restrictions && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Output Restrictions</Label>
                        <div className="mt-1 space-y-1">
                          {func.output_restrictions.cannot_trigger_functions && (
                            <Badge variant="outline">Cannot trigger functions</Badge>
                          )}
                          {func.output_restrictions.max_severity_for_use && (
                            <Badge variant="outline">
                              Max severity: {func.output_restrictions.max_severity_for_use}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {func.review_required && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Review Required</Label>
                        <Badge variant="default" className="mt-1">Yes</Badge>
                      </div>
                    )}
                    {func.hitl_rules && (
                      <div>
                        <Label className="text-xs text-muted-foreground">HITL Rules</Label>
                        <p className="text-sm text-muted-foreground mt-1">{func.hitl_rules}</p>
                      </div>
                    )}
                    {func.quarantine_exclude && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Quarantine Exclude</Label>
                        <p className="text-sm text-muted-foreground mt-1">{func.quarantine_exclude}</p>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFunction ? "Edit Function" : "Add Function"}</DialogTitle>
            <DialogDescription>
              {editingFunction
                ? "Update the function configuration"
                : "Configure a new function with permissions and restrictions"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="function-name">Function Name *</Label>
              <Input
                id="function-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., get_mail, send_mail, search_web"
                disabled={!!editingFunction}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="function-description">Description</Label>
              <Textarea
                id="function-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this function does..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed Roles</Label>
              <div className="border rounded-md p-4 space-y-2 max-h-40 overflow-y-auto">
                {availableRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles defined. Create roles first.</p>
                ) : (
                  availableRoles.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={formData.allowed_roles.includes(role)}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <Label
                        htmlFor={`role-${role}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {role}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-4 border rounded-md p-4">
              <Label className="text-base font-semibold">Output Restrictions</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cannot-trigger-functions"
                    checked={formData.output_restrictions.cannot_trigger_functions}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        output_restrictions: {
                          ...formData.output_restrictions,
                          cannot_trigger_functions: checked as boolean,
                        },
                      })
                    }
                  />
                  <Label htmlFor="cannot-trigger-functions" className="text-sm font-normal cursor-pointer">
                    Cannot trigger functions
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-severity">Max Severity for Use</Label>
                  <Select
                    value={formData.output_restrictions.max_severity_for_use || "none"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        output_restrictions: {
                          ...formData.output_restrictions,
                          max_severity_for_use: value === "none" ? "" : value,
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select max severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {severityLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="review-required"
                  checked={formData.review_required}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, review_required: checked as boolean })
                  }
                />
                <Label htmlFor="review-required" className="text-sm font-normal cursor-pointer">
                  Review Required (HITL)
                </Label>
              </div>
            </div>
            {formData.review_required && (
              <div className="space-y-2">
                <Label htmlFor="hitl-rules">HITL Rules</Label>
                <Textarea
                  id="hitl-rules"
                  value={formData.hitl_rules}
                  onChange={(e) => setFormData({ ...formData, hitl_rules: e.target.value })}
                  placeholder="Describe when human review is required..."
                  rows={4}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="quarantine-exclude">Quarantine Exclude</Label>
              <Textarea
                id="quarantine-exclude"
                value={formData.quarantine_exclude}
                onChange={(e) => setFormData({ ...formData, quarantine_exclude: e.target.value })}
                placeholder="Instructions for what to exclude from quarantine analysis..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFunction}>
              <Save className="h-4 w-4 mr-2" />
              {editingFunction ? "Update" : "Add"} Function
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Function</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the function "{functionToDelete}"? This action cannot be undone.
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

