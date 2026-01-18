import { NextResponse } from "next/server";

export async function POST(req: Request, props: { params: Promise<{ projectId: string }> }) {
  try {
    const body = await req.json();
    const { projectId } = await props.params;

    const { backend_url, api_key } = body;

    if (!backend_url || !api_key) {
      return NextResponse.json(
        { error: "Backend URL and API key are required" },
        { status: 400 }
      );
    }

    // Remove trailing slash from backend URL
    const baseUrl = backend_url.endsWith("/") ? backend_url.slice(0, -1) : backend_url;
    
    // Call the backend API to get user info
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${api_key}`,
      "X-API-Key": api_key,
    };

    // Get user info from backend
    const userInfoUrl = `${baseUrl}/api/v1/user-info`;
    
    const response = await fetch(userInfoUrl, {
      method: "GET",
      headers,
      signal: req.signal,
    });

    if (!response.ok) {
      // If endpoint doesn't exist, return null (graceful degradation)
      if (response.status === 404) {
        return NextResponse.json({ user_id: null, error: "User info endpoint not available" });
      }
      
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Hipocap user info error:", error);

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

