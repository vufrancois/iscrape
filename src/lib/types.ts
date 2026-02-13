// === Scraping & Parsing ===

export interface ScrapedTrack {
  position: number;
  artist: string;
  title: string;
  timestamp?: string;
  raw?: string;
}

export interface ScrapeResult {
  url: string;
  sourceType: "soulection" | "generic";
  tracks: ScrapedTrack[];
  metadata?: {
    pageTitle?: string;
    episodeTitle?: string;
    imageUrl?: string;
  };
  warnings?: string[];
}

// === Link Resolution ===

export interface PlatformLinks {
  spotify?: string;
  appleMusic?: string;
  soundcloud?: string;
  youtube?: string;
  youtubeMusic?: string;
  tidal?: string;
  amazonMusic?: string;
  deezer?: string;
  bandcamp?: string;
  beatport?: string;
  songLink?: string;
}

export interface ResolvedTrack {
  position: number;
  artist: string;
  title: string;
  timestamp?: string;
  links: PlatformLinks;
  thumbnail?: string;
  spotifyId?: string;
  bpm?: number;
  status: "resolved" | "not_found" | "error";
  errorMessage?: string;
  notFoundReason?: string;
}

export interface ResolveResult {
  tracks: ResolvedTrack[];
  stats: {
    total: number;
    resolved: number;
    notFound: number;
    errors: number;
  };
}

// === API Request/Response shapes ===

export interface ScrapeRequest {
  url: string;
}

export interface ResolveRequest {
  tracks: ScrapedTrack[];
}

// === Spotify internals ===

export interface SpotifySearchResult {
  spotifyUrl: string;
  spotifyId: string;
  name: string;
  artists: string[];
  albumName?: string;
  thumbnail?: string;
  deezerUrl?: string; // Set when result comes from Deezer fallback
}

// === Odesli internals ===

export interface OdesliResponse {
  entityUniqueId: string;
  userCountry: string;
  pageUrl: string;
  linksByPlatform: Record<
    string,
    {
      url: string;
      entityUniqueId: string;
      nativeAppUriMobile?: string;
      nativeAppUriDesktop?: string;
    }
  >;
  entitiesByUniqueId: Record<
    string,
    {
      id: string;
      type: string;
      title?: string;
      artistName?: string;
      thumbnailUrl?: string;
      thumbnailWidth?: number;
      thumbnailHeight?: number;
      apiProvider: string;
      platforms: string[];
    }
  >;
}
