"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

import { Shield, ShieldCreate, ShieldUpdate, createShield, updateShield } from "@/lib/actions/shields";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";

interface ShieldFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shield?: Shield | null;
  onSuccess: () => void;
}

export default function ShieldForm({ open, onOpenChange, shield, onSuccess }: ShieldFormProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const isEditing = !!shield;

  const [formData, setFormData] = useState({
    shield_key: "",
    name: "",
    description: "",
    prompt_description: "",
    what_to_block: "",
    what_not_to_block: "",
    is_active: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (shield) {
      setFormData({
        shield_key: shield.shield_key,
        name: shield.name,
        description: shield.description || "",
        prompt_description: shield.prompt_description,
        what_to_block: shield.what_to_block,
        what_not_to_block: shield.what_not_to_block,
        is_active: shield.is_active,
      });
    } else {
      setFormData({
        shield_key: "",
        name: "",
        description: "",
        prompt_description: "",
        what_to_block: "",
        what_not_to_block: "",
        is_active: true,
      });
    }
    setErrors({});
  }, [shield, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.shield_key.trim()) {
      newErrors.shield_key = "Shield key is required";
    } else if (!/^[a-z0-9_-]+$/.test(formData.shield_key)) {
      newErrors.shield_key = "Shield key can only contain lowercase letters, numbers, hyphens, and underscores";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.prompt_description.trim()) {
      newErrors.prompt_description = "Prompt description is required";
    }

    if (!formData.what_to_block.trim()) {
      newErrors.what_to_block = "What to block is required";
    }

    if (formData.what_not_to_block === undefined || formData.what_not_to_block === null) {
      newErrors.what_not_to_block = "What not to block is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Construct JSON content from the three text fields
      const content = JSON.stringify({
        prompt_description: formData.prompt_description,
        what_to_block: formData.what_to_block,
        what_not_to_block: formData.what_not_to_block,
      });

      if (isEditing && shield) {
        const updateData: ShieldUpdate = {
          name: formData.name,
          description: formData.description || undefined,
          content: content,
          is_active: formData.is_active,
        };
        await updateShield(projectId as string, shield.shield_key, updateData);
        toast({
          title: "Success",
          description: "Shield updated successfully",
        });
      } else {
        const createData: ShieldCreate = {
          shield_key: formData.shield_key,
          name: formData.name,
          description: formData.description || undefined,
          content: content,
        };
        await createShield(projectId as string, createData);
        toast({
          title: "Success",
          description: "Shield created successfully",
        });
      }

      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save shield",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Shield" : "Create Shield"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the shield configuration."
              : "Create a new shield with custom blocking rules. Define what to block and what not to block."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="shield_key">Shield Key *</Label>
              <Input
                id="shield_key"
                value={formData.shield_key}
                onChange={(e) => setFormData({ ...formData, shield_key: e.target.value })}
                placeholder="email_protection_shield"
                disabled={isLoading}
              />
              {errors.shield_key && <p className="text-sm text-destructive">{errors.shield_key}</p>}
              <p className="text-xs text-muted-foreground">
                Unique identifier for the shield (lowercase letters, numbers, hyphens, underscores only)
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Email Protection Shield"
              disabled={isLoading}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Shield to protect against email-based prompt injection attacks"
              rows={2}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt_description">Prompt Description *</Label>
            <Textarea
              id="prompt_description"
              value={formData.prompt_description}
              onChange={(e) => setFormData({ ...formData, prompt_description: e.target.value })}
              placeholder="Description of the prompt/use case for this shield"
              rows={3}
              disabled={isLoading}
            />
            {errors.prompt_description && <p className="text-sm text-destructive">{errors.prompt_description}</p>}
            <p className="text-xs text-muted-foreground">
              Describe the context or use case for this shield
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="what_to_block">What to Block *</Label>
            <Textarea
              id="what_to_block"
              value={formData.what_to_block}
              onChange={(e) => setFormData({ ...formData, what_to_block: e.target.value })}
              placeholder="Describe what should be blocked (patterns, keywords, behaviors, etc.)"
              rows={4}
              disabled={isLoading}
            />
            {errors.what_to_block && <p className="text-sm text-destructive">{errors.what_to_block}</p>}
            <p className="text-xs text-muted-foreground">
              Specify the content, patterns, or behaviors that should trigger blocking
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="what_not_to_block">What Not to Block *</Label>
            <Textarea
              id="what_not_to_block"
              value={formData.what_not_to_block}
              onChange={(e) => setFormData({ ...formData, what_not_to_block: e.target.value })}
              placeholder="Describe exceptions or content that should not be blocked"
              rows={4}
              disabled={isLoading}
            />
            {errors.what_not_to_block && <p className="text-sm text-destructive">{errors.what_not_to_block}</p>}
            <p className="text-xs text-muted-foreground">
              Specify exceptions, allowed patterns, or content that should never be blocked
            </p>
          </div>

          {isEditing && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
                disabled={isLoading}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

