import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { HipocapAnalysisRequest, HipocapAnalysisResponse } from "@/lib/hipocap/types";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, props: { params: Promise<{ projectId: string }> }) {
  try {
    const body = await req.json();
    const { projectId } = await props.params;

    // Get current user session
    const session = await getServerSession(authOptions);

    // Extract config from request body if provided
    const config = (body as any)._config;
    const requestBody = { ...body };
    delete (requestBody as any)._config;

    // Extract policy_key from request body if provided (backend expects it as query parameter)
    const policyKey = (requestBody as any).policy_key;
    if (policyKey) {
      delete (requestBody as any).policy_key;
    }

    // Get backend URL - prioritize frontend config, then environment variable
    const backendUrl =
      config?.backend_url ||
      process.env.HIPOCAP_BACKEND_URL ||
      process.env.HIPOCAP_SERVER_URL ||
      "http://localhost:8006";
    
    // Get API key - prioritize frontend config, then environment variable
    const apiKey = config?.api_key || process.env.HIPOCAP_API_KEY;

    // Remove trailing slash from backend URL
    const baseUrl = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
    // Add policy_key as query parameter if provided
    const analyzeUrl = policyKey
      ? `${baseUrl}/api/v1/analyze?policy_key=${encodeURIComponent(policyKey)}`
      : `${baseUrl}/api/v1/analyze`;

    // Prepare request headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add user information from session
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

    // Add API key if available
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      // Also support X-API-Key header format (common alternative)
      headers["X-API-Key"] = apiKey;
    }

    // Forward the request to hipocap backend
    const response = await fetch(analyzeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody as HipocapAnalysisRequest),
      signal: req.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText || `Backend returned ${response.status}` };
      }

      return NextResponse.json(
        {
          error: errorData.detail || errorData.error || `Backend request failed with status ${response.status}`,
          status: response.status,
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const data = (await response.json()) as HipocapAnalysisResponse;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Hipocap analysis error:", error);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Request was cancelled" }, { status: 499 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

