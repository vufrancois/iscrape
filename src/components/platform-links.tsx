"use client";

import type { PlatformLinks as PlatformLinksType } from "@/lib/types";
import type { ComponentType, SVGProps } from "react";
import { ExternalLink } from "lucide-react";
import {
  SpotifyIcon,
  AppleMusicIcon,
  SoundCloudIcon,
  YouTubeIcon,
  BandcampIcon,
  DiscogsIcon,
} from "./platform-icons";

interface PlatformConfig {
  key: keyof PlatformLinksType | "discogs";
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  searchUrl: (artist: string, title: string) => string;
}

interface Props {
  links: PlatformLinksType;
  artist: string;
  title: string;
}

function q(artist: string, title: string): string {
  return encodeURIComponent(`${artist} ${title}`.trim());
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: "spotify",
    label: "Spotify",
    Icon: SpotifyIcon,
    searchUrl: (a, t) => `https://open.spotify.com/search/${q(a, t)}`,
  },
  {
    key: "appleMusic",
    label: "Apple Music",
    Icon: AppleMusicIcon,
    searchUrl: (a, t) => `https://music.apple.com/us/search?term=${q(a, t)}`,
  },
  {
    key: "soundcloud",
    label: "SoundCloud",
    Icon: SoundCloudIcon,
    searchUrl: (a, t) => `https://soundcloud.com/search?q=${q(a, t)}`,
  },
  {
    key: "youtube",
    label: "YouTube",
    Icon: YouTubeIcon,
    searchUrl: (a, t) => `https://www.youtube.com/results?search_query=${q(a, t)}`,
  },
  {
    key: "bandcamp",
    label: "Bandcamp",
    Icon: BandcampIcon,
    searchUrl: (a, t) => `https://bandcamp.com/search?q=${q(a, t)}`,
  },
  {
    key: "discogs",
    label: "Discogs",
    Icon: DiscogsIcon,
    searchUrl: (a, t) =>
      `https://www.discogs.com/search/?q=${q(a, t)}&type=all`,
  },
];

export function PlatformLinksRow({ links, artist, title }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {PLATFORMS.map((platform) => {
        const directLink =
          platform.key !== "discogs"
            ? links[platform.key as keyof PlatformLinksType]
            : undefined;
        const href = directLink || platform.searchUrl(artist, title);
        const { Icon } = platform;
        const badgeVariant = directLink ? "te-badge te-badge-direct" : "te-badge te-badge-search";

        return (
          <a
            key={platform.key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={directLink ? platform.label : `Search ${platform.label}`}
            className={`inline-flex items-center justify-center p-1.5 ${badgeVariant}`}
          >
            <Icon width={14} height={14} />
          </a>
        );
      })}
      {links.songLink && (
        <a
          href={links.songLink}
          target="_blank"
          rel="noopener noreferrer"
          title="All Links"
          className="te-badge te-badge-direct inline-flex items-center justify-center p-1.5"
        >
          <ExternalLink width={14} height={14} />
        </a>
      )}
    </div>
  );
}
