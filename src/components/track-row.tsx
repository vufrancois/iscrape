"use client";

import Image from "next/image";
import type { ScrapedTrack, ResolvedTrack } from "@/lib/types";
import { PlatformLinksRow } from "./platform-links";
import { Music } from "lucide-react";

interface Props {
  track: ScrapedTrack;
  resolved?: ResolvedTrack;
  isResolving: boolean;
}

export function TrackRow({ track, resolved, isResolving }: Props) {
  return (
    <div className="te-track-row flex items-start gap-4 px-4 py-4">
      {/* Position number */}
      <span className="w-6 shrink-0 pt-0.5 text-right text-xs font-normal tabular-nums text-[var(--te-text-tertiary)]">
        {track.position}
      </span>

      {/* Album art */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-[var(--te-bg-input)]">
        {resolved?.thumbnail ? (
          <Image
            src={resolved.thumbnail}
            alt={`${track.artist} - ${track.title}`}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--te-text-tertiary)]">
            <Music size={18} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Artist and title */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-[var(--te-text)]">
            {track.artist}
          </span>
          <span className="text-[var(--te-text-tertiary)]">&mdash;</span>
          <span className="text-sm font-light text-[var(--te-text-secondary)]">
            {track.title}
          </span>
        </div>

        {/* Timestamp and BPM */}
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--te-text-tertiary)]">
          {track.timestamp && (
            <span>{track.timestamp}</span>
          )}
          {resolved?.bpm && (
            <span>{resolved.bpm} BPM</span>
          )}
        </div>

        {/* Platform links or status */}
        <div className="mt-1.5">
          {resolved?.status === "resolved" && (
            <PlatformLinksRow links={resolved.links} artist={track.artist} title={track.title} />
          )}
          {resolved?.status === "not_found" && (
            <span className="text-xs text-[var(--te-amber-dark)]">
              {resolved.notFoundReason || "No links found"}
            </span>
          )}
          {resolved?.status === "error" && (
            <span className="text-xs text-[var(--te-red)]">
              {resolved.errorMessage || "Error resolving links"}
            </span>
          )}
          {isResolving && !resolved && (
            <span className="inline-flex items-center gap-2 text-xs text-[var(--te-text-tertiary)]">
              <span className="te-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
              Finding links...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
