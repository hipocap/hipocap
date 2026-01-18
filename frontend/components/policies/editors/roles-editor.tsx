"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { useParams } from "next/navigation";

import { Policy, updatePolicy, deleteRole } from "@/lib/actions/policies";
import { useToast } from "@/lib/hooks/use-toast";
import { useAutoSave } from "@/lib/hooks/use-auto-save";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";

interface RolesEditorProps {
  policy: Policy;
  roles: Record<string, { permissions: string[]; description?: string }>;
  onChange: (roles: Record<string, { permissions: string[]; description?: string }>) => void;
  onPolicyUpdate: (updatedPolicy: Policy) => void;
}

export default function RolesEditor({ policy, roles, onChange, onPolicyUpdate }: RolesEditorProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Local state for roles - syncs with props but used for auto-save
  const [localRoles, setLocalRoles] = useState<Record<string, { permissions: string[]; description?: string }>>(roles);
  
  // Sync local state with props when props change (e.g., after deletion)
  useEffect(() => {
    setLocalRoles(roles);
  }, [roles]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  // Get all available functions from policy
  const availableFunctions = Object.keys(policy.functions || {});
  const allOptions = ["*", ...availableFunctions];

  // Use refs to ensure we always use the latest values in the save callback
  const policyIdRef = useRef(policy.id);
  const projectIdRef = useRef(projectId as string);
  
  useEffect(() => {
    policyIdRef.current = policy.id;
    projectIdRef.current = projectId as string;
  }, [policy.id, projectId]);

  // Memoize the save callback to prevent recreating it on every render
  const handleAutoSave = useCallback(
    async (updatedRoles: typeof localRoles) => {
      try {
        await updatePolicy(projectIdRef.current, policyIdRef.current, { roles: updatedRoles });
        toast({
          title: "Roles saved",
          description: "Changes have been automatically saved.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save roles",
          variant: "destructive",
        });
        throw error;
      }
    },
    [] // Empty deps - we use refs for latest values
  );

  // Auto-save when local roles change
  const { isSaving } = useAutoSave(localRoles, {
    delay: 1000,
    enabled: true,
    onSave: handleAutoSave,
  });

  const handleAddRole = () => {
    setFormData({ name: "", description: "", permissions: [] });
    setEditingRole(null);
    setIsDialogOpen(true);
  };

  const handleEditRole = (roleName: string) => {
    const role = roles[roleName];
    setFormData({
      name: roleName,
      description: role.description || "",
      permissions: role.permissions || [],
    });
    setEditingRole(roleName);
    setIsDialogOpen(true);
  };

  const handleDeleteRole = (roleName: string) => {
    setRoleToDelete(roleName);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    
    try {
      const updatedPolicy = await deleteRole(projectId as string, policy.id, roleToDelete);
      onPolicyUpdate(updatedPolicy);
      toast({
        title: "Role deleted",
        description: `Role "${roleToDelete}" has been deleted.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete role",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    const updatedRoles = { ...localRoles };
    updatedRoles[formData.name] = {
      permissions: formData.permissions,
      description: formData.description || undefined,
    };

    // If editing and name changed, remove old role
    if (editingRole && editingRole !== formData.name) {
      delete updatedRoles[editingRole];
    }

    // Update local state first, then notify parent
    setLocalRoles(updatedRoles);
    onChange(updatedRoles);
    setIsDialogOpen(false);
    setEditingRole(null);
  };

  const togglePermission = (permission: string) => {
    setFormData((prev) => {
      const permissions = prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission];
      return { ...prev, permissions };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Roles</h3>
          <p className="text-sm text-muted-foreground">
            Define roles and their permissions. Use "*" to grant all permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <Badge variant="secondary" className="text-xs">
              Saving...
            </Badge>
          )}
          <Button onClick={handleAddRole} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </div>
      </div>

      {Object.keys(localRoles).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground mb-4">No roles defined</p>
            <Button onClick={handleAddRole} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Role
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {Object.entries(localRoles).map(([roleName, role]) => (
            <Card key={roleName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{roleName}</CardTitle>
                    {role.description && (
                      <CardDescription className="mt-1">{role.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRole(roleName)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRole(roleName)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.length === 0 ? (
                    <Badge variant="outline">No permissions</Badge>
                  ) : role.permissions.includes("*") ? (
                    <Badge variant="default">All permissions (*)</Badge>
                  ) : (
                    role.permissions.map((perm) => (
                      <Badge key={perm} variant="secondary">
                        {perm}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update the role configuration"
                : "Create a new role with specific permissions"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., developer, admin, user"
                disabled={!!editingRole}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this role is for..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto">
                {allOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perm-${option}`}
                      checked={formData.permissions.includes(option)}
                      onCheckedChange={() => togglePermission(option)}
                    />
                    <Label
                      htmlFor={`perm-${option}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {option === "*" ? "All permissions (*)" : option}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select "*" to grant all permissions, or select specific functions.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              <Save className="h-4 w-4 mr-2" />
              {editingRole ? "Update" : "Add"} Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

