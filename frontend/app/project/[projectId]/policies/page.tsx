import { Metadata } from "next";

import Header from "@/components/ui/header";
import Policies from "@/components/policies";

export const metadata: Metadata = {
  title: "Policies",
};

export default async function PoliciesPage(props: { params: Promise<{ projectId: string }> }) {
  return (
    <div className="flex flex-col h-full">
      <Header path="policies" />
      <div className="flex-1 overflow-y-auto py-8">
        <Policies />
      </div>
    </div>
  );
}
