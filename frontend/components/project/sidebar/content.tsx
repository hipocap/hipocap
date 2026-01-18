"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";

import { getSidebarMenus } from "@/components/project/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { ProjectDetails } from "@/lib/actions/project";

const UsageDisplay = ({
  gbUsed,
  gbLimit,
  workspaceId,
  open,
}: {
  gbUsed: number;
  gbLimit: number;
  workspaceId: string;
  open: boolean;
}) => {
  const formatGB = (gb: number) => {
    if (gb < 0.001) {
      return `${(gb * 1024).toFixed(0)} MB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  const usagePercentage = gbLimit > 0 ? Math.min((gbUsed / gbLimit) * 100, 100) : 0;
  const title = `${formatGB(gbUsed)} of ${formatGB(gbLimit)}`;

  if (!open) return null;

  return (
    <div className="p-2 rounded-lg border bg-muted/30 text-xs">
      <div className="text-muted-foreground mb-2">Free plan usage</div>
      <div className="flex flex-col gap-2">
        <div title={title} className="font-medium truncate">
          {title}
        </div>
        <Progress value={usagePercentage} className="h-1" />
        <Link href={`/workspace/${workspaceId}?tab=usage`}>
          <Button className="w-full h-6">Upgrade</Button>
        </Link>
      </div>
    </div>
  );
};

const ProjectSidebarContent = ({
  details: { id, workspaceId, isFreeTier, gbUsedThisMonth, gbLimit },
}: {
  details: ProjectDetails;
}) => {
  const pathname = usePathname();
  const categories = useMemo(() => getSidebarMenus(id), [id]);
  const { open, openMobile } = useSidebar();

  return (
    <SidebarContent>
      {categories.map((category, categoryIndex) => (
        <React.Fragment key={category.name}>
          {categoryIndex > 0 && <SidebarSeparator />}
          <SidebarGroup>
            {category.name && <SidebarGroupLabel>{category.name}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {category.items.map((option) => (
                  <SidebarMenuItem className="h-8" key={option.name}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(option.href)} tooltip={option.name}>
                      <Link href={option.href}>
                        <option.icon />
                        <span>{option.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </React.Fragment>
      ))}

      {isFreeTier && (open || openMobile) && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <UsageDisplay
                  gbUsed={gbUsedThisMonth}
                  gbLimit={gbLimit}
                  workspaceId={workspaceId}
                  open={open || openMobile}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </SidebarContent>
  );
};

export default ProjectSidebarContent;
