"use client";

import { useMemo } from "react";

import { useTracesStoreContext } from "@/components/traces/traces-store";
import { TraceRow } from "@/lib/traces/types";
import { cn } from "@/lib/utils";

interface MetricBoxProps {
  title: string;
  value: string | number;
  valueColor?: string;
}

function MetricBox({ title, value, valueColor }: MetricBoxProps) {
  return (
    <div className="flex flex-col p-4 border rounded-lg" style={{ backgroundColor: '#121212' }}>
      <div className="text-xs text-muted-foreground mb-2 text-center">{title}</div>
      <div className="flex-1 flex items-center justify-center">
        <div className={cn("text-2xl font-bold", valueColor)}>{value}</div>
      </div>
    </div>
  );
}

interface TracesMetricsProps {
  traces?: TraceRow[];
}

export default function TracesMetrics({ traces = [] }: TracesMetricsProps) {
  const { stats } = useTracesStoreContext((state) => ({
    stats: state.stats,
  }));

  const metrics = useMemo(() => {
    // Calculate from stats data
    const totalTraces = stats?.reduce((sum, stat) => sum + (stat.successCount || 0) + (stat.errorCount || 0), 0) ?? 0;
    const successful = stats?.reduce((sum, stat) => sum + (stat.successCount || 0), 0) ?? 0;
    const errors = stats?.reduce((sum, stat) => sum + (stat.errorCount || 0), 0) ?? 0;

    // Calculate from traces data (for visible traces only)
    const tracesWithDuration = traces.filter((trace) => trace.startTime && trace.endTime);
    const totalDuration = tracesWithDuration.reduce((sum, trace) => {
      const start = new Date(trace.startTime).getTime();
      const end = new Date(trace.endTime).getTime();
      return sum + (end - start);
    }, 0);
    const avgDurationMs = tracesWithDuration.length > 0 ? totalDuration / tracesWithDuration.length : 0;
    const avgDurationSeconds = avgDurationMs / 1000;

    const totalCost = traces.reduce((sum, trace) => sum + (trace.totalCost || 0), 0);

    // Format duration
    const formatDuration = (seconds: number): string => {
      if (seconds < 1) {
        return `${(seconds * 1000).toFixed(0)}ms`;
      }
      if (seconds < 60) {
        return `${seconds.toFixed(2)}s`;
      }
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    };

    // Format cost
    const formatCost = (cost: number): string => {
      if (cost === 0) return "$0.0000";
      if (cost < 0.0001) {
        return `$${cost.toFixed(6)}`;
      }
      return `$${cost.toFixed(4)}`;
    };

    return {
      totalTraces,
      successful,
      errors,
      avgDuration: tracesWithDuration.length > 0 ? formatDuration(avgDurationSeconds) : "0s",
      totalCost: formatCost(totalCost),
    };
  }, [stats, traces]);

  return (
    <div className="grid grid-cols-5 gap-4 w-full">
      <MetricBox
        title="Total Traces"
        value={metrics.totalTraces}
      />
      <MetricBox
        title="Successful"
        value={metrics.successful}
        valueColor="text-green-500"
      />
      <MetricBox
        title="Errors"
        value={metrics.errors}
        valueColor="text-red-500"
      />
      <MetricBox
        title="Avg Duration"
        value={metrics.avgDuration}
      />
      <MetricBox
        title="Total Cost"
        value={metrics.totalCost}
      />
    </div>
  );
}
