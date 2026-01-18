"use client";

import { Activity, FolderClosed, LucideIcon, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar.tsx";
import { useWorkspaceMenuContext, WorkspaceMenu } from "@/components/workspace/workspace-menu-provider.tsx";
import { cn } from "@/lib/utils.ts";

const mainMenus: { name: string; value: WorkspaceMenu; icon: LucideIcon }[] = [
  {
    name: "Projects",
    value: "projects",
    icon: FolderClosed,
  },
  {
    name: "Usage",
    value: "usage",
    icon: Activity,
  },
  {
    name: "Team",
    value: "team",
    icon: Users,
  },
];

const settingsMenus: { name: string; value: WorkspaceMenu; icon: LucideIcon }[] = [
  {
    name: "Settings",
    value: "settings",
    icon: Settings,
  },
];

interface WorkspaceSidebarContentProps {
  isOwner: boolean;
  workspaceFeatureEnabled: boolean;
}

export const WorkspaceSidebarContent = ({ isOwner, workspaceFeatureEnabled }: WorkspaceSidebarContentProps) => {
  const { menu, setMenu } = useWorkspaceMenuContext();
  const pathName = usePathname();
  const filteredMainMenus = useMemo(() => {
    if (!workspaceFeatureEnabled) {
      return mainMenus.filter((m) => m.value === "projects");
    }
    return mainMenus;
  }, [workspaceFeatureEnabled]);

  const filteredSettingsMenus = useMemo(() => {
    if (!workspaceFeatureEnabled) {
      return [];
    }
    return isOwner ? settingsMenus : [];
  }, [isOwner, workspaceFeatureEnabled]);

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Main</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filteredMainMenus.map((m) => (
              <SidebarMenuItem className="h-7" key={m.name}>
                <SidebarMenuButton
                  className={cn({
                    "bg-accent": m.value === menu,
                  })}
                  onClick={() => setMenu(m.value)}
                  asChild
                >
                  <Link href={`${pathName}?tab=${m.value}`}>
                    <m.icon />
                    <span>{m.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {filteredSettingsMenus.length > 0 && (
        <>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSettingsMenus.map((m) => (
                  <SidebarMenuItem className="h-7" key={m.name}>
                    <SidebarMenuButton
                      className={cn({
                        "bg-accent": m.value === menu,
                      })}
                      onClick={() => setMenu(m.value)}
                      asChild
                    >
                      <Link href={`${pathName}?tab=${m.value}`}>
                        <m.icon />
                        <span>{m.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </>
      )}
    </SidebarContent>
  );
};

export default WorkspaceSidebarContent;
