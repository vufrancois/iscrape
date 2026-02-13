import * as cheerio from "cheerio";
import type { ScrapedTrack, ScrapeResult } from "../types";

export function parseSoulection(url: string, html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const tracks: ScrapedTrack[] = [];
  const warnings: string[] = [];

  // Extract all __next_f script content
  let scriptContent = "";
  $("script").each((_, el) => {
    const text = $(el).text();
    if (text.includes("__next_f")) {
      scriptContent += text;
    }
  });

  if (!scriptContent) {
    return {
      url,
      sourceType: "soulection",
      tracks: [],
      warnings: ["No embedded data found on this Soulection page"],
    };
  }

  // Extract track objects using regex on the raw script content
  // The data is in escaped JSON within __next_f.push() calls
  // Pattern matches: "timestamp":"...","artist":"...","artistId":"...","song":"...","songId":"..."
  const trackPattern =
    /"timestamp"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"artist"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"artistId"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"song"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"songId"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;

  // Also try escaped variant where quotes are \" in the push string
  const escapedContent = scriptContent.replace(/\\"/g, '"');
  const searchTargets = [scriptContent, escapedContent];

  const seen = new Set<string>();

  for (const content of searchTargets) {
    let match;
    const regex = new RegExp(trackPattern.source, "g");
    while ((match = regex.exec(content)) !== null) {
      const [, timestamp, artist, , song] = match;
      // Unescape any remaining escape sequences
      const cleanArtist = unescapeJson(artist);
      const cleanSong = unescapeJson(song);
      const key = `${cleanArtist}::${cleanSong}`;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({
          position: tracks.length + 1,
          artist: cleanArtist,
          title: cleanSong,
          timestamp: timestamp,
        });
      }
    }
    if (tracks.length > 0) break;
  }

  // Try to extract episode metadata
  let episodeTitle: string | undefined;
  let imageUrl: string | undefined;

  const titleMatch = scriptContent.match(
    /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/
  );
  if (titleMatch) {
    episodeTitle = unescapeJson(titleMatch[1]);
  }

  // Look for og:image or cover image
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    imageUrl = ogImage;
  }

  const pageTitle = $("title").text() || undefined;

  if (tracks.length === 0) {
    warnings.push(
      "Could not extract tracks from this Soulection page. The page format may have changed."
    );
  }

  return {
    url,
    sourceType: "soulection",
    tracks,
    metadata: {
      pageTitle,
      episodeTitle,
      imageUrl,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function unescapeJson(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'")
    .replace(/\\u0027/g, "'")
    .replace(/\\u0026/g, "&");
}
