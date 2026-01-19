"use client";

import { Edit, Trash2, Shield, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Shield as ShieldType, deleteShield } from "@/lib/actions/shields";
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

interface ShieldListProps {
  shields: ShieldType[];
  onRefresh: () => void;
  onEdit: (shield: ShieldType) => void;
}

export default function ShieldList({ shields, onRefresh, onEdit }: ShieldListProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [deletingShieldId, setDeletingShieldId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (shieldId: number) => {
    setIsDeleting(true);
    try {
      await deleteShield(projectId as string, shieldId);
      toast({
        title: "Shield deleted",
        description: "The shield has been successfully deleted.",
      });
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete shield",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletingShieldId(null);
    }
  };

  if (shields.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No shields found</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first shield to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {shields.map((shield) => (
          <Card key={shield.id} className="hover:bg-accent/50 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg">{shield.name}</CardTitle>
                    {shield.is_active ? (
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
                    <span className="font-mono text-xs">{shield.shield_key}</span>
                    {shield.description && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span>{shield.description}</span>
                      </>
                    )}
                  </CardDescription>
                  {shield.prompt_description && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p className="line-clamp-2">{shield.prompt_description}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(shield)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingShieldId(shield.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <AlertDialog open={deletingShieldId !== null} onOpenChange={(open) => !open && setDeletingShieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shield</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shield? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingShieldId && handleDelete(deletingShieldId)}
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

