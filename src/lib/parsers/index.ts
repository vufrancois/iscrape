import type { ScrapeResult } from "../types";
import { parseSoulection } from "./soulection";
import { parseGeneric } from "./generic";
import { extractTracksWithLLM } from "../llm-extract";

type ParserType = "soulection" | "generic";

function selectParser(url: string): ParserType {
  if (/radio\.soulection\.com/i.test(url)) {
    return "soulection";
  }
  return "generic";
}

export async function parseTracklist(url: string, html: string): Promise<ScrapeResult> {
  const parserType = selectParser(url);

  let result: ScrapeResult;

  if (parserType === "soulection") {
    result = parseSoulection(url, html);
    if (result.tracks.length > 0) {
      return result;
    }
    // Soulection parser found no tracks, try generic
    const fallback = parseGeneric(url, html);
    fallback.warnings = [
      "Soulection parser found no tracks, fell back to generic parser",
      ...(fallback.warnings || []),
    ];
    result = fallback;
  } else {
    result = parseGeneric(url, html);
  }

  // If traditional parsing found enough tracks, return them
  if (result.tracks.length >= 2) {
    return result;
  }

  // Try LLM fallback
  const llmResult = await extractTracksWithLLM(url, html);
  if (llmResult && llmResult.tracks.length > 0) {
    return llmResult;
  }

  // LLM also found nothing — return original result
  return result;
}
