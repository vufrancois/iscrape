import type { SpotifySearchResult } from "./types";
import { cleanTitle, cleanArtist, primaryArtist } from "./query-utils";

const CONCURRENCY = 5;

// Deezer allows ~50 requests per 5 seconds.
// Use a simple throttle: max N concurrent + small delay between requests.
let deezerInFlight = 0;
const MAX_DEEZER_CONCURRENT = 4;
const DEEZER_DELAY_MS = 100; // 100ms between requests = ~10/sec

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deezerThrottle() {
  // Wait if too many requests in flight
  while (deezerInFlight >= MAX_DEEZER_CONCURRENT) {
    await sleep(50);
  }
  deezerInFlight++;
  await sleep(DEEZER_DELAY_MS);
}

interface DeezerSearchResult {
  id: number;
}

interface DeezerTrackDetail {
  bpm: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function deezerSearch(query: string): Promise<any | null> {
  await deezerThrottle();
  try {
    const params = new URLSearchParams({ q: query, limit: "1" });
    const res = await fetch(
      `https://api.deezer.com/search/track?${params.toString()}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Deezer returns error objects instead of 4xx status codes sometimes
    if (data?.error) {
      // If quota exceeded, wait a bit before next request
      if (data.error.code === 4) {
        // code 4 = Quota limit exceeded
        await sleep(2000);
      }
      return null;
    }
    const results = data?.data;
    if (!Array.isArray(results) || results.length === 0) return null;
    return results[0];
  } finally {
    deezerInFlight--;
  }
}

async function deezerFetchDetail(trackId: number): Promise<DeezerTrackDetail | null> {
  await deezerThrottle();
  try {
    const res = await fetch(`https://api.deezer.com/track/${trackId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return data as DeezerTrackDetail;
  } finally {
    deezerInFlight--;
  }
}

/**
 * Deezer-based track search — fallback when Spotify is rate-limited.
 * Tries progressively simpler queries to maximize match rate.
 */
export async function searchTrackDeezer(
  artist: string,
  title: string
): Promise<SpotifySearchResult | null> {
  const raw = `${artist} ${title}`;
  const cleanedTitle = cleanTitle(title);
  const cleanedArtist = cleanArtist(artist);
  const primary = primaryArtist(artist);

  // Build a list of unique queries to try, from most specific to broadest
  const queries: string[] = [];
  const seen = new Set<string>();
  const addQuery = (q: string) => {
    const normalized = q.toLowerCase().trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      queries.push(q);
    }
  };

  // 1. Raw query as-is
  addQuery(raw);
  // 2. Cleaned artist + cleaned title (strips feat, explicit, main mix, etc.)
  addQuery(`${cleanedArtist} ${cleanedTitle}`);
  // 3. Primary artist only + cleaned title
  addQuery(`${primary} ${cleanedTitle}`);
  // 4. Primary artist + first few words of title
  const shortTitle = cleanedTitle.split(/\s+/).slice(0, 3).join(" ");
  addQuery(`${primary} ${shortTitle}`);

  for (const query of queries) {
    const track = await deezerSearch(query);
    if (track) {
      const deezerUrl =
        track.link || `https://www.deezer.com/track/${track.id}`;
      return {
        spotifyUrl: "",
        spotifyId: "",
        name: track.title || title,
        artists: track.artist ? [track.artist.name] : [artist],
        albumName: track.album?.title,
        thumbnail:
          track.album?.cover_medium ||
          track.album?.cover_big ||
          track.album?.cover ||
          undefined,
        deezerUrl,
      };
    }
  }

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getBpmBatch(
  tracks: { artist: string; title: string }[]
): Promise<Map<number, number>> {
  // Map uses the track's index (position in input array) as key
  const bpmByIndex = new Map<number, number>();

  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const batch = tracks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((track, j) => lookupBpm(track.artist, track.title, i + j))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const { index, bpm } = result.value;
        bpmByIndex.set(index, bpm);
      }
    }
  }

  return bpmByIndex;
}

async function lookupBpm(
  artist: string,
  title: string,
  index: number
): Promise<{ index: number; bpm: number } | null> {
  // Search with progressively simpler queries
  const queries = [
    `${artist} ${title}`,
    `${cleanArtist(artist)} ${cleanTitle(title)}`,
    `${primaryArtist(artist)} ${cleanTitle(title)}`,
  ];
  const seen = new Set<string>();
  let result = null;
  for (const q of queries) {
    const norm = q.toLowerCase().trim();
    if (seen.has(norm)) continue;
    seen.add(norm);
    result = await deezerSearch(q);
    if (result) break;
  }
  if (!result) return null;

  const deezerTrackId = (result as DeezerSearchResult).id;

  // Step 2: Fetch track detail for BPM (throttled)
  const detail = await deezerFetchDetail(deezerTrackId);
  if (!detail || !detail.bpm || detail.bpm === 0) return null;

  return { index, bpm: Math.round(detail.bpm) };
}
