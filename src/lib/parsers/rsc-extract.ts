/**
 * Extracts human-readable text strings from Next.js RSC (React Server Components)
 * streaming payloads. Modern Next.js apps embed page content inside <script> tags
 * as self.__next_f.push([...]) calls rather than in clean HTML elements.
 *
 * Returns an array of clean text lines, or [] if the page doesn't use RSC.
 */
export function extractRscText(html: string): string[] {
  // Early bail — no RSC payloads
  if (!html.includes("__next_f")) return [];

  const lines: string[] = [];

  // Match self.__next_f.push([<type>, "<payload>"]) calls
  // The payload is a JS string literal with escaped quotes
  const pushPattern =
    /self\.__next_f\.push\(\[\d+,"((?:[^"\\]|\\.)*)"\]\)/g;

  let pushMatch;
  while ((pushMatch = pushPattern.exec(html)) !== null) {
    const raw = pushMatch[1];

    // Unescape the outer JS string literal
    const unescaped = unescapeJsString(raw);

    // Extract all quoted string values from the RSC wire format
    // RSC uses JSON-like encoding: "string value" within the payload
    const stringPattern = /"((?:[^"\\]|\\.)*)"/g;
    let strMatch;
    while ((strMatch = stringPattern.exec(unescaped)) !== null) {
      const value = unescapeJsString(strMatch[1]);
      if (isHumanReadable(value)) {
        lines.push(value.trim());
      }
    }
  }

  // Also check for __NEXT_DATA__ JSON (older Next.js pattern)
  const nextDataMatch = html.match(
    /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (nextDataMatch) {
    const stringPattern = /"((?:[^"\\]|\\.)*)"/g;
    let strMatch;
    while ((strMatch = stringPattern.exec(nextDataMatch[1])) !== null) {
      const value = unescapeJsString(strMatch[1]);
      if (isHumanReadable(value)) {
        lines.push(value.trim());
      }
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
}

/**
 * Unescape JS/JSON string escape sequences.
 */
function unescapeJsString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

/**
 * Filter: keep only strings that look like human-readable content.
 * Rejects React internals, CSS classes, URLs, hex hashes, etc.
 */
function isHumanReadable(str: string): boolean {
  // Too short to be meaningful
  if (str.length < 5) return false;

  // Too long to be a track title (likely prose/HTML blob)
  if (str.length > 200) return false;

  // React element markers
  if (str.startsWith("$")) return false;

  // URLs and paths
  if (/^(https?:\/\/|\/[a-z])/i.test(str)) return false;

  // CSS class-like strings (e.g., "flex items-center gap-2")
  if (/^[a-z][a-z0-9-]*(\s+[a-z][a-z0-9-]*){2,}$/.test(str)) return false;

  // Hex hashes (e.g., "a3f4b2c1d5e6")
  if (/^[0-9a-f]{8,}$/i.test(str)) return false;

  // Module/chunk references
  if (/^(node_modules|chunks|static|_next)\//i.test(str)) return false;

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(str)) return false;

  // Must contain at least one space (filters out single-word identifiers)
  // unless it contains a dash separator (could be "Artist - Title" compressed)
  if (
    !str.includes(" ") &&
    !str.includes("\u2013") &&
    !str.includes("\u2014")
  )
    return false;

  return true;
}
