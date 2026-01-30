"use client";

import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Role {
    name: string;
    permissions: string[];
    description: string;
}

interface RoleSetupProps {
    onComplete: (roles: Record<string, { permissions: string[]; description: string }>) => void;
    onSkip: () => void;
}

const COMMON_PERMISSIONS = [
    "get_mail",
    "send_mail",
    "get_weather",
    "search_web",
    "read_file",
    "write_file",
    "execute_command",
    "manage_database",
];

const DEFAULT_ROLES: Role[] = [
    {
        name: "admin",
        permissions: ["*"],
        description: "Full access to all functions"
    },
    {
        name: "user",
        permissions: ["get_mail", "get_weather", "search_web", "read_file"],
        description: "Standard user with common permissions"
    },
    {
        name: "guest",
        permissions: [],
        description: "Limited guest access"
    }
];

export default function RoleSetup({ onComplete, onSkip }: RoleSetupProps) {
    const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
    const [newRoleName, setNewRoleName] = useState("");
    const [selectedRoleIndex, setSelectedRoleIndex] = useState<number | null>(null);

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;

        const roleExists = roles.some(r => r.name.toLowerCase() === newRoleName.toLowerCase());
        if (roleExists) {
            alert("Role with this name already exists");
            return;
        }

        setRoles([...roles, {
            name: newRoleName.trim(),
            permissions: [],
            description: ""
        }]);
        setNewRoleName("");
    };

    const handleDeleteRole = (index: number) => {
        setRoles(roles.filter((_, i) => i !== index));
        if (selectedRoleIndex === index) {
            setSelectedRoleIndex(null);
        }
    };

    const handleTogglePermission = (roleIndex: number, permission: string) => {
        const updatedRoles = [...roles];
        const role = updatedRoles[roleIndex];

        // If "*" is in permissions, it means all permissions
        if (role.permissions.includes("*")) {
            // Remove "*" and add all individual permissions except the one being toggled
            role.permissions = COMMON_PERMISSIONS.filter(p => p !== permission);
        } else if (role.permissions.includes(permission)) {
            role.permissions = role.permissions.filter(p => p !== permission);
        } else {
            role.permissions.push(permission);
        }

        setRoles(updatedRoles);
    };

    const handleUpdateDescription = (roleIndex: number, description: string) => {
        const updatedRoles = [...roles];
        updatedRoles[roleIndex].description = description;
        setRoles(updatedRoles);
    };

    const handleComplete = () => {
        const rolesObject = roles.reduce((acc, role) => {
            acc[role.name] = {
                permissions: role.permissions,
                description: role.description || `Role: ${role.name}`
            };
            return acc;
        }, {} as Record<string, { permissions: string[]; description: string }>);

        onComplete(rolesObject);
    };

    const selectedRole = selectedRoleIndex !== null ? roles[selectedRoleIndex] : null;
    const hasAllPermissions = selectedRole?.permissions.includes("*");

    return (
        <div className="w-full max-w-4xl border bg-secondary p-8 rounded">
            <div className="mb-6">
                <h2 className="text-2xl font-semibold mb-2">Configure Security Roles</h2>
                <p className="text-sm text-muted-foreground">
                    Define roles and their permissions for your Hipocap security policies. This will determine what actions different users can perform.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Panel - Role List */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium">Roles</Label>
                        <div className="border rounded-md bg-background p-2 max-h-64 overflow-y-auto">
                            {roles.map((role, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent ${selectedRoleIndex === index ? "bg-accent" : ""
                                        }`}
                                    onClick={() => setSelectedRoleIndex(index)}
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{role.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {role.permissions.includes("*")
                                                ? "All permissions"
                                                : `${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''}`
                                            }
                                        </div>
                                    </div>
                                    {selectedRoleIndex === index && (
                                        <Check className="h-4 w-4 text-primary" />
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRole(index);
                                        }}
                                        className="ml-2 h-8 w-8 p-0"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Input
                            placeholder="New role name"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddRole()}
                        />
                        <Button onClick={handleAddRole} size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                        </Button>
                    </div>
                </div>

                {/* Right Panel - Role Details */}
                <div className="flex flex-col gap-4">
                    {selectedRole ? (
                        <>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="role-desc" className="text-xs font-medium">
                                    Description
                                </Label>
                                <Input
                                    id="role-desc"
                                    placeholder="Role description"
                                    value={selectedRole.description}
                                    onChange={(e) => handleUpdateDescription(selectedRoleIndex!, e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-medium">Permissions</Label>
                                <div className="border rounded-md bg-background p-3 max-h-64 overflow-y-auto">
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`perm-all-${selectedRoleIndex}`}
                                                checked={hasAllPermissions}
                                                onCheckedChange={(checked) => {
                                                    const updatedRoles = [...roles];
                                                    updatedRoles[selectedRoleIndex!].permissions = checked ? ["*"] : [];
                                                    setRoles(updatedRoles);
                                                }}
                                            />
                                            <label
                                                htmlFor={`perm-all-${selectedRoleIndex}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                All Permissions (*)
                                            </label>
                                        </div>

                                        <div className="h-px bg-border my-2" />

                                        {COMMON_PERMISSIONS.map((permission) => (
                                            <div key={permission} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`perm-${selectedRoleIndex}-${permission}`}
                                                    checked={hasAllPermissions || selectedRole.permissions.includes(permission)}
                                                    disabled={hasAllPermissions}
                                                    onCheckedChange={() => handleTogglePermission(selectedRoleIndex!, permission)}
                                                />
                                                <label
                                                    htmlFor={`perm-${selectedRoleIndex}-${permission}`}
                                                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {permission}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                            Select a role to configure permissions
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={onSkip}>
                    Skip for Now
                </Button>
                <Button onClick={handleComplete}>
                    Continue with These Roles
                </Button>
            </div>
        </div>
    );
}
