import type { SpotifySearchResult } from "./types";
import { cleanTitle, cleanArtist, primaryArtist } from "./query-utils";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let cachedToken: { token: string; expiresAt: number } | null = null;

// Shared rate-limit pause: when one request gets 429, all requests wait
let rateLimitPauseUntil = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken(): Promise<string> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error(
      "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in environment variables"
    );
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // If another request hit a 429, wait for the shared pause to expire
    const now = Date.now();
    if (rateLimitPauseUntil > now) {
      const remaining = rateLimitPauseUntil - now;
      // Cap wait at 5s — if Spotify says wait longer, just retry sooner
      await sleep(Math.min(remaining, 5000));
    }

    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : 0;

      // If Spotify says wait more than 60s, we're hard-banned — don't retry
      if (retryAfterSec > 60) {
        // Invalidate token so we get a fresh one next time
        cachedToken = null;
        throw new Error("Spotify rate limit — try again later");
      }

      if (attempt === maxRetries) {
        throw new Error("Spotify rate limit reached after retries");
      }

      const rawMs = retryAfterSec > 0 ? retryAfterSec * 1000 : 1000 * 2 ** attempt;
      const waitMs = Math.min(rawMs, 5000);
      rateLimitPauseUntil = Date.now() + waitMs;
      await sleep(waitMs);
      continue;
    }

    return response;
  }

  // Should never reach here, but just in case
  throw new Error("Spotify request failed after retries");
}

export async function searchTrack(
  artist: string,
  title: string
): Promise<SpotifySearchResult | null> {
  const token = await getAccessToken();

  // Build search query
  const query = `track:${title} artist:${artist}`;
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "1",
  });

  const response = await fetchWithRetry(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Spotify search failed: ${response.status}`);
  }

  const data = await response.json();
  const tracks = data?.tracks?.items;

  if (!tracks || tracks.length === 0) {
    // Retry with cleaned + simplified queries
    return retryWithCleanedQuery(token, artist, title);
  }

  return mapSpotifyTrack(tracks[0]);
}

async function retryWithCleanedQuery(
  token: string,
  artist: string,
  title: string
): Promise<SpotifySearchResult | null> {
  // Try 1: simple query (no field modifiers)
  const simpleQuery = `${artist} ${title}`;
  let result = await spotifySearch(token, simpleQuery);
  if (result) return result;

  // Try 2: cleaned query (strip feat, explicit, etc.)
  const cleanedQuery = `${cleanArtist(artist)} ${cleanTitle(title)}`;
  if (cleanedQuery !== simpleQuery) {
    result = await spotifySearch(token, cleanedQuery);
    if (result) return result;
  }

  // Try 3: primary artist + cleaned title
  const primary = primaryArtist(artist);
  const primaryQuery = `${primary} ${cleanTitle(title)}`;
  if (primaryQuery !== cleanedQuery) {
    result = await spotifySearch(token, primaryQuery);
    if (result) return result;
  }

  // Try 4: primary artist + short title
  const shortTitle = cleanTitle(title).split(/\s+/).slice(0, 3).join(" ");
  if (primary && shortTitle) {
    const shortQuery = `${primary} ${shortTitle}`;
    if (shortQuery !== primaryQuery) {
      result = await spotifySearch(token, shortQuery);
      if (result) return result;
    }
  }

  return null;
}

async function spotifySearch(
  token: string,
  query: string
): Promise<SpotifySearchResult | null> {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "1",
  });

  const response = await fetchWithRetry(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  const tracks = data?.tracks?.items;

  if (!tracks || tracks.length === 0) return null;
  return mapSpotifyTrack(tracks[0]);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSpotifyTrack(track: any): SpotifySearchResult {
  return {
    spotifyUrl: track.external_urls?.spotify || "",
    spotifyId: track.id,
    name: track.name,
    artists: track.artists?.map((a: any) => a.name) || [],
    albumName: track.album?.name,
    thumbnail:
      track.album?.images?.[1]?.url ||
      track.album?.images?.[0]?.url ||
      undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
