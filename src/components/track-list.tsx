"use client";

import type { ScrapeResult, ResolveResult } from "@/lib/types";
import { TrackRow } from "./track-row";

interface Props {
  scrapeResult: ScrapeResult;
  resolveResult: ResolveResult | null;
  isResolving: boolean;
}

export function TrackList({ scrapeResult, resolveResult, isResolving }: Props) {
  const { tracks, metadata, warnings } = scrapeResult;

  const resolvedMap = new Map(
    resolveResult?.tracks.map((t) => [t.position, t]) ?? []
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4">
        {(metadata?.episodeTitle || metadata?.pageTitle) && (
          <h2 className="text-base font-medium text-[var(--te-text)]">
            {metadata.episodeTitle || metadata.pageTitle}
          </h2>
        )}

        {/* Stats bar */}
        <div className="mt-2 flex items-center gap-3 text-xs font-normal uppercase tracking-wide">
          <span className="text-[var(--te-text-secondary)]">
            {tracks.length} tracks
          </span>
          {resolveResult && (
            <>
              <span className="text-[var(--te-green)]">
                {resolveResult.stats.resolved} resolved
              </span>
              {resolveResult.stats.notFound > 0 && (
                <span className="text-[var(--te-amber-dark)]">
                  {resolveResult.stats.notFound} not found
                </span>
              )}
              {resolveResult.stats.errors > 0 && (
                <span className="text-[var(--te-red)]">
                  {resolveResult.stats.errors} errors
                </span>
              )}
            </>
          )}
          {isResolving && (
            <span className="inline-flex items-center gap-2 text-[var(--te-text-secondary)]">
              <span className="te-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
              Resolving...
            </span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="te-card mb-4 px-4 py-3" style={{ borderColor: "var(--te-amber-dark)", background: "var(--te-amber-light)" }}>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-[var(--te-amber-dark)]">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Track rows */}
      <div className="te-card divide-y divide-[var(--te-border)] overflow-hidden">
        {tracks.map((track) => (
          <TrackRow
            key={track.position}
            track={track}
            resolved={resolvedMap.get(track.position)}
            isResolving={isResolving}
          />
        ))}
      </div>
    </div>
  );
}
