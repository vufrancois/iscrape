"use client";

import Image from "next/image";
import type { ScrapedTrack, ResolvedTrack } from "@/lib/types";
import { PlatformLinksRow } from "../platform-links";

interface Props {
  track: ScrapedTrack;
  resolved?: ResolvedTrack;
  isResolving?: boolean;
}

export function IpodNowPlaying({ track, resolved, isResolving }: Props) {
  return (
    <div className="ipod-now-playing">
      {/* Album art */}
      <div className="ipod-now-playing-art">
        {resolved?.thumbnail ? (
          <Image
            src={resolved.thumbnail}
            alt=""
            width={140}
            height={140}
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

      {/* Track title & artist */}
      <div className="ipod-now-playing-title">{track.title}</div>
      <div className="ipod-now-playing-artist">{track.artist}</div>

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
