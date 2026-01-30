"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RoleSetup from "./role-setup";

interface CreateFirstWorkspaceAndProjectProps {
  name?: string | null;
}

type OnboardingStep = "workspace" | "roles";

export default function CreateFirstWorkspaceAndProject({ name }: CreateFirstWorkspaceAndProjectProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("workspace");
  const [workspaceName, setWorkspaceName] = useState(name ? `${name}'s workspace` : "");
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleWorkspaceCreation = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: workspaceName,
          projectName,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create workspace");
      }

      const newWorkspace = (await res.json()) as {
        id: string;
        name: string;
        tierName: string;
        projectId?: string
      };

      if (newWorkspace.projectId) {
        setProjectId(newWorkspace.projectId);
        setCurrentStep("roles");
      } else {
        // If no project was created, redirect to workspace
        router.push(`/workspace/${newWorkspace.id}`);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error during workspace creation:", error);
      setIsLoading(false);
    }
  };

  const handleRoleSetupComplete = async (roles: Record<string, { permissions: string[]; description: string }>) => {
    if (!projectId) {
      console.error("No project ID available");
      return;
    }

    setIsLoading(true);

    try {
      // Create a default policy with the configured roles
      const res = await fetch(`/api/projects/${projectId}/policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          policy_key: "default",
          name: "Default Policy",
          description: "Default security policy created during onboarding",
          roles,
          functions: {},
          severity_rules: {
            safe: { allow_function_calls: true, allow_output_use: true, block: false },
            low: { allow_function_calls: true, allow_output_use: true, block: false },
            medium: { allow_function_calls: false, allow_output_use: true, block: false },
            high: { allow_function_calls: false, allow_output_use: false, block: true },
            critical: { allow_function_calls: false, allow_output_use: false, block: true }
          },
          is_default: true,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to create policy:", errorText);
        // Don't fail the onboarding if policy creation fails - continue to dashboard
      }

      router.push(`/project/${projectId}/traces`);
    } catch (error) {
      console.error("Error creating policy:", error);
      // Even if policy creation fails, redirect to dashboard
      router.push(`/project/${projectId}/traces`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipRoleSetup = () => {
    if (projectId) {
      router.push(`/project/${projectId}/traces`);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center pb-16 px-4">
      {currentStep === "workspace" ? (
        <div className="w-full max-w-md border bg-secondary p-8 rounded">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-6">
              <Link className="inline-block" href="/">
                <Image
                  alt="Hipocap Logo"
                  src="/images/logo.webp"
                  width={180}
                  height={80}
                  className="mx-auto"
                />
              </Link>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Let's set up your workspace and first project to get started
            </p>
          </div>
          <form onSubmit={handleWorkspaceCreation} className="grid gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="workspace-name" className="text-xs font-medium">
                Workspace Name
              </Label>
              <Input
                id="workspace-name"
                type="text"
                placeholder="Enter workspace name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="project-name" className="text-xs font-medium">
                Project Name
              </Label>
              <Input
                id="project-name"
                type="text"
                placeholder="Enter project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!workspaceName || !projectName || isLoading}
                className="self-end align-end w-fit"
              >
                {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                Continue
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <RoleSetup
          onComplete={handleRoleSetupComplete}
          onSkip={handleSkipRoleSetup}
        />
      )}

      {isLoading && currentStep === "roles" && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Setting up your security policy...</p>
          </div>
        </div>
      )}
    </div>
  );
}
