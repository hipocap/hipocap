import { Metadata } from "next";

import Header from "@/components/ui/header";
import Shields from "@/components/shields";

export const metadata: Metadata = {
  title: "Shields",
};

export default async function ShieldsPage(props: { params: Promise<{ projectId: string }> }) {
  return (
    <div className="flex flex-col h-full">
      <Header path="shields" />
      <div className="flex-1 overflow-y-auto py-8">
        <Shields />
      </div>
    </div>
  );
}

