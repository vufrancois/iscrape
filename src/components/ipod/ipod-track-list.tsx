"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ScrapeResult, ResolveResult } from "@/lib/types";
import { IpodHeader } from "./ipod-header";
import { IpodTrackRow } from "./ipod-track-row";
import { IpodNowPlaying } from "./ipod-now-playing";

interface ScrollHandlers {
  scrollUp: () => void;
  scrollDown: () => void;
}

interface Props {
  scrapeResult: ScrapeResult;
  resolveResult: ResolveResult | null;
  isResolving: boolean;
  registerScrollHandlers?: (handlers: ScrollHandlers) => void;
  registerMenuHandler?: (handler: () => void) => void;
  registerSelectHandler?: (handler: () => void) => void;
}

export function IpodTrackList({
  scrapeResult,
  resolveResult,
  isResolving,
  registerScrollHandlers,
  registerMenuHandler,
  registerSelectHandler,
}: Props) {
  const { tracks } = scrapeResult;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<"list" | "detail">("list");
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolvedMap = new Map(
    resolveResult?.tracks.map((t) => [t.position, t]) ?? []
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, tracks.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (view === "list") setView("detail");
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (view === "detail") setView("list");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tracks.length, view]);

  // Register scroll handlers for click wheel
  useEffect(() => {
    if (registerScrollHandlers) {
      registerScrollHandlers({
        scrollUp: () => setSelectedIndex((i) => Math.max(i - 1, 0)),
        scrollDown: () => setSelectedIndex((i) => Math.min(i + 1, tracks.length - 1)),
      });
    }
  }, [registerScrollHandlers, tracks.length]);

  // Register MENU handler
  useEffect(() => {
    if (registerMenuHandler) {
      registerMenuHandler(() => setView("list"));
    }
  }, [registerMenuHandler]);

  // Register SELECT (center button) handler
  useEffect(() => {
    if (registerSelectHandler) {
      registerSelectHandler(() => {
        if (view === "list") setView("detail");
      });
    }
  }, [registerSelectHandler, view]);

  // Auto-scroll selected row into view (list view only)
  useEffect(() => {
    if (view !== "list") return;
    const row = rowRefs.current[selectedIndex];
    if (row && scrollRef.current) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, view]);

  const setRowRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    rowRefs.current[index] = el;
  }, []);

  const showLoading = isResolving && !resolveResult;
  const showTracks = !showLoading;

  const currentTrack = tracks[selectedIndex];
  const currentResolved = currentTrack ? resolvedMap.get(currentTrack.position) : undefined;

  return (
    <>
      <IpodHeader
        title={view === "detail" ? "Now Playing" : "Scraped Tracklist"}
        isLoading={showLoading}
      />

      {/* Progress bar while resolving */}
      {view === "list" && showLoading && (
        <div className="ipod-screen-scroll" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
        }}>
          <div style={{
            width: "80%",
            height: 4,
            background: "#E0E0E0",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div className="ipod-progress-bar" />
          </div>
          <span style={{
            marginTop: 12,
            fontSize: 11,
            color: "#888",
            fontFamily: "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif",
          }}>
            Resolving {tracks.length} tracks...
          </span>
        </div>
      )}

      {/* List view */}
      {view === "list" && showTracks && (
        <>
          {/* Stats row */}
          {resolveResult && (
            <div className="ipod-row" style={{ background: "#F8F8F8", minHeight: 22, fontSize: 10, color: "#888", cursor: "default" }}>
              <span>{tracks.length} tracks</span>
              <span style={{ marginLeft: "auto" }}>
                {resolveResult.stats.resolved} found
                {resolveResult.stats.notFound > 0 && ` · ${resolveResult.stats.notFound} missing`}
              </span>
            </div>
          )}

          {/* Scrollable track list */}
          <div className="ipod-screen-scroll" ref={scrollRef}>
            {tracks.map((track, i) => (
              <IpodTrackRow
                key={track.position}
                ref={setRowRef(i)}
                track={track}
                resolved={resolvedMap.get(track.position)}
                isSelected={i === selectedIndex}
                onClick={() => { setSelectedIndex(i); setView("detail"); }}
              />
            ))}
          </div>
        </>
      )}

      {/* Detail view */}
      {view === "detail" && currentTrack && (
        <IpodNowPlaying
          track={currentTrack}
          resolved={currentResolved}
          isResolving={isResolving}
        />
      )}
    </>
  );
}
