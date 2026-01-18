"use client";

import { Edit, Trash2, Shield, ShieldCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Policy, deletePolicy } from "@/lib/actions/policies";
import { useToast } from "@/lib/hooks/use-toast";

import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface PolicyListProps {
  policies: Policy[];
  onRefresh: () => void;
}

export default function PolicyList({ policies, onRefresh }: PolicyListProps) {
  const { projectId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [deletingPolicyId, setDeletingPolicyId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (policy: Policy) => {
    router.push(`/project/${projectId}/policies/${policy.policy_key}`);
  };

  const handleDelete = async (policyId: number) => {
    setIsDeleting(true);
    try {
      await deletePolicy(projectId as string, policyId);
      toast({
        title: "Policy deleted",
        description: "The policy has been successfully deleted.",
      });
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete policy",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletingPolicyId(null);
    }
  };

  if (policies.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No policies found</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first policy to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {policies.map((policy) => (
          <Card key={policy.id} className="hover:bg-accent/50 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg">{policy.name}</CardTitle>
                    {policy.is_default && (
                      <Badge variant="default" className="text-xs">
                        Default
                      </Badge>
                    )}
                    {policy.is_active ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <span className="font-mono text-xs">{policy.policy_key}</span>
                    {policy.description && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span>{policy.description}</span>
                      </>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(policy)}
                    className="h-8"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingPolicyId(policy.id)}
                    className="h-8 text-destructive hover:text-destructive"
                    disabled={policy.is_default}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {policy.roles && Object.keys(policy.roles).length > 0 && (
                  <div>
                    <span className="font-medium">Roles:</span> {Object.keys(policy.roles).length}
                  </div>
                )}
                {policy.functions && Object.keys(policy.functions).length > 0 && (
                  <div>
                    <span className="font-medium">Functions:</span> {Object.keys(policy.functions).length}
                  </div>
                )}
                {policy.severity_rules && Object.keys(policy.severity_rules).length > 0 && (
                  <div>
                    <span className="font-medium">Severity Rules:</span> {Object.keys(policy.severity_rules).length}
                  </div>
                )}
                <div className="ml-auto text-xs">
                  Created: {new Date(policy.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deletingPolicyId !== null} onOpenChange={(open) => !open && setDeletingPolicyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this policy? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPolicyId && handleDelete(deletingPolicyId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
