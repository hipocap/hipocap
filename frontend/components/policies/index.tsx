"use client";

import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { Policy, listPolicies } from "@/lib/actions/policies";
import { swrFetcher } from "@/lib/utils";

import { Button } from "../ui/button";
import PolicyForm from "./policy-form";
import PolicyList from "./policy-list";

export default function Policies() {
  const { projectId } = useParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const {
    data: policies,
    error,
    isLoading,
    mutate,
  } = useSWR<Policy[]>(`/api/projects/${projectId}/policies`, swrFetcher);

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    mutate();
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage security policies for Hipocap analysis
          </p>
        </div>
        <PolicyForm open={isFormOpen} onOpenChange={setIsFormOpen} onSuccess={handleFormSuccess} />
        <Button onClick={() => setIsFormOpen(true)} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Create Policy
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load policies: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {!error && (
        <PolicyList policies={policies || []} onRefresh={() => mutate()} />
      )}
    </div>
  );
}

