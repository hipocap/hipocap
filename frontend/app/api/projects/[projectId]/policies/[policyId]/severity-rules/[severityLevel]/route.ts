import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const HIPOCAP_SERVER_URL = process.env.HIPOCAP_SERVER_URL || "http://localhost:8006";

function getLmnrHeaders(session: any): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.user) {
    if (session.user.id) {
      headers["X-LMNR-User-Id"] = session.user.id;
    }
    if (session.user.email) {
      headers["X-LMNR-User-Email"] = session.user.email;
    }
    if (session.user.name) {
      headers["X-LMNR-User-Name"] = session.user.name;
    }
  }

  const apiKey = process.env.HIPOCAP_API_KEY;
  if (apiKey) {
    headers["X-LMNR-API-Key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return headers;
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; policyId: string; severityLevel: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { policyId, severityLevel } = await props.params;
    const headers = getLmnrHeaders(session);

    const numericId = parseInt(policyId, 10);
    if (isNaN(numericId)) {
      return new Response(JSON.stringify({ error: "Invalid policy ID. Must be a number." }), { status: 400 });
    }

    const url = `${HIPOCAP_SERVER_URL}/api/v1/policies/${numericId}/severity-rules/${encodeURIComponent(severityLevel)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Hipocap API error: ${error}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting severity rule:", error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

