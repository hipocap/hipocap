"use client";

import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { Shield, listShields } from "@/lib/actions/shields";
import { swrFetcher } from "@/lib/utils";

import { Button } from "../ui/button";
import ShieldForm from "./shield-form";
import ShieldList from "./shield-list";

export default function Shields() {
  const { projectId } = useParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShield, setEditingShield] = useState<Shield | null>(null);
  const {
    data: shields,
    error,
    isLoading,
    mutate,
  } = useSWR<Shield[]>(`/api/projects/${projectId}/shields`, swrFetcher);

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingShield(null);
    mutate();
  };

  const handleEdit = (shield: Shield) => {
    setEditingShield(shield);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingShield(null);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shields</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage custom shields for prompt-based blocking rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShieldForm
            open={isFormOpen}
            onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open) {
                setEditingShield(null);
              }
            }}
            shield={editingShield}
            onSuccess={handleFormSuccess}
          />
          <Button onClick={handleCreate} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Create Shield
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load shields: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {!error && (
        <ShieldList
          shields={shields || []}
          onRefresh={() => mutate()}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}

