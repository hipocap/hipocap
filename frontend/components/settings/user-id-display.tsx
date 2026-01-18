"use client";

import { useUserContext } from "@/contexts/user-context";

import { CopyButton } from "../ui/copy-button";
import { SettingsSection, SettingsSectionHeader } from "./settings-section";

export default function UserIdDisplay() {
  const user = useUserContext();

  return (
    <SettingsSection>
      <SettingsSectionHeader
        size="sm"
        title="User ID"
        description="Your unique user identifier. Copy this ID to share with support or for API integrations."
      />
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
          {user.id}
        </div>
        <CopyButton text={user.id} size="default" variant="outline">
          Copy
        </CopyButton>
      </div>
    </SettingsSection>
  );
}















