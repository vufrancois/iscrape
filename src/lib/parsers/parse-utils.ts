export interface ParsedTrackLine {
  artist: string;
  title: string;
  timestamp?: string;
}

/**
 * Parse "Artist - Title" patterns with optional leading number and timestamp.
 * Handles dash, en-dash, and em-dash separators.
 */
export function parseArtistTitle(text: string): ParsedTrackLine | null {
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

/**
 * Parse blog-style patterns where the song title is in quotes.
 * Handles curly quotes, straight quotes, "by Artist" suffix.
 */
export function parseQuotedTrack(text: string): ParsedTrackLine | null {
  // Strip leading number/period: "1." "50." "01)"
  let line = text.replace(/^\d+[\.\)]\s*/, "").trim();

  // Pattern 1: Artist, "Song Title" or Artist: "Song Title" or Artist — "Song Title"
  // Separators: comma, colon, dash, en-dash, em-dash
  const artistFirstMatch = line.match(
    /^(.+?)\s*[,:\u2014\u2013\-]\s*[\u201c\u201d"'\u2018\u2019](.+?)[\u201c\u201d"'\u2018\u2019]\s*$/
  );
  if (artistFirstMatch) {
    const artist = artistFirstMatch[1].trim();
    const title = artistFirstMatch[2].trim();
    if (artist.length >= 2 && title.length >= 2 && artist.length < 100 && title.length < 200) {
      return { artist, title };
    }
  }

  // Pattern 2: "Song Title" by Artist or "Song Title," Artist
  const titleFirstMatch = line.match(
    /^[\u201c\u201d"'\u2018\u2019](.+?)[\u201c\u201d"'\u2018\u2019]\s*(?:by|,)\s+(.+)$/i
  );
  if (titleFirstMatch) {
    const title = titleFirstMatch[1].trim();
    const artist = titleFirstMatch[2].trim();
    if (artist.length >= 2 && title.length >= 2 && artist.length < 100 && title.length < 200) {
      return { artist, title };
    }
  }

  return null;
}
