import * as cheerio from "cheerio";
import type { ScrapedTrack, ScrapeResult } from "../types";
import { parseArtistTitle, parseQuotedTrack, type ParsedTrackLine } from "./parse-utils";
import { extractRscText } from "./rsc-extract";

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

  // Strategy 3: Heading-based patterns (blog listicles)
  tracks = tryHeadingPatterns($);
  if (tracks.length > 0) {
    return buildResult(url, tracks, $, warnings);
  }

  // Strategy 4: Element-level text scanning
  // Catches tracks in styled divs/spans/p that aren't headings (e.g. Beatportal)
  tracks = tryElementTextPatterns($);
  if (tracks.length > 0) {
    return buildResult(url, tracks, $, warnings);
  }

  // Strategy 5: RSC payload text patterns (Next.js streaming apps)
  const rscLines = extractRscText(html);
  if (rscLines.length > 0) {
    tracks = tryLinePatterns(rscLines);
    if (tracks.length > 0) {
      return buildResult(url, tracks, $, warnings);
    }
  }

  // Strategy 6: Regex on visible text (body.text() split by newlines)
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

function tryHeadingPatterns($: cheerio.CheerioAPI): ScrapedTrack[] {
  const tracks: ScrapedTrack[] = [];
  const seen = new Set<string>();

  // Blog listicles use h2/h3/h4 headings for each track entry
  // e.g., Rolling Stone: <h2>Artist, 'Song Title'</h2>
  $("h2, h3, h4").each((_, el) => {
    const text = $(el).text().trim();
    const parsed = parseQuotedTrack(text) || parseArtistTitle(text);
    if (parsed) {
      const key = `${parsed.artist.toLowerCase()}::${parsed.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({
          position: tracks.length + 1,
          artist: parsed.artist,
          title: parsed.title,
          raw: text,
        });
      }
    }
  });

  // Require at least 2 matches to avoid false positives from a single heading
  return tracks.length >= 2 ? tracks : [];
}

function tryElementTextPatterns($: cheerio.CheerioAPI): ScrapedTrack[] {
  const tracks: ScrapedTrack[] = [];
  const seen = new Set<string>();

  // Scan individual elements for track patterns.
  // Many modern sites put "Artist – Title" in styled divs/spans/p
  // rather than headings or list items.
  $("div, p, span").each((_, el) => {
    const $el = $(el);

    // Only check leaf-ish elements — skip if it has many child elements
    // (to avoid matching a parent container that concatenates child text)
    if ($el.children().length > 3) return;

    // Get the element's own direct text (not deeply nested children)
    const text = $el
      .contents()
      .filter((__, node) => node.type === "text")
      .text()
      .trim();

    // If no direct text, fall back to full text for simple leaf elements
    const candidate =
      text.length > 5 ? text : $el.children().length === 0 ? $el.text().trim() : "";

    if (candidate.length < 5 || candidate.length > 150) return;

    const parsed = parseArtistTitle(candidate) || parseQuotedTrack(candidate);
    if (parsed) {
      const key = `${parsed.artist.toLowerCase()}::${parsed.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({
          position: tracks.length + 1,
          artist: parsed.artist,
          title: parsed.title,
          raw: candidate,
        });
      }
    }
  });

  // Require at least 3 matches to avoid false positives
  return tracks.length >= 3 ? tracks : [];
}

function tryLinePatterns(lines: string[]): ScrapedTrack[] {
  const tracks: ScrapedTrack[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = parseArtistTitle(line) || parseQuotedTrack(line);
    if (parsed) {
      const key = `${parsed.artist.toLowerCase()}::${parsed.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({
          position: tracks.length + 1,
          artist: parsed.artist,
          title: parsed.title,
          timestamp: parsed.timestamp,
          raw: line,
        });
      }
    }
  }

  // Require at least 2 matches
  return tracks.length >= 2 ? tracks : [];
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
    const parsed = parseArtistTitle(line) || parseQuotedTrack(line);
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
