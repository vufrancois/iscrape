import * as cheerio from "cheerio";
import type { ScrapedTrack, ScrapeResult } from "../types";

export function parseGeneric(url: string, html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  let tracks: ScrapedTrack[] = [];

  // Strategy 1: JSON-LD structured data
  tracks = tryJsonLd($);
  if (tracks.length > 0) {
    return buildResult(url, tracks, $, warnings);
  }

  // Strategy 2: HTML table/list patterns
  tracks = tryHtmlStructure($);
  if (tracks.length > 0) {
    return buildResult(url, tracks, $, warnings);
  }

  // Strategy 3: Regex on visible text
  tracks = tryTextPatterns($);
  if (tracks.length > 0) {
    return buildResult(url, tracks, $, warnings);
  }

  warnings.push(
    "No tracklist could be detected on this page. The page may not contain a recognizable track listing."
  );
  return buildResult(url, [], $, warnings);
}

function buildResult(
  url: string,
  tracks: ScrapedTrack[],
  $: cheerio.CheerioAPI,
  warnings: string[]
): ScrapeResult {
  const pageTitle = $("title").text() || undefined;
  const ogImage = $('meta[property="og:image"]').attr("content") || undefined;

  return {
    url,
    sourceType: "generic",
    tracks,
    metadata: {
      pageTitle,
      imageUrl: ogImage,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function tryJsonLd($: cheerio.CheerioAPI): ScrapedTrack[] {
  const tracks: ScrapedTrack[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "MusicPlaylist" && item.track) {
          const trackList = Array.isArray(item.track)
            ? item.track
            : [item.track];
          for (const t of trackList) {
            if (t.name && t.byArtist) {
              tracks.push({
                position: tracks.length + 1,
                artist:
                  typeof t.byArtist === "string"
                    ? t.byArtist
                    : t.byArtist.name || "",
                title: t.name,
              });
            }
          }
        }
        if (item["@type"] === "MusicRecording" && item.name && item.byArtist) {
          tracks.push({
            position: tracks.length + 1,
            artist:
              typeof item.byArtist === "string"
                ? item.byArtist
                : item.byArtist.name || "",
            title: item.name,
          });
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });
  return tracks;
}

function tryHtmlStructure($: cheerio.CheerioAPI): ScrapedTrack[] {
  const tracks: ScrapedTrack[] = [];

  // Look for table rows with track-like content
  $("table tr, table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 2) {
      const texts = cells
        .map((__, cell) => $(cell).text().trim())
        .get()
        .filter((t) => t.length > 0);

      // Try to identify artist-title pairs
      // Common patterns: [#, Artist, Title] or [Time, Artist, Title] or [Artist, Title]
      const parsed = parseTableRow(texts);
      if (parsed) {
        tracks.push({
          position: tracks.length + 1,
          artist: parsed.artist,
          title: parsed.title,
          timestamp: parsed.timestamp,
        });
      }
    }
  });

  if (tracks.length > 0) return tracks;

  // Look for ordered/unordered lists with "Artist - Title" pattern
  $("ol li, ul li").each((_, li) => {
    const text = $(li).text().trim();
    const parsed = parseArtistTitle(text);
    if (parsed) {
      tracks.push({
        position: tracks.length + 1,
        artist: parsed.artist,
        title: parsed.title,
        timestamp: parsed.timestamp,
      });
    }
  });

  return tracks;
}

function tryTextPatterns($: cheerio.CheerioAPI): ScrapedTrack[] {
  const tracks: ScrapedTrack[] = [];

  // Get all visible text, split into lines
  const bodyText = $("body").text();
  const lines = bodyText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const parsed = parseArtistTitle(line);
    if (parsed) {
      tracks.push({
        position: tracks.length + 1,
        artist: parsed.artist,
        title: parsed.title,
        timestamp: parsed.timestamp,
        raw: line,
      });
    }
  }

  return tracks;
}

interface ParsedTrackLine {
  artist: string;
  title: string;
  timestamp?: string;
}

function parseArtistTitle(text: string): ParsedTrackLine | null {
  // Strip leading numbers like "1." or "01."
  let line = text.replace(/^\d+[\.\)]\s*/, "");

  // Extract timestamp if present at the start
  let timestamp: string | undefined;
  const tsMatch = line.match(
    /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)/
  );
  if (tsMatch) {
    timestamp = tsMatch[1];
    line = tsMatch[2];
  }

  // Match "Artist - Title" or "Artist — Title" or "Artist – Title"
  const separatorMatch = line.match(
    /^(.+?)\s*[-\u2013\u2014]\s+(.+)$/
  );
  if (separatorMatch) {
    const artist = separatorMatch[1].trim();
    const title = separatorMatch[2].trim();
    // Basic sanity: both parts should be non-trivial
    if (artist.length >= 2 && title.length >= 2 && artist.length < 100 && title.length < 200) {
      return { artist, title, timestamp };
    }
  }

  return null;
}

function parseTableRow(
  cells: string[]
): ParsedTrackLine | null {
  // [timestamp, artist, title]
  if (cells.length >= 3) {
    const isTimestamp = /^\d{1,2}:\d{2}/.test(cells[0]);
    if (isTimestamp) {
      return {
        timestamp: cells[0],
        artist: cells[1],
        title: cells[2],
      };
    }
    // [#, artist, title]
    const isNumber = /^\d+$/.test(cells[0]);
    if (isNumber) {
      return {
        artist: cells[1],
        title: cells[2],
      };
    }
  }

  // [artist, title]
  if (cells.length === 2) {
    if (cells[0].length >= 2 && cells[1].length >= 2) {
      return {
        artist: cells[0],
        title: cells[1],
      };
    }
  }

  return null;
}
