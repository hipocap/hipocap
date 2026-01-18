import { Metadata } from "next";

import { HipocapAnalysisPlayground } from "@/components/playground/hipocap-analysis-playground";
import Header from "@/components/ui/header";

export const metadata: Metadata = {
  title: "Hipocap Analysis Playground",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlaygroundPage(props: {
  params: Promise<{ projectId: string; playgroundId: string }>;
}) {
  const params = await props.params;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header path="playgrounds/analysis" />
      <HipocapAnalysisPlayground />
    </div>
  );
}
