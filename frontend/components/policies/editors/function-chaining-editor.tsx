"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import { useParams } from "next/navigation";

import { Policy, updatePolicy, deleteFunctionChaining } from "@/lib/actions/policies";
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

interface FunctionChainingEditorProps {
  policy: Policy;
  functionChaining: Record<string, any>;
  onChange: (functionChaining: Record<string, any>) => void;
  onPolicyUpdate: (updatedPolicy: Policy) => void;
}

export default function FunctionChainingEditor({
  policy,
  functionChaining,
  onChange,
  onPolicyUpdate,
}: FunctionChainingEditorProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [editingChaining, setEditingChaining] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [chainingToDelete, setChainingToDelete] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get all available functions from policy
  const availableFunctions = Object.keys(policy.functions || {});
  const allOptions = ["*", ...availableFunctions];

  // Local state for function chaining - syncs with props but used for auto-save
  const [localFunctionChaining, setLocalFunctionChaining] = useState<Record<string, any>>(functionChaining);
  
  // Sync local state with props when props change (e.g., after deletion)
  useEffect(() => {
    setLocalFunctionChaining(functionChaining);
  }, [functionChaining]);

  const [formData, setFormData] = useState({
    source_function: "",
    allowed_targets: [] as string[],
    blocked_targets: [] as string[],
    description: "",
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
    async (updatedChaining: typeof localFunctionChaining) => {
      try {
        await updatePolicy(projectIdRef.current, policyIdRef.current, { function_chaining: updatedChaining });
        toast({
          title: "Function chaining saved",
          description: "Changes have been automatically saved.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save function chaining",
          variant: "destructive",
        });
        throw error;
      }
    },
    [] // Empty deps - we use refs for latest values
  );

  // Auto-save when local function chaining changes
  const { isSaving } = useAutoSave(localFunctionChaining, {
    delay: 1000,
    enabled: true,
    onSave: handleAutoSave,
  });

  const handleAddChaining = () => {
    setFormData({
      source_function: "",
      allowed_targets: [],
      blocked_targets: [],
      description: "",
    });
    setEditingChaining(null);
    setIsDialogOpen(true);
  };

  const handleEditChaining = (sourceFunction: string) => {
    const chaining = localFunctionChaining[sourceFunction];
    setFormData({
      source_function: sourceFunction,
      allowed_targets: chaining.allowed_targets || [],
      blocked_targets: chaining.blocked_targets || [],
      description: chaining.description || "",
    });
    setEditingChaining(sourceFunction);
    setIsDialogOpen(true);
  };

  const handleDeleteChaining = (sourceFunction: string) => {
    setChainingToDelete(sourceFunction);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!chainingToDelete) return;

    try {
      const updatedPolicy = await deleteFunctionChaining(
        projectId as string,
        policy.id,
        chainingToDelete
      );
      onPolicyUpdate(updatedPolicy);
      toast({
        title: "Function chaining deleted",
        description: `Function chaining rule for "${chainingToDelete}" has been deleted.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete function chaining",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setChainingToDelete(null);
    }
  };

  const handleSaveChaining = async () => {
    if (!formData.source_function.trim()) {
      toast({
        title: "Validation Error",
        description: "Source function name is required",
        variant: "destructive",
      });
      return;
    }

    const updatedChaining = { ...localFunctionChaining };
    updatedChaining[formData.source_function] = {
      allowed_targets: formData.allowed_targets,
      blocked_targets: formData.blocked_targets,
      description: formData.description || undefined,
    };

    // If editing and name changed, remove old chaining rule
    if (editingChaining && editingChaining !== formData.source_function) {
      delete updatedChaining[editingChaining];
    }

    // Update local state first, then notify parent
    setLocalFunctionChaining(updatedChaining);
    onChange(updatedChaining);
    setIsDialogOpen(false);
    setEditingChaining(null);
  };

  const toggleTarget = (target: string, type: "allowed" | "blocked") => {
    setFormData((prev) => {
      const field = type === "allowed" ? "allowed_targets" : "blocked_targets";
      const targets = prev[field].includes(target)
        ? prev[field].filter((t) => t !== target)
        : [...prev[field], target];
      return { ...prev, [field]: targets };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Function Chaining</h3>
          <p className="text-sm text-muted-foreground">
            Configure which functions can call other functions. Use "*" to allow/block all functions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <Badge variant="secondary" className="text-xs">
              Saving...
            </Badge>
          )}
          <Button onClick={handleAddChaining} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {Object.keys(localFunctionChaining).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground mb-4">No function chaining rules defined</p>
            <Button onClick={handleAddChaining} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {Object.entries(localFunctionChaining).map(([sourceFunction, chaining]) => (
            <Card key={sourceFunction}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{sourceFunction}</CardTitle>
                    {chaining.description && (
                      <CardDescription className="mt-1">{chaining.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditChaining(sourceFunction)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteChaining(sourceFunction)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {chaining.allowed_targets && chaining.allowed_targets.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Allowed Targets</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {chaining.allowed_targets.map((target: string) => (
                          <Badge key={target} variant="default">
                            {target}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {chaining.blocked_targets && chaining.blocked_targets.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Blocked Targets</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {chaining.blocked_targets.map((target: string) => (
                          <Badge key={target} variant="destructive">
                            {target}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(!chaining.allowed_targets || chaining.allowed_targets.length === 0) &&
                    (!chaining.blocked_targets || chaining.blocked_targets.length === 0) && (
                      <p className="text-sm text-muted-foreground">No restrictions configured</p>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingChaining ? "Edit Function Chaining" : "Add Function Chaining"}</DialogTitle>
            <DialogDescription>
              {editingChaining
                ? "Update the function chaining rule"
                : "Configure which functions can be called from this function's output"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source-function">Source Function *</Label>
              <Input
                id="source-function"
                value={formData.source_function}
                onChange={(e) => setFormData({ ...formData, source_function: e.target.value })}
                placeholder="e.g., get_mail, send_mail"
                disabled={!!editingChaining}
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed Targets</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Functions that can be called from {formData.source_function || "this function"}'s output. Use "*" to allow all.
              </p>
              <div className="border rounded-md p-4 space-y-2 max-h-40 overflow-y-auto">
                {allOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`allowed-${option}`}
                      checked={formData.allowed_targets.includes(option)}
                      onCheckedChange={() => toggleTarget(option, "allowed")}
                    />
                    <Label
                      htmlFor={`allowed-${option}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {option === "*" ? "All functions (*)" : option}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Blocked Targets</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Functions that cannot be called from {formData.source_function || "this function"}'s output. Use "*" to block all.
              </p>
              <div className="border rounded-md p-4 space-y-2 max-h-40 overflow-y-auto">
                {allOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`blocked-${option}`}
                      checked={formData.blocked_targets.includes(option)}
                      onCheckedChange={() => toggleTarget(option, "blocked")}
                    />
                    <Label
                      htmlFor={`blocked-${option}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {option === "*" ? "All functions (*)" : option}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chaining-description">Description</Label>
              <Textarea
                id="chaining-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the chaining rules..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChaining}>
              <Save className="h-4 w-4 mr-2" />
              {editingChaining ? "Update" : "Add"} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Function Chaining Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the function chaining rule for "{chainingToDelete}"? This action cannot be undone.
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

