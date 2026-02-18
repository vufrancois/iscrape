"use client";

import Image from "next/image";
import type { ScrapedTrack, ResolvedTrack } from "@/lib/types";
import { PlatformLinksRow } from "../platform-links";

interface Props {
  track: ScrapedTrack;
  resolved?: ResolvedTrack;
  isResolving?: boolean;
  isPlaying?: boolean;
  progress?: number;
  currentTime?: number;
  duration?: number;
  isLoadingPreview?: boolean;
  previewError?: boolean;
  previewUrl?: string | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function IpodNowPlaying({
  track,
  resolved,
  isResolving,
  isPlaying,
  progress = 0,
  currentTime = 0,
  duration = 0,
  isLoadingPreview,
  previewError,
  previewUrl,
}: Props) {
  // Always show the scrubber — like a real iPod Classic
  const hasPreview = !!previewUrl;
  const isDisabled = previewError && !isLoadingPreview && !hasPreview;

  return (
    <div className="ipod-now-playing">
      {/* Album art */}
      <div className="ipod-now-playing-art">
        {resolved?.thumbnail ? (
          <Image
            src={resolved.thumbnail}
            alt=""
            width={100}
            height={100}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            background: "#E8E8E8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#BBB" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
      </div>

      {/* Track title with play/pause indicator */}
      <div className="ipod-now-playing-title">
        {hasPreview && isPlaying !== undefined && (
          <span style={{ marginRight: 4, fontSize: 10 }}>
            {isPlaying ? "\u25B6" : "\u275A\u275A"}
          </span>
        )}
        {track.title}
      </div>
      <div className="ipod-now-playing-artist">{track.artist}</div>

      {/* Scrubber — always visible, 3 states: loading, active, disabled */}
      <div className="ipod-playback-progress">
        <div
          className="ipod-playback-bar"
          style={isDisabled ? { background: "#E8E8E8" } : undefined}
        >
          {!isDisabled && (
            <>
              <div
                className="ipod-playback-fill"
                style={{
                  width: `${progress * 100}%`,
                  ...(isLoadingPreview ? { background: "#D0D0D0" } : {}),
                }}
              />
              <div
                className="ipod-playback-diamond"
                style={{
                  left: `${progress * 100}%`,
                  ...(isLoadingPreview ? { background: "#BBB", borderColor: "#AAA" } : {}),
                }}
              />
            </>
          )}
        </div>
        <div className="ipod-playback-times">
          {isLoadingPreview ? (
            <>
              <span>0:00</span>
              <span style={{ color: "#BBB" }}>Loading...</span>
            </>
          ) : isDisabled ? (
            <>
              <span style={{ color: "#CCC" }}>0:00</span>
              <span style={{ color: "#CCC" }}>No preview</span>
            </>
          ) : (
            <>
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? `-${formatTime(duration - currentTime)}` : "-0:00"}</span>
            </>
          )}
        </div>
      </div>

      {/* Platform links */}
      {resolved?.status === "resolved" && (
        <div className="ipod-now-playing-links">
          <PlatformLinksRow links={resolved.links} artist={track.artist} title={track.title} />
        </div>
      )}

      {/* Not found */}
      {resolved?.status === "not_found" && (
        <div style={{ fontSize: 11, color: "#999", textAlign: "center", marginTop: 4 }}>
          {resolved.notFoundReason || "No streaming links found"}
        </div>
      )}

      {/* Resolving */}
      {!resolved && isResolving && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span className="te-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          <span style={{ fontSize: 11, color: "#999" }}>Finding links...</span>
        </div>
      )}
    </div>
  );
}
