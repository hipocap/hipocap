import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prettifyError, ZodError } from "zod/v4";

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
  props: { params: Promise<{ projectId: string; shieldKey: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { shieldKey } = await props.params;
    const headers = getLmnrHeaders(session);

    // Backend GET endpoint uses shield_key (string)
    // If we receive a numeric ID, we need to list all shields and find by ID
    const numericId = parseInt(shieldKey, 10);
    let url: string;
    
    if (!isNaN(numericId)) {
      // If it's a numeric ID, list all shields and find by ID
      url = `${HIPOCAP_SERVER_URL}/api/v1/shields`;
    } else {
      // If it's a shield_key, use the direct endpoint
      url = `${HIPOCAP_SERVER_URL}/api/v1/shields/${shieldKey}`;
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
    
    // If we got a list (numeric ID case), find the shield by ID
    if (Array.isArray(data) && !isNaN(numericId)) {
      data = data.find((s: any) => s.id === numericId);
      if (!data) {
        return new Response(JSON.stringify({ error: "Shield not found" }), { status: 404 });
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching shield:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; shieldKey: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { shieldKey } = await props.params;
    const body = await req.json();
    const headers = getLmnrHeaders(session);

    // Backend PATCH endpoint uses shield_key (string)
    const url = `${HIPOCAP_SERVER_URL}/api/v1/shields/${shieldKey}`;

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Hipocap API error: ${error}`);
    }

    const data = await res.json();
    // The response might be a ShieldUpdateResponse with a nested shield
    if (data.shield) {
      return new Response(JSON.stringify(data.shield), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating shield:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; shieldKey: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { shieldKey } = await props.params;
    const headers = getLmnrHeaders(session);

    // Backend DELETE endpoint uses numeric shield_id
    // First, get the shield to find its ID
    const numericId = parseInt(shieldKey, 10);
    
    if (isNaN(numericId)) {
      // If it's a shield_key, get the shield first to find its ID
      const getUrl = `${HIPOCAP_SERVER_URL}/api/v1/shields/${shieldKey}`;
      const getRes = await fetch(getUrl, {
        method: "GET",
        headers,
      });

      if (!getRes.ok) {
        const error = await getRes.text();
        throw new Error(`Hipocap API error: ${error}`);
      }

      const shieldData = await getRes.json();
      const shieldId = shieldData.id;

      const deleteUrl = `${HIPOCAP_SERVER_URL}/api/v1/shields/${shieldId}`;
      const deleteRes = await fetch(deleteUrl, {
        method: "DELETE",
        headers,
      });

      if (!deleteRes.ok) {
        const error = await deleteRes.text();
        throw new Error(`Hipocap API error: ${error}`);
      }

      return new Response(null, { status: 204 });
    } else {
      // If it's already a numeric ID, use it directly
      const url = `${HIPOCAP_SERVER_URL}/api/v1/shields/${numericId}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Hipocap API error: ${error}`);
      }

      return new Response(null, { status: 204 });
    }
  } catch (error) {
    console.error("Error deleting shield:", error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

