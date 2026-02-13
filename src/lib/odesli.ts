import type { OdesliResponse, PlatformLinks } from "./types";
import { RateLimiter } from "./rate-limiter";

const ODESLI_API_KEY = process.env.ODESLI_API_KEY;

// 10 req/min without key, 60 req/min with key
const rateLimiter = new RateLimiter(
  ODESLI_API_KEY ? 60 : 10,
  60_000
);

export async function getLinks(
  spotifyUrl: string
): Promise<PlatformLinks> {
  await rateLimiter.acquire();

  const params = new URLSearchParams({
    url: spotifyUrl,
    userCountry: "US",
    songIfSingle: "true",
  });

  if (ODESLI_API_KEY) {
    params.set("key", ODESLI_API_KEY);
  }

  const response = await fetch(
    `https://api.song.link/v1-alpha.1/links?${params.toString()}`
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Odesli rate limit reached");
    }
    throw new Error(`Odesli API returned ${response.status}`);
  }

  const data: OdesliResponse = await response.json();
  return mapToLinks(data);
}

export function buildFallbackLinks(spotifyId: string, spotifyUrl: string): PlatformLinks {
  return {
    spotify: spotifyUrl,
    songLink: `https://song.link/s/${spotifyId}`,
  };
}

function mapToLinks(data: OdesliResponse): PlatformLinks {
  const p = data.linksByPlatform;
  return {
    spotify: p.spotify?.url,
    appleMusic: p.appleMusic?.url,
    soundcloud: p.soundcloud?.url,
    youtube: p.youtube?.url,
    youtubeMusic: p.youtubeMusic?.url,
    tidal: p.tidal?.url,
    amazonMusic: p.amazonMusic?.url,
    deezer: p.deezer?.url,
    bandcamp: p.bandcamp?.url,
    beatport: p.beatport?.url,
    songLink: data.pageUrl,
  };
}
