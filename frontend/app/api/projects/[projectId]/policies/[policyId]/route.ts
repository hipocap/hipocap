import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const HIPOCAP_SERVER_URL = process.env.HIPOCAP_SERVER_URL || "http://localhost:8006";

function getLmnrHeaders(session: any): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward LMNR session information as headers
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

  // Optionally include API key if available
  const apiKey = process.env.HIPOCAP_API_KEY;
  if (apiKey) {
    headers["X-LMNR-API-Key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return headers;
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; policyId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { policyId } = await props.params;
    const headers = getLmnrHeaders(session);

    // Backend GET endpoint uses policy_key (string), not numeric ID
    // If we receive a numeric ID, we need to list all policies and find by ID
    const numericId = parseInt(policyId, 10);
    let url: string;
    
    if (!isNaN(numericId)) {
      // If it's a numeric ID, list all policies and find by ID
      url = `${HIPOCAP_SERVER_URL}/api/v1/policies`;
    } else {
      // If it's a policy_key, use the direct endpoint
      url = `${HIPOCAP_SERVER_URL}/api/v1/policies/${policyId}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Hipocap API error: ${error}`);
    }

    let data = await res.json();
    
    // If we got a list (numeric ID case), find the policy by ID
    if (Array.isArray(data) && !isNaN(numericId)) {
      data = data.find((p: any) => p.id === numericId);
      if (!data) {
        return new Response(JSON.stringify({ error: "Policy not found" }), { status: 404 });
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching policy:", error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; policyId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { policyId } = await props.params;
    const body = await req.json();
    const headers = getLmnrHeaders(session);

    // Backend PUT endpoint uses numeric policy_id
    const numericId = parseInt(policyId, 10);
    
    if (isNaN(numericId)) {
      return new Response(JSON.stringify({ error: "Invalid policy ID. Must be a number." }), { status: 400 });
    }

    const url = `${HIPOCAP_SERVER_URL}/api/v1/policies/${numericId}`;

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
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
    console.error("Error updating policy:", error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; policyId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { policyId } = await props.params;
    const headers = getLmnrHeaders(session);

    // Backend DELETE endpoint uses numeric policy_id
    const numericId = parseInt(policyId, 10);
    
    if (isNaN(numericId)) {
      return new Response(JSON.stringify({ error: "Invalid policy ID. Must be a number." }), { status: 400 });
    }

    const url = `${HIPOCAP_SERVER_URL}/api/v1/policies/${numericId}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Hipocap API error: ${error}`);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting policy:", error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}
