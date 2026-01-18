"use client";

import { ChevronDown, Loader2, Play, RotateCcw, Sparkles, Settings } from "lucide-react";
import { Controller, Control, UseFormRegister, FieldErrors, UseFormReset } from "react-hook-form";

import { Policy } from "@/lib/actions/policies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { AnalysisFormData } from "./analysis-form";

interface AnalysisToolbarProps {
  control: Control<AnalysisFormData>;
  register: UseFormRegister<AnalysisFormData>;
  errors: FieldErrors<AnalysisFormData>;
  requestMode: "function" | "full_body";
  isLoading: boolean;
  policies?: Policy[];
  policiesLoading: boolean;
  policiesError?: Error;
  onReset: () => void;
  onLoadPreset: (preset: { name: string; data: Partial<AnalysisFormData> }) => void;
  examplePresets: Array<{ name: string; data: Partial<AnalysisFormData> }>;
}

export function AnalysisToolbar({
  control,
  register,
  errors,
  requestMode,
  isLoading,
  policies,
  policiesLoading,
  policiesError,
  onReset,
  onLoadPreset,
  examplePresets,
}: AnalysisToolbarProps) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 border-b bg-background flex-nowrap overflow-x-auto shadow-sm">
      {/* Configuration Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "gap-2 flex-shrink-0 p-4",
              (errors.backend_url || errors.api_key) && "border-destructive"
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuration</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="toolbar_backend_url" className="text-sm font-medium">
                Backend URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="toolbar_backend_url"
                {...register("backend_url")}
                placeholder="http://localhost:8000"
                disabled={isLoading}
                className={cn("h-8", errors.backend_url && "border-destructive")}
              />
              {errors.backend_url && (
                <p className="text-xs text-destructive">{errors.backend_url.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="toolbar_api_key" className="text-sm font-medium">
                API Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="toolbar_api_key"
                type="password"
                {...register("api_key")}
                placeholder="Your hipocap API key"
                disabled={isLoading}
                className={cn("h-8", errors.api_key && "border-destructive")}
              />
              {errors.api_key && (
                <p className="text-xs text-destructive">{errors.api_key.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="toolbar_policy_key" className="text-sm font-medium">
                Policy
              </Label>
              <Controller
                control={control}
                name="policy_key"
                render={({ field }) => (
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(value) => {
                      field.onChange(value === "__none__" ? "" : value);
                    }}
                    disabled={isLoading || policiesLoading}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select a policy (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (use default)</SelectItem>
                      {policies
                        ?.filter((p) => p.is_active)
                        .map((policy) => (
                          <SelectItem key={policy.policy_key} value={policy.policy_key}>
                            {policy.name} {policy.is_default && "(default)"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {policiesError && (
                <p className="text-xs text-muted-foreground">
                  Failed to load policies. Using default policy.
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Request Mode Toggle */}
      {/* <Controller
        control={control}
        name="request_mode"
        render={({ field }) => (
          <div className="flex items-center gap-1 border rounded-md p-1 bg-background flex-shrink-0">
            <Button
              type="button"
              variant={field.value === "function" ? "default" : "ghost"}
              size="sm"
              onClick={() => field.onChange("function")}
              disabled={isLoading}
              className="h-7 px-3"
            >
              Function
            </Button>
            <Button
              type="button"
              variant={field.value === "full_body" ? "default" : "ghost"}
              size="sm"
              onClick={() => field.onChange("full_body")}
              disabled={isLoading}
              className="h-7 px-3"
            >
              Full Body
            </Button>
          </div>
        )}
      /> */}

      {/* Example Presets */}
      {/* {requestMode === "function" && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Sparkles className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {examplePresets.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onLoadPreset(preset)}
              disabled={isLoading}
              className="h-7 flex-shrink-0"
            >
              {preset.name}
            </Button>
          ))}
        </div>
      )} */}

      {/* Action Buttons - Right aligned */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isLoading}
          className="h-7 gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
        <Button
          type="submit"
          form="analysis-form"
          disabled={isLoading}
          size="sm"
          className="h-7 gap-1.5"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Analyzing...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Run Analysis</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
