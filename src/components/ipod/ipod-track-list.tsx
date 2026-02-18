"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ScrapeResult, ResolveResult } from "@/lib/types";
import { IpodHeader } from "./ipod-header";
import { IpodTrackRow } from "./ipod-track-row";
import { IpodNowPlaying } from "./ipod-now-playing";
import { useAudioPreview } from "@/hooks/use-audio-preview";

interface ScrollHandlers {
  scrollUp: () => void;
  scrollDown: () => void;
}

interface Props {
  scrapeResult: ScrapeResult | null;
  resolveResult: ResolveResult | null;
  isScraping: boolean;
  isResolving: boolean;
  registerScrollHandlers?: (handlers: ScrollHandlers) => void;
  registerMenuHandler?: (handler: () => void) => void;
  registerSelectHandler?: (handler: () => void) => void;
  registerPlayPauseHandler?: (handler: () => void) => void;
}

export function IpodTrackList({
  scrapeResult,
  resolveResult,
  isScraping,
  isResolving,
  registerScrollHandlers,
  registerMenuHandler,
  registerSelectHandler,
  registerPlayPauseHandler,
}: Props) {
  const tracks = scrapeResult?.tracks ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<"list" | "detail">("list");
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const previewCacheRef = useRef<Map<string, string | null>>(new Map());

  const { isPlaying, progress, currentTime, duration, togglePlayPause, stop } =
    useAudioPreview(previewUrl);

  // Reset selection when new scrape results arrive
  const scrapeUrl = scrapeResult?.url;
  useEffect(() => {
    setSelectedIndex(0);
    setView("list");
    stop();
    setPreviewUrl(null);
    setPreviewError(false);
    previewCacheRef.current.clear();
  }, [scrapeUrl, stop]);

  const resolvedMap = new Map(
    resolveResult?.tracks.map((t) => [t.position, t]) ?? []
  );

  const currentTrack = tracks[selectedIndex];
  const currentResolved = currentTrack
    ? resolvedMap.get(currentTrack.position)
    : undefined;

  // Cache key for the current track
  const trackCacheKey = currentTrack
    ? `${currentTrack.artist.toLowerCase()}::${currentTrack.title.toLowerCase()}`
    : "";

  // Auto-fetch preview when entering detail view or changing track while in detail
  useEffect(() => {
    if (view !== "detail" || !currentTrack) return;

    const cacheKey = `${currentTrack.artist.toLowerCase()}::${currentTrack.title.toLowerCase()}`;

    // Check cache first
    if (previewCacheRef.current.has(cacheKey)) {
      const cached = previewCacheRef.current.get(cacheKey) ?? null;
      setPreviewUrl(cached);
      setPreviewError(cached === null);
      setIsLoadingPreview(false);
      return;
    }

    // Fetch from Deezer
    let cancelled = false;
    setIsLoadingPreview(true);
    setPreviewError(false);
    setPreviewUrl(null);

    fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artist: currentTrack.artist,
        title: currentTrack.title,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const url: string | null = data.previewUrl || null;
        previewCacheRef.current.set(cacheKey, url);
        setPreviewUrl(url);
        setPreviewError(url === null);
      })
      .catch(() => {
        if (cancelled) return;
        previewCacheRef.current.set(cacheKey, null);
        setPreviewError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, trackCacheKey]);

  // Toggle play/pause
  const handlePlayPause = useCallback(() => {
    if (view !== "detail") return;
    if (previewUrl) {
      togglePlayPause();
    }
  }, [view, previewUrl, togglePlayPause]);

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
        else handlePlayPause();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (view === "detail") {
          stop();
          setView("list");
        }
      } else if (e.key === " ") {
        e.preventDefault();
        if (view === "detail") handlePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tracks.length, view, handlePlayPause, stop]);

  // Register scroll handlers for click wheel
  useEffect(() => {
    if (registerScrollHandlers) {
      registerScrollHandlers({
        scrollUp: () => setSelectedIndex((i) => Math.max(i - 1, 0)),
        scrollDown: () =>
          setSelectedIndex((i) => Math.min(i + 1, tracks.length - 1)),
      });
    }
  }, [registerScrollHandlers, tracks.length]);

  // Register MENU handler
  useEffect(() => {
    if (registerMenuHandler) {
      registerMenuHandler(() => {
        stop();
        setView("list");
      });
    }
  }, [registerMenuHandler, stop]);

  // Register SELECT (center button) handler
  useEffect(() => {
    if (registerSelectHandler) {
      registerSelectHandler(() => {
        if (view === "list") setView("detail");
        else handlePlayPause();
      });
    }
  }, [registerSelectHandler, view, handlePlayPause]);

  // Register PLAY/PAUSE handler (bottom wheel button)
  useEffect(() => {
    if (registerPlayPauseHandler) {
      registerPlayPauseHandler(() => {
        handlePlayPause();
      });
    }
  }, [registerPlayPauseHandler, handlePlayPause]);

  // Auto-scroll selected row into view (list view only)
  useEffect(() => {
    if (view !== "list") return;
    const row = rowRefs.current[selectedIndex];
    if (row && scrollRef.current) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, view]);

  const setRowRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      rowRefs.current[index] = el;
    },
    []
  );

  const showLoading = isResolving && !resolveResult;
  const showTracks = !showLoading;
  const hasResults = tracks.length > 0;

  return (
    <>
      <IpodHeader
        title={
          view === "detail"
            ? "Now Playing"
            : hasResults
              ? "Scraped Tracklist"
              : "iScrape"
        }
        isLoading={showLoading || isScraping}
        isPlaying={view === "detail" && isPlaying}
      />

      {/* Idle state — no results yet */}
      {!hasResults && !isScraping && (
        <div
          className="ipod-screen-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            color: "#999",
            fontSize: 12,
            fontFamily:
              "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            textAlign: "center",
            gap: 8,
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#CCC"
            strokeWidth="1.5"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Paste a link above to get started</span>
        </div>
      )}

      {/* Scraping in progress */}
      {!hasResults && isScraping && (
        <div
          className="ipod-screen-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
          }}
        >
          <div
            style={{
              width: "80%",
              height: 4,
              background: "#E0E0E0",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div className="ipod-progress-bar" />
          </div>
          <span
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "#888",
              fontFamily:
                "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            Scanning tracklist...
          </span>
        </div>
      )}

      {/* Progress bar while resolving */}
      {hasResults && view === "list" && showLoading && (
        <div
          className="ipod-screen-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
          }}
        >
          <div
            style={{
              width: "80%",
              height: 4,
              background: "#E0E0E0",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div className="ipod-progress-bar" />
          </div>
          <span
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "#888",
              fontFamily:
                "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            Resolving {tracks.length} tracks...
          </span>
        </div>
      )}

      {/* List view */}
      {hasResults && view === "list" && showTracks && (
        <>
          {/* Stats row */}
          {resolveResult && (
            <div
              className="ipod-row"
              style={{
                background: "#F8F8F8",
                minHeight: 22,
                fontSize: 10,
                color: "#888",
                cursor: "default",
              }}
            >
              <span>{tracks.length} tracks</span>
              <span style={{ marginLeft: "auto" }}>
                {resolveResult.stats.resolved} found
                {resolveResult.stats.notFound > 0 &&
                  ` · ${resolveResult.stats.notFound} missing`}
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
                onClick={() => {
                  setSelectedIndex(i);
                  setView("detail");
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Detail view */}
      {hasResults && view === "detail" && currentTrack && (
        <IpodNowPlaying
          track={currentTrack}
          resolved={currentResolved}
          isResolving={isResolving}
          isPlaying={isPlaying}
          progress={progress}
          currentTime={currentTime}
          duration={duration}
          isLoadingPreview={isLoadingPreview}
          previewError={previewError}
          previewUrl={previewUrl}
        />
      )}
    </>
  );
}
