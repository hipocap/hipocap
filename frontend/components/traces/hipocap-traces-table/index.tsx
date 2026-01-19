"use client";

import { Row } from "@tanstack/react-table";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import SearchInput from "@/components/common/search-input";
import { columns, defaultHipocapTracesColumnOrder, filters } from "@/components/traces/hipocap-traces-table/columns";
import TraceDetailModal from "@/components/traces/hipocap-traces-table/trace-detail-modal";
import { useTraceViewNavigation } from "@/components/traces/trace-view/navigation-context";
import { useTracesStoreContext } from "@/components/traces/traces-store";
import DateRangeFilter from "@/components/ui/date-range-filter";
import { InfiniteDataTable } from "@/components/ui/infinite-datatable";
import { useInfiniteScroll } from "@/components/ui/infinite-datatable/hooks";
import { DataTableStateProvider } from "@/components/ui/infinite-datatable/model/datatable-store";
import ColumnsMenu from "@/components/ui/infinite-datatable/ui/columns-menu.tsx";
import DataTableFilter, { DataTableFilterList } from "@/components/ui/infinite-datatable/ui/datatable-filter";
import RefreshButton from "@/components/ui/infinite-datatable/ui/refresh-button.tsx";
import { useToast } from "@/lib/hooks/use-toast";
import { HipocapTrace, HipocapTraceListResponse } from "@/lib/hipocap/types";

const FETCH_SIZE = 50;

export default function HipocapTracesTable() {
  return (
    <DataTableStateProvider
      storageKey="hipocap-traces-table"
      uniqueKey="id"
      defaultColumnOrder={defaultHipocapTracesColumnOrder}
    >
      <HipocapTracesTableContent />
    </DataTableStateProvider>
  );
}

function HipocapTracesTableContent() {
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const router = useRouter();
  const { projectId } = useParams();
  const { toast } = useToast();
  const { setTraceId, traceId } = useTracesStoreContext((state) => ({
    setTraceId: state.setTraceId,
    traceId: state.traceId,
  }));

  const [selectedTrace, setSelectedTrace] = useState<HipocapTrace | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filter = searchParams.getAll("filter");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const pastHours = searchParams.get("pastHours");
  const textSearchFilter = searchParams.get("search");

  const { setNavigationRefList } = useTraceViewNavigation();

  // Initialize with default time range if needed
  useEffect(() => {
    if (!pastHours && !startDate && !endDate) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("pastHours", "24");
      router.replace(`${pathName}?${sp.toString()}`);
    }
  }, [pastHours, startDate, endDate, searchParams, pathName, router]);

  // Only enable fetching when we have valid time params
  const shouldFetch = !!(pastHours || startDate || endDate);

  const fetchTraces = useCallback(
    async (pageNumber: number) => {
      try {
        const urlParams = new URLSearchParams();
        
        // Calculate offset from page number
        const offset = pageNumber * FETCH_SIZE;
        urlParams.set("offset", offset.toString());
        urlParams.set("limit", FETCH_SIZE.toString());

        // Add date filters
        // Backend expects YYYY-MM-DD format
        if (startDate) {
          // Ensure format is YYYY-MM-DD
          const date = new Date(startDate);
          urlParams.set("start_date", date.toISOString().split("T")[0]);
        } else if (pastHours) {
          // Calculate start_date from pastHours
          const hours = parseInt(pastHours, 10);
          const start = new Date();
          start.setHours(start.getHours() - hours);
          urlParams.set("start_date", start.toISOString().split("T")[0]);
        }
        
        if (endDate) {
          // Ensure format is YYYY-MM-DD
          const date = new Date(endDate);
          urlParams.set("end_date", date.toISOString().split("T")[0]);
        }

        // Add filters
        filter.forEach((f) => {
          const [key, value] = f.split(":");
          if (key === "final_decision") {
            urlParams.set("final_decision", value);
          } else if (key === "function_name") {
            urlParams.set("function_name", value);
          }
        });

        // Add text search (search in function_name or user_query)
        if (typeof textSearchFilter === "string" && textSearchFilter.length > 0) {
          // For now, search in function_name
          urlParams.set("function_name", textSearchFilter);
        }

        const url = `/api/projects/${projectId}/hipocap/traces?${urlParams.toString()}`;

        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const text = (await res.json()) as { error: string };
          throw new Error(text.error || "Failed to fetch Hipocap traces");
        }

        const data = (await res.json()) as HipocapTraceListResponse;
        return { items: data.traces, count: data.total };
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : "Failed to load Hipocap traces. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [endDate, filter, pastHours, projectId, startDate, textSearchFilter, toast]
  );

  const {
    data: traces,
    hasMore,
    isFetching,
    isLoading,
    fetchNextPage,
    refetch,
    updateData,
    error,
  } = useInfiniteScroll<HipocapTrace>({
    fetchFn: fetchTraces,
    enabled: shouldFetch,
    deps: [endDate, filter, pastHours, projectId, startDate, textSearchFilter],
  });

  useEffect(() => {
    // Set navigation refs for trace view
    if (traces) {
      setNavigationRefList(traces.map((t) => String(t.id)));
    }
  }, [setNavigationRefList, traces]);

  const handleRowClick = useCallback(
    async (row: Row<HipocapTrace>) => {
      const trace = row.original;
      if (trace) {
        setSelectedTrace(trace);
        setIsModalOpen(true);
      }
    },
    []
  );

  return (
    <>
      <div className="flex overflow-hidden px-4 pb-6">
        <InfiniteDataTable<HipocapTrace>
          className="w-full"
          columns={columns}
          data={traces}
          getRowId={(trace) => String(trace.id)}
          onRowClick={handleRowClick}
          focusedRowId={traceId || searchParams.get("traceId")}
          hasMore={hasMore}
          isFetching={isFetching}
          isLoading={isLoading || !shouldFetch}
          fetchNextPage={fetchNextPage}
          error={error}
        >
          <div className="flex flex-1 pt-1 w-full h-full gap-2">
            <DataTableFilter columns={filters} />
            <ColumnsMenu
              columnLabels={columns.map((column) => ({
                id: column.id!,
                label: typeof column.header === "string" ? column.header : column.id!,
              }))}
            />
            <DateRangeFilter />
            <RefreshButton onClick={refetch} variant="outline" />
            <SearchInput placeholder="Search in function traces..." />
          </div>
          <DataTableFilterList />
        </InfiniteDataTable>
      </div>
      <TraceDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        trace={selectedTrace}
      />
    </>
  );
}

