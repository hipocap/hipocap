"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

import { Policy, PolicyCreate, PolicyUpdate, createPolicy, updatePolicy } from "@/lib/actions/policies";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import ContentRenderer from "../ui/content-renderer/index";
import { useToast } from "@/lib/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { ChevronDown } from "lucide-react";

interface PolicyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: Policy | null;
  onSuccess: () => void;
}

export default function PolicyForm({ open, onOpenChange, policy, onSuccess }: PolicyFormProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const isEditing = !!policy;

  const [formData, setFormData] = useState<PolicyCreate>({
    policy_key: "",
    name: "",
    description: "",
    roles: {},
    functions: {},
    severity_rules: {},
    output_restrictions: {},
    function_chaining: {},
    context_rules: [],
    is_default: false,
  });

  const [advancedConfig, setAdvancedConfig] = useState({
    roles: "{}",
    functions: "{}",
    severity_rules: "{}",
    output_restrictions: "{}",
    function_chaining: "{}",
    context_rules: "[]",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (policy) {
      setFormData({
        policy_key: policy.policy_key,
        name: policy.name,
        description: policy.description || "",
        roles: policy.roles || {},
        functions: policy.functions || {},
        severity_rules: policy.severity_rules || {},
        output_restrictions: policy.output_restrictions || {},
        function_chaining: policy.function_chaining || {},
        context_rules: policy.context_rules || [],
        is_default: policy.is_default,
      });
      setAdvancedConfig({
        roles: JSON.stringify(policy.roles || {}, null, 2),
        functions: JSON.stringify(policy.functions || {}, null, 2),
        severity_rules: JSON.stringify(policy.severity_rules || {}, null, 2),
        output_restrictions: JSON.stringify(policy.output_restrictions || {}, null, 2),
        function_chaining: JSON.stringify(policy.function_chaining || {}, null, 2),
        context_rules: JSON.stringify(policy.context_rules || [], null, 2),
      });
    } else {
      setFormData({
        policy_key: "",
        name: "",
        description: "",
        roles: {},
        functions: {},
        severity_rules: {},
        output_restrictions: {},
        function_chaining: {},
        context_rules: [],
        is_default: false,
      });
      setAdvancedConfig({
        roles: "{}",
        functions: "{}",
        severity_rules: "{}",
        output_restrictions: "{}",
        function_chaining: "{}",
        context_rules: "[]",
      });
    }
    setErrors({});
  }, [policy, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.policy_key.trim()) {
      newErrors.policy_key = "Policy key is required";
    } else if (!/^[a-z0-9_-]+$/.test(formData.policy_key)) {
      newErrors.policy_key = "Policy key can only contain lowercase letters, numbers, hyphens, and underscores";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    // Validate JSON fields
    try {
      JSON.parse(advancedConfig.roles);
    } catch {
      newErrors.roles = "Invalid JSON format";
    }

    try {
      JSON.parse(advancedConfig.functions);
    } catch {
      newErrors.functions = "Invalid JSON format";
    }

    try {
      JSON.parse(advancedConfig.severity_rules);
    } catch {
      newErrors.severity_rules = "Invalid JSON format";
    }

    try {
      JSON.parse(advancedConfig.output_restrictions);
    } catch {
      newErrors.output_restrictions = "Invalid JSON format";
    }

    try {
      JSON.parse(advancedConfig.function_chaining);
    } catch {
      newErrors.function_chaining = "Invalid JSON format";
    }

    try {
      JSON.parse(advancedConfig.context_rules);
    } catch {
      newErrors.context_rules = "Invalid JSON format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Parse JSON fields
      const roles = JSON.parse(advancedConfig.roles);
      const functions = JSON.parse(advancedConfig.functions);
      const severity_rules = JSON.parse(advancedConfig.severity_rules);
      const output_restrictions = JSON.parse(advancedConfig.output_restrictions);
      const function_chaining = JSON.parse(advancedConfig.function_chaining);
      const context_rules = JSON.parse(advancedConfig.context_rules);

      if (isEditing && policy) {
        const updateData: PolicyUpdate = {
          name: formData.name,
          description: formData.description || undefined,
          roles,
          functions,
          severity_rules,
          output_restrictions,
          function_chaining,
          context_rules,
          is_default: formData.is_default,
        };
        await updatePolicy(projectId as string, policy.id, updateData);
        toast({
          title: "Success",
          description: "Policy updated successfully",
        });
      } else {
        const createData: PolicyCreate = {
          policy_key: formData.policy_key,
          name: formData.name,
          description: formData.description || undefined,
          roles,
          functions,
          severity_rules,
          output_restrictions,
          function_chaining,
          context_rules,
          is_default: formData.is_default,
        };
        await createPolicy(projectId as string, createData);
        toast({
          title: "Success",
          description: "Policy created successfully",
        });
      }

      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save policy",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Policy" : "Create Policy"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the policy configuration. Changes will be merged with existing settings."
              : "Create a new security policy for Hipocap analysis."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="policy_key">Policy Key *</Label>
              <Input
                id="policy_key"
                value={formData.policy_key}
                onChange={(e) => setFormData({ ...formData, policy_key: e.target.value })}
                placeholder="my-custom-policy"
                disabled={isEditing}
                className={errors.policy_key ? "border-destructive" : ""}
              />
              {errors.policy_key && <p className="text-xs text-destructive">{errors.policy_key}</p>}
              <p className="text-xs text-muted-foreground">
                Unique identifier for the policy (lowercase, numbers, hyphens, underscores only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Custom Policy"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this policy is for..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: !!checked })}
              />
              <Label htmlFor="is_default" className="text-sm font-normal cursor-pointer">
                Set as default policy
              </Label>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                  <Label className="text-sm font-semibold">Roles</Label>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2">
                    <ContentRenderer
                      readOnly={false}
                      defaultMode="json"
                      value={advancedConfig.roles}
                      onChange={(value) => setAdvancedConfig({ ...advancedConfig, roles: value })}
                      presetKey="policy-roles"
                      className="border rounded-md"
                    />
                    {errors.roles && <p className="text-xs text-destructive mt-1">{errors.roles}</p>}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                  <Label className="text-sm font-semibold">Functions</Label>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2">
                    <ContentRenderer
                      readOnly={false}
                      defaultMode="json"
                      value={advancedConfig.functions}
                      onChange={(value) => setAdvancedConfig({ ...advancedConfig, functions: value })}
                      presetKey="policy-functions"
                      className="border rounded-md"
                    />
                    {errors.functions && <p className="text-xs text-destructive mt-1">{errors.functions}</p>}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                  <Label className="text-sm font-semibold">Severity Rules</Label>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2">
                    <ContentRenderer
                      readOnly={false}
                      defaultMode="json"
                      value={advancedConfig.severity_rules}
                      onChange={(value) => setAdvancedConfig({ ...advancedConfig, severity_rules: value })}
                      presetKey="policy-severity-rules"
                      className="border rounded-md"
                    />
                    {errors.severity_rules && (
                      <p className="text-xs text-destructive mt-1">{errors.severity_rules}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                  <Label className="text-sm font-semibold">Output Restrictions</Label>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2">
                    <ContentRenderer
                      readOnly={false}
                      defaultMode="json"
                      value={advancedConfig.output_restrictions}
                      onChange={(value) => setAdvancedConfig({ ...advancedConfig, output_restrictions: value })}
                      presetKey="policy-output-restrictions"
                      className="border rounded-md"
                    />
                    {errors.output_restrictions && (
                      <p className="text-xs text-destructive mt-1">{errors.output_restrictions}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                  <Label className="text-sm font-semibold">Function Chaining</Label>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2">
                    <ContentRenderer
                      readOnly={false}
                      defaultMode="json"
                      value={advancedConfig.function_chaining}
                      onChange={(value) => setAdvancedConfig({ ...advancedConfig, function_chaining: value })}
                      presetKey="policy-function-chaining"
                      className="border rounded-md"
                    />
                    {errors.function_chaining && (
                      <p className="text-xs text-destructive mt-1">{errors.function_chaining}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                  <Label className="text-sm font-semibold">Context Rules</Label>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2">
                    <ContentRenderer
                      readOnly={false}
                      defaultMode="json"
                      value={advancedConfig.context_rules}
                      onChange={(value) => setAdvancedConfig({ ...advancedConfig, context_rules: value })}
                      presetKey="policy-context-rules"
                      className="border rounded-md"
                    />
                    {errors.context_rules && (
                      <p className="text-xs text-destructive mt-1">{errors.context_rules}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

