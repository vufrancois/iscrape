import type { ScrapeResult } from "../types";
import { parseSoulection } from "./soulection";
import { parseGeneric } from "./generic";

type ParserType = "soulection" | "generic";

function selectParser(url: string): ParserType {
  if (/radio\.soulection\.com/i.test(url)) {
    return "soulection";
  }
  return "generic";
}

export function parseTracklist(url: string, html: string): ScrapeResult {
  const parserType = selectParser(url);

  if (parserType === "soulection") {
    const result = parseSoulection(url, html);
    // If the Soulection parser found tracks, return them
    if (result.tracks.length > 0) {
      return result;
    }
    // Otherwise fall back to generic
    const fallback = parseGeneric(url, html);
    fallback.warnings = [
      "Soulection parser found no tracks, fell back to generic parser",
      ...(fallback.warnings || []),
    ];
    return fallback;
  }

  return parseGeneric(url, html);
}
