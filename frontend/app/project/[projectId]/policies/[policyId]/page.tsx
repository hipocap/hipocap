import { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";

import Header from "@/components/ui/header";
import PolicyEditPage from "@/components/policies/policy-edit-page";

import { getPolicy } from "@/lib/actions/policies";

export const metadata: Metadata = {
  title: "Edit Policy",
};

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const host = headersList.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
}

export default async function PolicyPage(
  props: { params: Promise<{ projectId: string; policyId: string }> }
) {
  const { projectId, policyId } = await props.params;
  const baseUrl = await getBaseUrl();
  
  // Get cookies for authentication
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    // Fetch policy by policy_key (the URL uses policy_key, not numeric ID)
    const policy = await getPolicy(projectId, policyId, baseUrl, cookieHeader);
    
    return (
      <div className="flex flex-col h-full">
        <Header path="policies" />
        <div className="flex-1 overflow-y-auto py-8">
          <PolicyEditPage policy={policy} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error fetching policy:", error);
    // Redirect to policies list if policy not found
    redirect(`/project/${projectId}/policies`);
  }
}

