import { ColumnDef } from "@tanstack/react-table";

import ClientTimestampFormatter from "@/components/client-timestamp-formatter";
import { Badge } from "@/components/ui/badge.tsx";
import { ColumnFilter } from "@/components/ui/infinite-datatable/ui/datatable-filter/utils";
import Mono from "@/components/ui/mono";
import { HipocapTrace } from "@/lib/hipocap/types";
import { TIME_SECONDS_FORMAT } from "@/lib/utils";

export const filters: ColumnFilter[] = [
  {
    key: "function_name",
    name: "Function Name",
    dataType: "string",
  },
  {
    key: "final_decision",
    name: "Final Decision",
    dataType: "string",
  },
  {
    key: "policy_key",
    name: "Policy Key",
    dataType: "string",
  },
];

export const columns: ColumnDef<HipocapTrace, any>[] = [
  {
    accessorFn: (row) => row.function_name,
    header: "Function Name",
    id: "function_name",
    cell: (row) => <Mono className="text-xs">{row.getValue()}</Mono>,
    size: 200,
  },
  {
    accessorFn: (row) => row.final_decision,
    header: "Decision",
    id: "final_decision",
    cell: (row) => {
      const decision = row.getValue() as string;
      const isBlocked = decision === "BLOCKED";
      const isAllowed = decision === "ALLOWED";
      const isReview = decision === "REVIEW_REQUIRED";
      
      return (
        <Badge
          variant="outline"
          className={
            isBlocked
              ? "text-red-600 border-red-600 bg-red-50"
              : isAllowed
              ? "text-green-600 border-green-600 bg-green-50"
              : isReview
              ? "text-yellow-600 border-yellow-600 bg-yellow-50"
              : ""
          }
        >
          {decision}
        </Badge>
      );
    },
    size: 120,
  },
  {
    accessorFn: (row) => row.reason || "-",
    header: "Reason",
    id: "reason",
    cell: (row) => {
      const reason = row.getValue() as string;
      if (reason === "-" || !reason) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="text-sm line-clamp-2" title={reason}>
          {reason}
        </span>
      );
    },
    size: 300,
  },
  {
    accessorFn: (row) => row.created_at,
    header: "Created At",
    id: "created_at",
    cell: (row) => (
      <ClientTimestampFormatter timestamp={String(row.getValue())} format={TIME_SECONDS_FORMAT} />
    ),
    size: 150,
  },
  {
    accessorFn: (row) => row.user_query || "-",
    header: "User Query",
    id: "user_query",
    cell: (row) => {
      const query = row.getValue() as string;
      if (query === "-" || !query) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="text-sm line-clamp-1" title={query}>
          {query}
        </span>
      );
    },
    size: 250,
  },
  {
    accessorFn: (row) => row.policy_key || "-",
    header: "Policy Key",
    id: "policy_key",
    cell: (row) => {
      const policyKey = row.getValue() as string;
      if (policyKey === "-" || !policyKey) return <span className="text-muted-foreground">-</span>;
      return <Mono className="text-xs">{policyKey}</Mono>;
    },
    size: 150,
  },
  {
    accessorFn: (row) => row.input_score ?? row.quarantine_score ?? row.llm_score ?? null,
    header: "Risk Score",
    id: "risk_score",
    cell: (row) => {
      const score = row.getValue() as number | null;
      if (score === null || score === undefined) return <span className="text-muted-foreground">-</span>;
      const scorePercent = (score * 100).toFixed(1);
      return (
        <span className="text-sm font-mono">
          {scorePercent}%
        </span>
      );
    },
    size: 100,
  },
];

export const defaultHipocapTracesColumnOrder = [
  "function_name",
  "final_decision",
  "reason",
  "created_at",
  "user_query",
  "policy_key",
  "risk_score",
];

