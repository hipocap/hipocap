"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Control, UseFormRegister, FieldErrors, UseFormWatch, UseFormReset, UseFormHandleSubmit, UseFormSetValue, useWatch } from "react-hook-form";

import { HipocapAnalysisResponse } from "@/lib/hipocap/types";
import { Policy } from "@/lib/actions/policies";
import { swrFetcher, cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AnalysisForm, AnalysisFormData } from "./analysis-form";
import { AnalysisResults } from "./analysis-results";
import { AnalysisToolbar } from "./analysis-toolbar";

export function HipocapAnalysisPlayground() {
  const params = useParams();
  const [result, setResult] = useState<HipocapAnalysisResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [formControls, setFormControls] = useState<{
    control: Control<AnalysisFormData>;
    register: UseFormRegister<AnalysisFormData>;
    errors: FieldErrors<AnalysisFormData>;
    watch: UseFormWatch<AnalysisFormData>;
    reset: UseFormReset<AnalysisFormData>;
    handleSubmit: UseFormHandleSubmit<AnalysisFormData>;
    setValue: UseFormSetValue<AnalysisFormData>;
    examplePresets: Array<{ name: string; data: Partial<AnalysisFormData> }>;
    loadPreset: (preset: { name: string; data: Partial<AnalysisFormData> }) => void;
    handleReset: () => void;
    isLoading: boolean;
    requestMode: "function" | "full_body";
  } | null>(null);

  // Fetch policies
  const {
    data: policies,
    error: policiesError,
    isLoading: policiesLoading,
  } = useSWR<Policy[]>(`/api/projects/${params?.projectId}/policies`, swrFetcher);

  const handleResult = (analysisResult: HipocapAnalysisResponse) => {
    setResult(analysisResult);
    setError("");
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setResult(null);
  };

  const handleFormReady = useCallback((controls: NonNullable<typeof formControls>) => {
    setFormControls(controls);
  }, []);

  // Get requestMode from formControls, with fallback
  const requestMode = formControls?.requestMode || "function";

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full w-full">
      {/* Sticky Top Navigation Bar - positioned below Header (h-12 = 48px) */}
      {formControls && (
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm">
          <AnalysisToolbar
            control={formControls.control}
            register={formControls.register}
            errors={formControls.errors}
            requestMode={requestMode}
            isLoading={formControls.isLoading}
            policies={policies}
            policiesLoading={policiesLoading}
            policiesError={policiesError}
            onReset={formControls.handleReset}
            onLoadPreset={formControls.loadPreset}
            examplePresets={formControls.examplePresets}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Desktop Layout - Side by Side (xl breakpoint = 1280px) */}
        <div className="hidden xl:flex flex-1 overflow-hidden w-full">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Left Panel - Form */}
          <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col overflow-hidden">
            <div className="flex flex-col h-full">
              {error && (
                <div className="p-4 pb-2">
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <AnalysisForm onResult={handleResult} onError={handleError} onFormReady={handleFormReady} />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Results */}
          <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                  {result ? (
                    <AnalysisResults result={result} />
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[400px] text-center">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-lg">No analysis results yet</p>
                        <p className="text-sm text-muted-foreground">
                          Fill out the form on the left and click "Run Analysis" to see results here
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>

        {/* Tablet/Mobile Layout - Tabs (below xl breakpoint) */}
        <div className="flex xl:hidden flex-1 flex-col overflow-hidden w-full">
        <Tabs defaultValue="form" className="flex-1 flex flex-col overflow-hidden w-full">
          <TabsList className="mx-4 mt-4 shrink-0">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          <TabsContent value="form" className="flex-1 flex flex-col overflow-hidden mt-0">
            <div className="flex flex-col h-full">
              {error && (
                <div className="p-4 pb-2">
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <AnalysisForm onResult={handleResult} onError={handleError} onFormReady={handleFormReady} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="results" className="flex-1 overflow-y-auto mt-0 pb-4">
            <div className="p-4">
              {result ? (
                <AnalysisResults result={result} />
              ) : (
                <div className="flex items-center justify-center h-full min-h-[400px] text-center">
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-lg">No analysis results yet</p>
                    <p className="text-sm text-muted-foreground">
                      Fill out the form and click "Run Analysis" to see results here
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}

