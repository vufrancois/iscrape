/**
 * Shared utilities for cleaning track search queries.
 * Strips noise like "(feat. ...)", "(Explicit)", "(Main Mix)", etc.
 * that hurt search accuracy on Spotify, Deezer, and other APIs.
 */

/**
 * Clean a track title for better search results.
 * Removes parenthetical/bracketed tags that APIs don't index well.
 */
export function cleanTitle(title: string): string {
  return (
    title
      // Remove (feat. ...), (ft. ...), [feat. ...], etc.
      .replace(/[\(\[]\s*(?:feat|ft|featuring)\.?\s+[^\)\]]+[\)\]]/gi, "")
      // Remove (Explicit), (Clean), etc.
      .replace(/[\(\[]\s*(?:explicit|clean)\s*[\)\]]/gi, "")
      // Remove mix/version/edit tags
      .replace(
        /[\(\[]\s*(?:remastered|remaster|deluxe|bonus\s+track|original\s+mix|main\s+mix|radio\s+edit|album\s+version|extended\s+mix|club\s+mix|dub\s+mix|remix|vocal\s+mix|instrumental)\s*[^\)\]]*[\)\]]/gi,
        ""
      )
      // Remove (Interlude)
      .replace(/[\(\[]\s*interlude\s*[\)\]]/gi, "")
      // Uncensor common patterns: N***a → Nigga, S**t → Shit, etc.
      .replace(/N\*{2,}a/gi, "Nigga")
      .replace(/S\*{2,}t/gi, "Shit")
      .replace(/F\*{2,}k/gi, "Fuck")
      .replace(/B\*{2,}h/gi, "Bitch")
      .replace(/A\*{2,}/gi, "Ass")
      // Collapse multiple spaces and trim
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * Clean an artist string for better search results.
 * Simplifies compound artist fields.
 */
export function cleanArtist(artist: string): string {
  return (
    artist
      // Remove (feat. ...) from artist field too (sometimes duplicated there)
      .replace(/[\(\[]\s*(?:feat|ft|featuring)\.?\s+[^\)\]]+[\)\]]/gi, "")
      // Remove parenthetical country/region codes like (IT), (UK), (US)
      .replace(/[\(\[]\s*[A-Z]{2,3}\s*[\)\]]/g, "")
      // Collapse multiple spaces and trim
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * Get just the primary artist (first name before comma, &, etc.)
 */
export function primaryArtist(artist: string): string {
  return cleanArtist(artist)
    .split(/\s*[,&]\s*/)[0]
    .trim();
}
