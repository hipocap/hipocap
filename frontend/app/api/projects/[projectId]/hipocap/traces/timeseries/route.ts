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
  props: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const headers = getLmnrHeaders(session);
    const searchParams = req.nextUrl.searchParams;

    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (searchParams.get("start_date")) {
      queryParams.set("start_date", searchParams.get("start_date")!);
    }
    if (searchParams.get("end_date")) {
      queryParams.set("end_date", searchParams.get("end_date")!);
    }
    const interval = searchParams.get("interval") || "hour";
    queryParams.set("interval", interval);

    const url = `${HIPOCAP_SERVER_URL}/api/v1/traces/timeseries${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
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
    console.error("Error fetching time-series data:", error);
    if (error instanceof ZodError) {
      return new Response(prettifyError(error), { status: 400 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

