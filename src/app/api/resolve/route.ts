import { NextResponse } from "next/server";
import { searchTrack } from "@/lib/spotify";
import { getBpmBatch, searchTrackDeezer } from "@/lib/deezer";
import { getLinks, buildFallbackLinks } from "@/lib/odesli";
import type {
  ResolveRequest,
  ResolvedTrack,
  ResolveResult,
  ScrapedTrack,
  PlatformLinks,
} from "@/lib/types";

const USE_ODESLI = !!process.env.ODESLI_API_KEY;

const CONCURRENCY = 2;

export async function POST(request: Request) {
  let body: ResolveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tracks } = body;
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return NextResponse.json(
      { error: "Missing or empty tracks array" },
      { status: 400 }
    );
  }

  // Step 1: Resolve all tracks (Spotify → Deezer fallback)
  const resolved = await resolveAll(tracks);

  // Step 2: Fetch BPM via Deezer (runs after resolution to avoid rate limits)
  const tracksForBpm = resolved
    .map((t, i) => ({ artist: t.artist, title: t.title, index: i }))
    .filter((_, i) => resolved[i].status === "resolved");

  if (tracksForBpm.length > 0) {
    try {
      const bpmMap = await getBpmBatch(
        tracksForBpm.map((t) => ({ artist: t.artist, title: t.title }))
      );
      for (const [bpmIndex, bpm] of bpmMap) {
        const resolvedIndex = tracksForBpm[bpmIndex].index;
        resolved[resolvedIndex].bpm = bpm;
      }
    } catch {
      // BPM is non-critical
    }
  }

  const stats = {
    total: resolved.length,
    resolved: resolved.filter((t) => t.status === "resolved").length,
    notFound: resolved.filter((t) => t.status === "not_found").length,
    errors: resolved.filter((t) => t.status === "error").length,
  };

  const result: ResolveResult = { tracks: resolved, stats };
  return NextResponse.json(result);
}

async function resolveAll(tracks: ScrapedTrack[]): Promise<ResolvedTrack[]> {
  const results: ResolvedTrack[] = new Array(tracks.length);

  // Process in batches for controlled concurrency
  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const batch = tracks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((track) => resolveTrack(track))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results[i + j] = result.value;
      } else {
        results[i + j] = {
          position: batch[j].position,
          artist: batch[j].artist,
          title: batch[j].title,
          timestamp: batch[j].timestamp,
          links: {},
          status: "error",
          errorMessage: result.reason?.message || "Unknown error",
        };
      }
    }

    // Delay between batches to avoid Spotify rate limits
    if (i + CONCURRENCY < tracks.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

async function resolveTrack(track: ScrapedTrack): Promise<ResolvedTrack> {
  const base: Omit<ResolvedTrack, "links" | "status"> = {
    position: track.position,
    artist: track.artist,
    title: track.title,
    timestamp: track.timestamp,
  };

  // Step 1: Search Spotify, fall back to Deezer if rate-limited
  let searchResult;
  try {
    searchResult = await searchTrack(track.artist, track.title);
  } catch {
    // Spotify failed (rate limit etc.) — try Deezer as fallback
    try {
      searchResult = await searchTrackDeezer(track.artist, track.title);
    } catch {
      searchResult = null;
    }
  }

  if (!searchResult) {
    // Last resort: try Deezer if Spotify returned null (not found)
    try {
      searchResult = await searchTrackDeezer(track.artist, track.title);
    } catch {
      /* ignore */
    }
  }

  if (!searchResult) {
    return {
      ...base,
      links: {},
      status: "not_found",
      notFoundReason: classifyNotFound(track.artist, track.title),
    };
  }

  // Step 2: Get cross-platform links
  let links: PlatformLinks;
  if (searchResult.spotifyId && USE_ODESLI) {
    try {
      links = await getLinks(searchResult.spotifyUrl);
    } catch {
      links = searchResult.spotifyId
        ? buildFallbackLinks(searchResult.spotifyId, searchResult.spotifyUrl)
        : {};
    }
  } else if (searchResult.spotifyId) {
    links = buildFallbackLinks(searchResult.spotifyId, searchResult.spotifyUrl);
  } else {
    // Deezer fallback — no Spotify links, but we have a deezer URL
    links = {};
    if (searchResult.deezerUrl) {
      links.deezer = searchResult.deezerUrl;
      // Use song.link with Deezer URL for cross-platform
      links.songLink = `https://song.link/${encodeURIComponent(searchResult.deezerUrl)}`;
    }
  }

  return {
    ...base,
    links,
    thumbnail: searchResult.thumbnail,
    spotifyId: searchResult.spotifyId || undefined,
    status: "resolved",
  };
}

/**
 * Classify why a track wasn't found on any platform.
 * Uses heuristics based on title/artist patterns.
 */
function classifyNotFound(artist: string, title: string): string {
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();

  // Interlude / skit / intro / outro — likely non-commercial
  if (
    /\b(interlude|skit|intro|outro)\b/i.test(titleLower) ||
    /\b(interlude|skit|intro|outro)\b/i.test(artistLower)
  ) {
    return "Likely an interlude or skit — not a standalone release";
  }

  // Mix tags suggest DJ / underground house (Traxsource, Beatport exclusive)
  if (
    /\b(main\s+mix|original\s+mix|club\s+mix|dub\s+mix|vocal\s+mix|extended\s+mix)\b/i.test(
      title
    )
  ) {
    return "Possibly a DJ/underground release — may be on Traxsource or Beatport only";
  }

  // Multiple artists with commas suggests a niche collaboration
  const commaCount = (artist.match(/,/g) || []).length;
  if (commaCount >= 2) {
    return "Niche collaboration — may not be on major streaming platforms";
  }

  // Generic fallback
  return "Not found on Spotify or Deezer — may be unreleased, region-locked, or an obscure release";
}
