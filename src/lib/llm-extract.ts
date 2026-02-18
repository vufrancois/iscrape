import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import type { ScrapedTrack, ScrapeResult } from "./types";
import { extractRscText } from "./parsers/rsc-extract";

const SYSTEM_PROMPT = `You extract music track listings from web page text. Return ONLY a JSON array of tracks found.

Rules:
- Only extract tracks that appear as part of a tracklist, playlist, setlist, or song list
- Do NOT extract songs merely mentioned in passing in prose
- Each track needs at minimum an artist and title
- Include timestamps if present (common in DJ mixes)
- Handle featured artists: include "feat." in the artist field
- Handle remixes: include remix info in the title
- Do NOT include track numbers in the artist or title fields

Return format: [{"artist": "...", "title": "...", "timestamp": "MM:SS or null"}]

If no tracklist is found, return an empty array: []`;

const MAX_CHARS = 50_000;

/**
 * Fallback track extraction using Claude Haiku.
 * Called when traditional parsing finds <2 tracks.
 * Returns null on any failure (missing API key, timeout, invalid response, etc.)
 */
export async function extractTracksWithLLM(
  url: string,
  html: string
): Promise<ScrapeResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const $ = cheerio.load(html);

    // Extract metadata before stripping elements
    const pageTitle = $("title").text() || undefined;
    const ogImage =
      $('meta[property="og:image"]').attr("content") || undefined;

    // Extract RSC text BEFORE removing script tags (RSC payloads live in scripts)
    const rscLines = extractRscText(html);

    // Remove non-content elements
    $(
      "script, style, nav, footer, header, noscript, iframe, svg, form"
    ).remove();
    $(
      "[class*='cookie'], [class*='popup'], [class*='modal'], [class*='banner'], [id*='cookie'], [id*='popup']"
    ).remove();

    // Extract and clean body text
    const bodyText = $("body").text();
    const cleaned = bodyText
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Combine body text with RSC-extracted text for better LLM coverage
    let combined = cleaned;
    if (rscLines.length > 0) {
      const rscText = rscLines.join("\n");
      combined = cleaned + "\n\n--- Additional page content ---\n\n" + rscText;
    }

    if (combined.length < 20) return null; // Too little content to analyze

    // Truncate to limit token cost
    const text =
      combined.length > MAX_CHARS
        ? combined.slice(0, MAX_CHARS) + "\n\n[...truncated]"
        : combined;

    // Call Claude Haiku
    const client = new Anthropic({ apiKey });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let message: Anthropic.Message;
    try {
      message = await client.messages.create(
        {
          model: "claude-haiku-4-20250414",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Extract the tracklist from this web page:\n\n${text}`,
            },
          ],
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    // Parse response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Extract JSON array — Claude sometimes wraps in markdown code fences
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    let rawTracks: Array<{
      artist: string;
      title: string;
      timestamp?: string | null;
    }>;
    try {
      rawTracks = JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }

    if (!Array.isArray(rawTracks) || rawTracks.length === 0) return null;

    // Convert to ScrapedTrack array
    const tracks: ScrapedTrack[] = rawTracks
      .filter((t) => t.artist && t.title)
      .map((t, i) => ({
        position: i + 1,
        artist: t.artist.trim(),
        title: t.title.trim(),
        timestamp:
          t.timestamp && t.timestamp !== "null" ? t.timestamp : undefined,
      }));

    if (tracks.length === 0) return null;

    return {
      url,
      sourceType: "llm",
      tracks,
      metadata: { pageTitle, imageUrl: ogImage },
      warnings: [
        "Tracks were extracted using AI analysis. Results may vary.",
      ],
    };
  } catch {
    // Any failure (network, parse, timeout) — silently return null
    return null;
  }
}
