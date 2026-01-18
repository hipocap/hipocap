"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Policy, PolicyUpdate, updatePolicy } from "@/lib/actions/policies";
import { useToast } from "@/lib/hooks/use-toast";
import { useAutoSave } from "@/lib/hooks/use-auto-save";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";

import RolesEditor from "./editors/roles-editor";
import FunctionsEditor from "./editors/functions-editor";
import SeverityRulesEditor from "./editors/severity-rules-editor";
import FunctionChainingEditor from "./editors/function-chaining-editor";
import ContextRulesEditor from "./editors/context-rules-editor";
import DecisionThresholdsEditor from "./editors/decision-thresholds-editor";
import PromptsEditor from "./editors/prompts-editor";

interface PolicyEditPageProps {
  policy: Policy;
}

export default function PolicyEditPage({ policy: initialPolicy }: PolicyEditPageProps) {
  const { projectId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [policy, setPolicy] = useState<Policy>(initialPolicy);

  const [formData, setFormData] = useState<PolicyUpdate>({
    name: policy.name,
    description: policy.description || "",
    roles: policy.roles || {},
    functions: policy.functions || {},
    severity_rules: policy.severity_rules || {},
    output_restrictions: policy.output_restrictions || {},
    function_chaining: policy.function_chaining || {},
    context_rules: policy.context_rules || [],
    decision_thresholds: policy.decision_thresholds || {},
    custom_prompts: policy.custom_prompts || {},
    is_active: policy.is_active,
    is_default: policy.is_default,
  });

  // Memoize basic info data to prevent unnecessary re-renders and saves
  const basicInfoData = useMemo(
    () => ({
      name: formData.name,
      description: formData.description,
      is_active: formData.is_active,
      is_default: formData.is_default,
    }),
    [formData.name, formData.description, formData.is_active, formData.is_default]
  );

  // Use refs to ensure we always use the latest values in the save callback
  const policyIdRef = useRef(policy.id);
  const projectIdRef = useRef(projectId as string);
  
  useEffect(() => {
    policyIdRef.current = policy.id;
    projectIdRef.current = projectId as string;
  }, [policy.id, projectId]);

  // Memoize the save callback to prevent recreating it on every render
  const handleAutoSave = useCallback(
    async (updatedData: typeof basicInfoData) => {
      try {
        await updatePolicy(projectIdRef.current, policyIdRef.current, updatedData);
        toast({
          title: "Changes saved",
          description: "Your changes have been automatically saved.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save changes",
          variant: "destructive",
        });
        throw error;
      }
    },
    [] // Empty deps - we use refs for latest values
  );

  const { isSaving: isAutoSaving } = useAutoSave(basicInfoData, {
    delay: 1000,
    enabled: true,
    onSave: handleAutoSave,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: PolicyUpdate = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        is_default: formData.is_default,
      };

      await updatePolicy(projectId as string, policy.id, updateData);
      toast({
        title: "Policy updated",
        description: "The policy has been successfully updated.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update policy",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePolicyUpdate = (updatedPolicy: Policy) => {
    setPolicy(updatedPolicy);
    setFormData({
    name: updatedPolicy.name,
    description: updatedPolicy.description || "",
    roles: updatedPolicy.roles || {},
    functions: updatedPolicy.functions || {},
    severity_rules: updatedPolicy.severity_rules || {},
    output_restrictions: updatedPolicy.output_restrictions || {},
    function_chaining: updatedPolicy.function_chaining || {},
    context_rules: updatedPolicy.context_rules || [],
    decision_thresholds: updatedPolicy.decision_thresholds || {},
    custom_prompts: updatedPolicy.custom_prompts || {},
    is_active: updatedPolicy.is_active,
    is_default: updatedPolicy.is_default,
  });
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/project/${projectId}/policies`)}
            className="h-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Policies
          </Button>
          <div className="flex items-center gap-2">
            {isAutoSaving && (
              <Badge variant="secondary" className="text-xs">
                Auto-saving...
              </Badge>
            )}
            <Button onClick={handleSave} disabled={isSaving || isAutoSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Edit Policy</h1>
          <p className="text-sm text-muted-foreground">
            {policy.policy_key}
          </p>
        </div>
      </div>

      <Card className="w-full overflow-hidden">
        <Tabs defaultValue="basic" className="w-full">
          {/* Toolbar as Section Header */}
          <div className="sticky top-0 z-10 bg-card border-b border-border px-6 pt-6 pb-2 rounded-t-xl">
            <TabsList className="w-full inline-flex h-11 items-center justify-start gap-1.5 p-1.5 bg-muted/50 border border-border/50 rounded-lg overflow-x-auto overflow-y-hidden no-scrollbar">
              <TabsTrigger 
                value="basic" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Basic Info
              </TabsTrigger>
              <TabsTrigger 
                value="roles" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Roles
              </TabsTrigger>
              <TabsTrigger 
                value="functions" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Functions
              </TabsTrigger>
              <TabsTrigger 
                value="severity" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Severity Rules
              </TabsTrigger>
              <TabsTrigger 
                value="chaining" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Function Chaining
              </TabsTrigger>
              <TabsTrigger 
                value="thresholds" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Decision Thresholds
              </TabsTrigger>
              <TabsTrigger 
                value="prompts" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Prompts
              </TabsTrigger>
              <TabsTrigger 
                value="advanced" 
                className="h-9 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all flex-shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground"
              >
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="px-6 pb-6" style={{ scrollbarGutter: 'stable' }}>
            <TabsContent value="basic" className="mt-2 min-h-0">
              <div className="pt-2">
                <CardHeader className="space-y-3 pb-6 px-0 pt-0">
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Policy name, description, and status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 px-0 pt-0">
                <div className="space-y-4">
                  <Label htmlFor="name" className="text-base">Policy Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="space-y-4">
                  <Label htmlFor="description" className="text-base">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-8 pt-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked as boolean })
                      }
                    />
                    <Label htmlFor="is_active" className="cursor-pointer text-base">Active</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="is_default"
                      checked={formData.is_default}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_default: checked as boolean })
                      }
                    />
                    <Label htmlFor="is_default" className="cursor-pointer text-base">Default Policy</Label>
                  </div>
                </div>
                </CardContent>
              </div>
            </TabsContent>

            <TabsContent value="roles" className="mt-2 min-h-0">
              <div className="pt-2">
                <RolesEditor
                  policy={policy}
                  roles={formData.roles || {}}
                  onChange={(roles) => setFormData({ ...formData, roles })}
                  onPolicyUpdate={handlePolicyUpdate}
                />
              </div>
            </TabsContent>

            <TabsContent value="functions" className="mt-2 min-h-0">
              <div className="pt-2">
                <FunctionsEditor
                  policy={policy}
                  functions={formData.functions || {}}
                  onChange={(functions) => setFormData({ ...formData, functions })}
                  onPolicyUpdate={handlePolicyUpdate}
                />
              </div>
            </TabsContent>

            <TabsContent value="severity" className="mt-2 min-h-0">
              <div className="pt-2">
                <SeverityRulesEditor
                  policy={policy}
                  severityRules={formData.severity_rules || {}}
                  onChange={(severity_rules) => setFormData({ ...formData, severity_rules })}
                />
              </div>
            </TabsContent>

            <TabsContent value="chaining" className="mt-2 min-h-0">
              <div className="pt-2">
                <FunctionChainingEditor
                  policy={policy}
                  functionChaining={formData.function_chaining || {}}
                  onChange={(function_chaining) => setFormData({ ...formData, function_chaining })}
                  onPolicyUpdate={handlePolicyUpdate}
                />
              </div>
            </TabsContent>

            <TabsContent value="thresholds" className="mt-2 min-h-0">
              <div className="pt-2">
                <DecisionThresholdsEditor
                  policy={policy}
                  decisionThresholds={formData.decision_thresholds || {}}
                  onChange={(decision_thresholds) => setFormData({ ...formData, decision_thresholds })}
                />
              </div>
            </TabsContent>

            <TabsContent value="prompts" className="mt-2 min-h-0">
              <div className="pt-2">
                <PromptsEditor
                  policy={policy}
                  customPrompts={formData.custom_prompts}
                  onChange={(custom_prompts) => setFormData({ ...formData, custom_prompts })}
                  onPolicyUpdate={handlePolicyUpdate}
                />
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="mt-2 min-h-0">
              <div className="pt-2">
                <CardHeader className="space-y-3 pb-6 px-0 pt-0">
                <CardTitle>Context Rules</CardTitle>
                <CardDescription className="leading-relaxed">Define context-based rules</CardDescription>
              </CardHeader>
                <CardContent className="px-0 pt-0">
                  <ContextRulesEditor
                    policy={policy}
                    contextRules={formData.context_rules || []}
                    onChange={(context_rules) => setFormData({ ...formData, context_rules })}
                    onPolicyUpdate={handlePolicyUpdate}
                  />
                </CardContent>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}

