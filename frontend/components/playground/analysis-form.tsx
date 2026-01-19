"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import useSWR from "swr";

import { HipocapAnalysisRequest, HipocapAnalysisResponse } from "@/lib/hipocap/types";
import { Policy, listPolicies } from "@/lib/actions/policies";
import { swrFetcher } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";

// JSON validation helper
const jsonSchema = z
  .string()
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true; // Allow empty
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid JSON format" }
  )
  .transform((val) => {
    if (!val || val.trim() === "") return undefined;
    return JSON.parse(val);
  });

// Form validation schema
const analysisFormSchema = z
  .object({
    request_mode: z.enum(["function", "full_body"]).default("function"),
    function_name: z.string().optional(),
    function_result: z.string().optional().pipe(jsonSchema),
    function_args: z.string().optional().pipe(jsonSchema),
    user_query: z.string().optional(),
    user_role: z.string().optional(),
    target_function: z.string().optional(),
    full_body: z.string().optional().pipe(jsonSchema),
    input_analysis: z.boolean().default(true),
    llm_analysis: z.boolean().default(false),
    quarantine_analysis: z.boolean().default(false),
    quick_analysis: z.boolean().default(false),
    enable_keyword_detection: z.boolean().default(false),
    keywords: z.string().optional(),
    backend_url: z.string().min(1, "Backend URL is required"),
    api_key: z.string().min(1, "API Key is required"),
    policy_key: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.request_mode === "function") {
      if (!data.function_name || data.function_name.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Function name is required",
          path: ["function_name"],
        });
      }
      if (!data.function_result || data.function_result === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Function result is required",
          path: ["function_result"],
        });
      }
    } else {
      if (!data.full_body || data.full_body === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Full body JSON is required",
          path: ["full_body"],
        });
      }
    }
  });

export type AnalysisFormData = z.infer<typeof analysisFormSchema>;

interface AnalysisFormProps {
  onResult: (result: HipocapAnalysisResponse) => void;
  onError: (error: string) => void;
  onFormReady?: (formControls: {
    control: ReturnType<typeof useForm<AnalysisFormData>>["control"];
    register: ReturnType<typeof useForm<AnalysisFormData>>["register"];
    errors: ReturnType<typeof useForm<AnalysisFormData>>["formState"]["errors"];
    watch: ReturnType<typeof useForm<AnalysisFormData>>["watch"];
    reset: ReturnType<typeof useForm<AnalysisFormData>>["reset"];
    handleSubmit: ReturnType<typeof useForm<AnalysisFormData>>["handleSubmit"];
    setValue: ReturnType<typeof useForm<AnalysisFormData>>["setValue"];
    examplePresets: Array<{ name: string; data: Partial<AnalysisFormData> }>;
    loadPreset: (preset: { name: string; data: Partial<AnalysisFormData> }) => void;
    handleReset: () => void;
    isLoading: boolean;
    requestMode: "function" | "full_body";
  }) => void;
}

const STORAGE_KEY_BACKEND_URL = "hipocap_playground_backend_url";
const STORAGE_KEY_API_KEY = "hipocap_playground_api_key";

export function AnalysisForm({ onResult, onError, onFormReady }: AnalysisFormProps) {
  const params = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch policies
  const {
    data: policies,
    error: policiesError,
    isLoading: policiesLoading,
  } = useSWR<Policy[]>(`/api/projects/${params?.projectId}/policies`, swrFetcher);

  // Load saved config from localStorage
  const [savedBackendUrl, setSavedBackendUrl] = useState<string>("");
  const [savedApiKey, setSavedApiKey] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = localStorage.getItem(STORAGE_KEY_BACKEND_URL) || "";
      const key = localStorage.getItem(STORAGE_KEY_API_KEY) || "";
      setSavedBackendUrl(url);
      setSavedApiKey(key);
    }
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AnalysisFormData>({
    // @ts-ignore - zod resolver type mismatch
    resolver: zodResolver(analysisFormSchema),
    defaultValues: {
      request_mode: "function",
      function_name: "",
      function_result: "",
      function_args: "",
      user_query: "",
      user_role: "",
      target_function: "",
      full_body: "",
      input_analysis: true,
      llm_analysis: false,
      quarantine_analysis: false,
      quick_analysis: false,
      enable_keyword_detection: false,
      keywords: "",
      backend_url: "",
      api_key: "",
      policy_key: "",
    },
  });

  // Set saved values when they're loaded
  useEffect(() => {
    if (savedBackendUrl) {
      setValue("backend_url", savedBackendUrl);
    }
    if (savedApiKey) {
      setValue("api_key", savedApiKey);
    }
  }, [savedBackendUrl, savedApiKey, setValue]);

  const requestMode = watch("request_mode");
  const enableKeywordDetection = watch("enable_keyword_detection");
  const backendUrl = watch("backend_url");
  const apiKey = watch("api_key");

  // Save config to localStorage when changed
  useEffect(() => {
    if (typeof window !== "undefined" && backendUrl) {
      localStorage.setItem(STORAGE_KEY_BACKEND_URL, backendUrl);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (typeof window !== "undefined" && apiKey) {
      localStorage.setItem(STORAGE_KEY_API_KEY, apiKey);
    }
  }, [apiKey]);

  // Example presets - memoized to prevent recreation on every render
  const examplePresets = useMemo(() => [
    {
      name: "Email Function",
      data: {
        function_name: "send_email",
        function_result: JSON.stringify({ status: "success", message_id: "msg_123" }, null, 2),
        function_args: JSON.stringify({ to: "user@example.com", subject: "Test Email", body: "Hello World" }, null, 2),
        user_query: "Send an email to user@example.com",
        user_role: "user",
        input_analysis: true,
        llm_analysis: true,
        quarantine_analysis: false,
      },
    },
    {
      name: "File Delete",
      data: {
        function_name: "delete_file",
        function_result: JSON.stringify({ status: "success", deleted: true }, null, 2),
        function_args: JSON.stringify({ path: "/tmp/test.txt" }, null, 2),
        user_query: "Delete the test file",
        user_role: "admin",
        input_analysis: true,
        llm_analysis: true,
        quarantine_analysis: false,
      },
    },
    {
      name: "Database Query",
      data: {
        function_name: "query_database",
        function_result: JSON.stringify({ rows: [{ id: 1, name: "John" }], count: 1 }, null, 2),
        function_args: JSON.stringify({ query: "SELECT * FROM users WHERE id = 1" }, null, 2),
        user_query: "Get user data",
        user_role: "user",
        input_analysis: true,
        llm_analysis: false,
        quarantine_analysis: false,
      },
    },
  ], []);

  const loadPreset = useCallback((preset: typeof examplePresets[0]) => {
    reset(preset.data as AnalysisFormData);
  }, [reset]);

  const onSubmit = async (data: AnalysisFormData) => {
    setIsLoading(true);
    onError(""); // Clear previous errors

    try {
      // Build request based on mode
      let requestBody: any;
      
      if (data.request_mode === "function") {
        // Parse keywords if provided
        const keywordsArray = data.keywords
          ? data.keywords.split(",").map((k) => k.trim()).filter((k) => k.length > 0)
          : undefined;

        requestBody = {
          function_name: data.function_name,
          function_result: data.function_result,
          function_args: data.function_args,
          user_query: data.user_query || undefined,
          user_role: data.user_role || undefined,
          target_function: data.target_function || undefined,
          input_analysis: data.input_analysis,
          llm_analysis: data.llm_analysis,
          quarantine_analysis: data.quarantine_analysis,
          quick_analysis: data.quick_analysis,
          enable_keyword_detection: data.enable_keyword_detection,
          keywords: keywordsArray,
          policy_key: data.policy_key || undefined,
        };
      } else {
        // Full body mode - parse the JSON body
        requestBody = data.full_body;
      }

      // Include backend config in request
      const requestPayload = {
        ...requestBody,
        _config: {
          backend_url: data.backend_url || undefined,
          api_key: data.api_key || undefined,
        },
      };

      const response = await fetch(`/api/projects/${params?.projectId}/hipocap/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const result = (await response.json()) as HipocapAnalysisResponse;
      onResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze function";
      onError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = useCallback(() => {
    reset();
    onError("");
  }, [reset, onError]);

  // Use refs to track previous values and avoid unnecessary updates
  const prevValuesRef = useRef<{
    errors: typeof errors;
    isLoading: boolean;
    requestMode: typeof requestMode;
  } | null>(null);

  // Expose form controls to parent component
  // Only call onFormReady when values actually change
  useEffect(() => {
    if (!onFormReady) return;

    const currentValues = {
      errors,
      isLoading,
      requestMode,
    };

    // Check if values have actually changed
    const prevValues = prevValuesRef.current;
    if (
      prevValues &&
      prevValues.isLoading === currentValues.isLoading &&
      prevValues.requestMode === currentValues.requestMode &&
      JSON.stringify(prevValues.errors) === JSON.stringify(currentValues.errors)
    ) {
      return; // No actual changes, skip update
    }

    prevValuesRef.current = currentValues;

    onFormReady({
      control: control as any,
      register: register as any,
      errors: errors as any,
      watch: watch as any,
      reset: reset as any,
      handleSubmit: handleSubmit as any,
      setValue: setValue as any,
      examplePresets: examplePresets as any,
      loadPreset: loadPreset as any,
      handleReset,
      isLoading,
      requestMode: requestMode as any,
    });
    // Only include dependencies that can actually change
    // The ref comparison prevents infinite loops even if the effect runs
  }, [errors, isLoading, requestMode, onFormReady]);

  return (
    <form 
      id="analysis-form"
      onSubmit={(e) => {
        // @ts-ignore - type mismatch
        handleSubmit(onSubmit)(e);
      }} 
      className="flex flex-col h-full"
    >
      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
        <div className="flex flex-col gap-6 max-w-full">
          {/* Function Details Section */}
          {requestMode === "function" ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-semibold text-foreground">Function Details</h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="function_name" className="text-sm">
                    Function Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="function_name"
                    {...register("function_name")}
                    placeholder="e.g., send_email, delete_file, get_user_data"
                    disabled={isLoading}
                    className={errors.function_name ? "border-destructive" : ""}
                  />
                  {errors.function_name && (
                    <p className="text-xs text-destructive">{errors.function_name.message as string}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="function_result" className="text-sm">
                    Function Result (JSON) <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="function_result"
                    {...register("function_result")}
                    placeholder='{"status": "success", "data": {...}}'
                    className="font-mono text-sm min-h-[120px] resize-y"
                    disabled={isLoading}
                  />
                  {errors.function_result && (
                    <p className="text-xs text-destructive">{errors.function_result.message as string}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="function_args" className="text-sm">Function Arguments (JSON)</Label>
                  <Textarea
                    id="function_args"
                    {...register("function_args")}
                    placeholder='{"to": "user@example.com", "subject": "Hello"}'
                    className="font-mono text-sm min-h-[100px] resize-y"
                    disabled={isLoading}
                  />
                  {errors.function_args && (
                    <p className="text-xs text-destructive">{errors.function_args.message as string}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="user_query" className="text-sm">User Query</Label>
                    <Input
                      id="user_query"
                      {...register("user_query")}
                      placeholder="Original user request"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="user_role" className="text-sm">User Role</Label>
                    <Input
                      id="user_role"
                      {...register("user_role")}
                      placeholder="e.g., admin, user, guest"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="target_function" className="text-sm">Target Function</Label>
                  <Input
                    id="target_function"
                    {...register("target_function")}
                    placeholder="Function being chained to"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-semibold text-foreground">Full Body Request</h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="full_body" className="text-sm">
                  Request Body (JSON) <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="full_body"
                  {...register("full_body")}
                  placeholder='{"function_name": "send_email", "function_result": {...}, ...}'
                  className="font-mono text-sm min-h-[300px] resize-y"
                  disabled={isLoading}
                />
                {errors.full_body && (
                  <p className="text-xs text-destructive">{errors.full_body.message as string}</p>
                )}
              </div>
            </div>
          )}

          {/* Analysis Options Section - Collapsible */}
          {requestMode === "function" && (
            <Collapsible defaultOpen={false} className="flex flex-col gap-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer [&[data-state=open]>svg]:rotate-180">
              <h3 className="text-sm font-semibold text-foreground">Analysis Options</h3>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-3 pt-2">
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="input_analysis" className="text-sm">Input Analysis</Label>
                  <p className="text-xs text-muted-foreground">Stage 1: Prompt Guard</p>
                </div>
                <Controller
                  control={control}
                  name="input_analysis"
                  render={({ field }) => (
                    <Switch id="input_analysis" checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} />
                  )}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="llm_analysis" className="text-sm">LLM Analysis</Label>
                  <p className="text-xs text-muted-foreground">Stage 2: Structured Analysis</p>
                </div>
                <Controller
                  control={control}
                  name="llm_analysis"
                  render={({ field }) => (
                    <Switch id="llm_analysis" checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} />
                  )}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="quarantine_analysis" className="text-sm">Quarantine Analysis</Label>
                  <p className="text-xs text-muted-foreground">Stage 3: Infection Simulation</p>
                </div>
                <Controller
                  control={control}
                  name="quarantine_analysis"
                  render={({ field }) => (
                    <Switch
                      id="quarantine_analysis"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="quick_analysis" className="text-sm">Quick Analysis</Label>
                  <p className="text-xs text-muted-foreground">Simplified output</p>
                </div>
                <Controller
                  control={control}
                  name="quick_analysis"
                  render={({ field }) => (
                    <Switch id="quick_analysis" checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} />
                  )}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="enable_keyword_detection" className="text-sm">Keyword Detection</Label>
                  <p className="text-xs text-muted-foreground">Detect sensitive keywords</p>
                </div>
                <Controller
                  control={control}
                  name="enable_keyword_detection"
                  render={({ field }) => (
                    <Switch
                      id="enable_keyword_detection"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
              </div>

              {enableKeywordDetection && (
                <div className="flex flex-col gap-2 pt-3 border-t">
                  <Label htmlFor="keywords" className="text-sm">Custom Keywords</Label>
                  <Input
                    id="keywords"
                    {...register("keywords")}
                    placeholder="password, secret, api_key, token"
                    disabled={isLoading}
                    className="h-8"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list</p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          )}
        </div>
      </div>
    </form>
  );
}

