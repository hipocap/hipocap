"use client";

import { AlertCircle, Shield, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { swrFetcher } from "@/lib/utils";

interface HipocapStats {
  total: number;
  blocked: number;
  allowed: number;
  review_required: number;
  by_function: Record<string, { blocked: number; allowed: number; review_required: number; total: number }>;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  href?: string;
  percentage?: number;
}

function StatCard({ title, value, icon, colorClass, href, percentage }: StatCardProps) {
  const content = (
    <Card className="border rounded-lg h-full border-border hover:border-primary/50 transition-all cursor-pointer bg-card hover:bg-card/80 shadow-sm">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-start justify-between gap-4 h-full">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-3 leading-tight font-medium">{title}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className={`text-3xl font-bold ${colorClass} leading-none`}>{value.toLocaleString()}</p>
              {percentage !== undefined && percentage > 0 && (
                <p className={`text-sm ${colorClass} opacity-80 leading-tight font-medium`}>({percentage.toFixed(1)}%)</p>
              )}
            </div>
          </div>
          <div className={`${colorClass} opacity-40 flex-shrink-0 transition-opacity hover:opacity-60`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default function HipocapStatsCards() {
  const { projectId } = useParams();
  const searchParams = useSearchParams();

  // Get date range from URL params
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const pastHours = searchParams.get("pastHours");

  // Build API URL with date range
  const apiUrl = (() => {
    const url = `/api/projects/${projectId}/hipocap/traces/stats`;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      // Convert ISO strings to YYYY-MM-DD format
      const start = new Date(startDate);
      const end = new Date(endDate);
      params.set("start_date", start.toISOString().split("T")[0]);
      params.set("end_date", end.toISOString().split("T")[0]);
    } else if (pastHours) {
      // Calculate start_date from pastHours
      const hours = parseInt(pastHours, 10);
      const start = new Date();
      start.setHours(start.getHours() - hours);
      params.set("start_date", start.toISOString().split("T")[0]);
    }

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  })();

  const { data, error, isLoading } = useSWR<HipocapStats>(apiUrl, swrFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently fail - don't show cards if there's an error
  }

  const total = data.total || 0;
  const blocked = data.blocked || 0;
  const allowed = data.allowed || 0;
  const reviewRequired = data.review_required || 0;

  // Calculate percentages
  const blockedPercentage = total > 0 ? (blocked / total) * 100 : 0;
  const allowedPercentage = total > 0 ? (allowed / total) * 100 : 0;
  const reviewPercentage = total > 0 ? (reviewRequired / total) * 100 : 0;

  // Build navigation URLs with filters
  const buildTracesUrl = (decision?: string) => {
    const params = new URLSearchParams();
    params.set("view", "function-traces");
    if (decision) {
      params.set("filter", `final_decision:${decision}`);
    }
    // Preserve date range
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (pastHours) params.set("pastHours", pastHours);
    return `/project/${projectId}/traces?${params.toString()}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <StatCard
        title="Total Functions Analyzed"
        value={total}
        icon={<Shield className="h-8 w-8" />}
        colorClass="text-foreground"
        href={buildTracesUrl()}
      />
      <StatCard
        title="Blocked Functions"
        value={blocked}
        icon={<ShieldX className="h-8 w-8" />}
        colorClass="text-destructive"
        href={buildTracesUrl("BLOCKED")}
        percentage={blockedPercentage}
      />
      <StatCard
        title="Allowed Functions"
        value={allowed}
        icon={<ShieldCheck className="h-8 w-8" />}
        colorClass="text-success"
        href={buildTracesUrl("ALLOWED")}
        percentage={allowedPercentage}
      />
      {reviewRequired > 0 && (
        <StatCard
          title="Review Required"
          value={reviewRequired}
          icon={<AlertCircle className="h-8 w-8" />}
          colorClass="text-[hsl(var(--chart-3))]"
          href={buildTracesUrl("REVIEW_REQUIRED")}
          percentage={reviewPercentage}
        />
      )}
    </div>
  );
}

