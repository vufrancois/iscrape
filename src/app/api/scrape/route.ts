import { NextResponse } from "next/server";
import { fetchPage } from "@/lib/scraper";
import { parseTracklist } from "@/lib/parsers";
import type { ScrapeRequest } from "@/lib/types";

export async function POST(request: Request) {
  let body: ScrapeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Missing required field: url" },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format" },
      { status: 400 }
    );
  }

  try {
    const { html } = await fetchPage(url);
    const result = parseTracklist(url, html);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch page";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
