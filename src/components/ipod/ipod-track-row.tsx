"use client";

import { forwardRef } from "react";
import Image from "next/image";
import type { ScrapedTrack, ResolvedTrack } from "@/lib/types";

interface Props {
  track: ScrapedTrack;
  resolved?: ResolvedTrack;
  isSelected?: boolean;
  onClick?: () => void;
}

export const IpodTrackRow = forwardRef<HTMLDivElement, Props>(
  function IpodTrackRow({ track, resolved, isSelected, onClick }, ref) {
    const rowClass = `ipod-row ${isSelected ? "ipod-row-selected" : ""}`;

    return (
      <div ref={ref} className={rowClass} onClick={onClick}>
        {/* Small album art */}
        {resolved?.thumbnail ? (
          <Image
            src={resolved.thumbnail}
            alt=""
            width={24}
            height={24}
            className="shrink-0 rounded-sm"
            style={{ width: 24, height: 24, objectFit: "cover" }}
          />
        ) : (
          <div
            className="shrink-0 rounded-sm"
            style={{ width: 24, height: 24, background: isSelected ? "rgba(255,255,255,0.2)" : "#F0F0F0" }}
          />
        )}

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <div className="ipod-row-title">
            {track.artist} — {track.title}
          </div>
          {resolved?.status === "not_found" && (
            <div className="ipod-row-secondary">
              {resolved.notFoundReason || "No links found"}
            </div>
          )}
        </div>

        {/* Arrow indicator */}
        <span className="ipod-row-arrow">›</span>
      </div>
    );
  }
);
