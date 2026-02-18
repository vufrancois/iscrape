import { NextResponse } from "next/server";

/**
 * On-demand audio preview endpoint using Deezer's free search API.
 * Returns a 30-second MP3 preview URL for a given artist + title.
 *
 * Spotify deprecated preview_url in their Web API, so we use Deezer instead.
 * No auth needed — Deezer search is public.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { artist, title } = body;

    if (!artist || !title) {
      return NextResponse.json(
        { error: "artist and title are required" },
        { status: 400 }
      );
    }

    const query = `${artist} ${title}`;
    const params = new URLSearchParams({ q: query, limit: "1" });
    const response = await fetch(
      `https://api.deezer.com/search/track?${params.toString()}`
    );

    if (!response.ok) {
      return NextResponse.json({ previewUrl: null });
    }

    const data = await response.json();
    if (data?.error || !data?.data?.length) {
      return NextResponse.json({ previewUrl: null });
    }

    const previewUrl = data.data[0].preview || null;
    return NextResponse.json({ previewUrl });
  } catch {
    return NextResponse.json({ previewUrl: null });
  }
}
