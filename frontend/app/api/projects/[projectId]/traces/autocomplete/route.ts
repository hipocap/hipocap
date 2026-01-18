import { NextRequest } from "next/server";

import { getAutocompleteSuggestions } from "@/lib/actions/autocomplete";

export async function GET(req: NextRequest, props: { params: Promise<{ projectId: string }> }): Promise<Response> {
  const params = await props.params;
  const { searchParams } = req.nextUrl;

  try {
    const suggestions = await getAutocompleteSuggestions({
      projectId: params.projectId,
      entity: "traces",
      prefix: searchParams.get("prefix") || "",
    });

    return Response.json({ suggestions });
  } catch (error) {
    console.error("Error in traces autocomplete:", error);
    // Return empty suggestions instead of 500 to prevent UI errors
    return Response.json({ suggestions: [] }, { status: 200 });
  }
}
