"use client";

import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from "recharts";
import { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";

import { numberFormatter, selectNiceTicksFromData } from "@/components/chart-builder/charts/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { getGroupByInterval } from "@/lib/utils";
import { swrFetcher } from "@/lib/utils";

import useSWR from "swr";
import HipocapRoundedBar from "./hipocap-bar";

interface TimeSeriesDataPoint {
  timestamp: string;
  blocked: number;
  allowed: number;
}

const formatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

const countNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

const chartConfig = {
  blocked: {
    label: "Blocked",
    color: "hsl(var(--destructive))",
    stackId: "stack",
  },
  allowed: {
    label: "Allowed",
    color: "hsl(var(--success))",
    stackId: "stack",
  },
} as const;

const fields = ["blocked", "allowed"] as const;

function isValidZoomRange(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  return left !== right;
}

function normalizeTimeRange(left: string, right: string): { start: string; end: string } {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  
  const start = leftTime < rightTime ? left : right;
  const end = leftTime < rightTime ? right : left;
  
  return { start, end };
}

function getTickCountForWidth(width: number): number {
  if (width < 400) return 4;
  if (width < 600) return 6;
  if (width < 800) return 8;
  if (width < 1200) return 10;
  return 12;
}

export default function HipocapTimeSeriesChart() {
  const { projectId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [refArea, setRefArea] = useState<{ left?: string; right?: string }>({});

  // Get date range from URL params
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const pastHours = searchParams.get("pastHours");
  const groupByInterval = searchParams.get("groupByInterval");

  // Determine interval based on time range
  const interval = useMemo(() => {
    return getGroupByInterval(pastHours || undefined, startDate || undefined, endDate || undefined, groupByInterval || undefined);
  }, [pastHours, startDate, endDate, groupByInterval]);

  // Build API URL
  const apiUrl = useMemo(() => {
    const url = `/api/projects/${projectId}/hipocap/traces/timeseries`;
    const params = new URLSearchParams();
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      params.set("start_date", start.toISOString().split("T")[0]);
      params.set("end_date", end.toISOString().split("T")[0]);
    } else if (pastHours) {
      const hours = parseInt(pastHours, 10);
      const start = new Date();
      start.setHours(start.getHours() - hours);
      params.set("start_date", start.toISOString().split("T")[0]);
    }
    
    params.set("interval", interval);
    return `${url}?${params.toString()}`;
  }, [projectId, startDate, endDate, pastHours, interval]);

  const { data, error, isLoading } = useSWR<{ items: TimeSeriesDataPoint[] }>(apiUrl, swrFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const targetTickCount = useMemo(() => {
    if (!containerWidth) return 8;
    return getTickCountForWidth(containerWidth);
  }, [containerWidth]);

  const smartTicksResult = useMemo(() => {
    if (!data?.items || data.items.length === 0) return null;
    const timestamps = data.items.map((d) => d.timestamp);
    return selectNiceTicksFromData(timestamps, targetTickCount);
  }, [data, targetTickCount]);

  const totalCount = useMemo(() => {
    if (!data?.items || data.items.length === 0) return 0;
    return data.items.reduce((sum, d) => sum + d.blocked + d.allowed, 0);
  }, [data]);

  const zoom = useCallback(() => {
    if (!isValidZoomRange(refArea.left, refArea.right)) {
      setRefArea({});
      return;
    }

    const normalized = normalizeTimeRange(refArea.left!, refArea.right!);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pastHours");
    params.set("startDate", normalized.start);
    params.set("endDate", normalized.end);
    
    router.push(`${pathname}?${params.toString()}`);
    setRefArea({});
  }, [refArea.left, refArea.right, searchParams, router, pathname]);

  const onMouseDown: CategoricalChartFunc = useCallback((e) => {
    if (e && e.activeLabel) {
      setRefArea({ left: e.activeLabel });
    }
  }, []);

  const onMouseMove: CategoricalChartFunc = useCallback(
    (e) => {
      if (refArea.left && e && e.activeLabel) {
        setRefArea({ left: refArea.left, right: e.activeLabel });
      }
    },
    [refArea.left]
  );

  const BarShapeWithConfig = useCallback(
    (props: any) => <HipocapRoundedBar {...props} />,
    []
  );

  if (isLoading) {
    return (
      <div className="w-full border gap-2 rounded-lg p-4 border-dashed border-border bg-secondary">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data?.items || data.items.length === 0) {
    return null; // Silently fail - don't show chart if there's an error or no data
  }

  return (
    <div ref={containerRef} className="w-full border gap-2 rounded-lg p-4 border-dashed border-border bg-secondary mb-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium">Function Calls Over Time</h3>
        <p className="text-xs text-muted-foreground">Blocked and allowed function calls based on selected time range</p>
      </div>
      <div className="flex flex-col items-start w-full">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart
            data={data.items}
            margin={{ left: -8, top: 8 }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={zoom}
            barCategoryGap={2}
            style={{ userSelect: "none", cursor: "crosshair" }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickFormatter={smartTicksResult?.formatter}
              allowDataOverflow
              ticks={smartTicksResult?.ticks}
            />
            <YAxis tickLine={false} axisLine={false} tickFormatter={numberFormatter.format} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelKey="timestamp"
                  labelFormatter={(_, payload) =>
                    payload && payload[0] ? formatter.format(new Date(payload[0].payload.timestamp)) : "-"
                  }
                />
              }
            />
            <Bar dataKey="blocked" fill={chartConfig.blocked.color} stackId="stack" shape={BarShapeWithConfig} />
            <Bar dataKey="allowed" fill={chartConfig.allowed.color} stackId="stack" shape={BarShapeWithConfig} />
            {refArea.left && refArea.right && (
              <ReferenceArea
                x1={refArea.left}
                x2={refArea.right}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
            )}
          </BarChart>
        </ChartContainer>
        <div className="text-xs text-muted-foreground text-center mt-2" title={String(totalCount)}>
          Total: {countNumberFormatter.format(totalCount)}
        </div>
      </div>
    </div>
  );
}

