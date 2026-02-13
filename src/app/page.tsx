"use client";

import { useState, useCallback, useRef } from "react";
import type { ScrapeResult, ResolveResult } from "@/lib/types";
import { UrlInput } from "@/components/url-input";
import { IpodShell } from "@/components/ipod/ipod-shell";
import { IpodTrackList } from "@/components/ipod/ipod-track-list";

export default function Home() {
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(
    null
  );
  const [isScraping, setIsScraping] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollHandlers = useRef<{ scrollUp: () => void; scrollDown: () => void } | null>(null);
  const menuHandler = useRef<(() => void) | null>(null);
  const selectHandler = useRef<(() => void) | null>(null);

  const handleSubmit = useCallback(async (url: string) => {
    setError(null);
    setResolveResult(null);
    setIsScraping(true);

    try {
      // Step 1: Scrape
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        setError(scrapeData.error || "Failed to scrape page");
        setIsScraping(false);
        return;
      }

      setScrapeResult(scrapeData);
      setIsScraping(false);

      if (scrapeData.tracks.length === 0) {
        return;
      }

      // Step 2: Auto-resolve
      setIsResolving(true);

      const resolveRes = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: scrapeData.tracks }),
      });

      const resolveData = await resolveRes.json();

      if (!resolveRes.ok) {
        setError(resolveData.error || "Failed to resolve links");
        setIsResolving(false);
        return;
      }

      setResolveResult(resolveData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsScraping(false);
      setIsResolving(false);
    }
  }, []);

  const isLoading = isScraping || isResolving;

  return (
    <div className="flex min-h-screen flex-col items-center">
      <main className="w-full max-w-2xl px-6 py-12">
        {/* Header */}
        <header className="mb-2">
          <h1
            className="font-medium tracking-tight text-[var(--te-text)]"
            style={{ fontFamily: "var(--font-instrument-serif), serif", fontSize: 64 }}
          >
            iScrape
          </h1>
        </header>

        {/* Subtitle */}
        <p
          className="mb-8 text-[15px] font-semibold text-[var(--te-text-secondary)]"
          style={{ fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          Paste a link and scrape the tracks.
        </p>

        {/* URL Input */}
        <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />

        {/* Error */}
        {error && (
          <div className="te-card mt-5 px-4 py-3" style={{ borderColor: "var(--te-red)", background: "var(--te-red-light)" }}>
            <p className="text-sm font-normal text-[var(--te-red)]">
              {error}
            </p>
          </div>
        )}

        {/* iPod — always visible */}
        <div className="mt-8 flex justify-center">
          <IpodShell
            onScrollUp={() => scrollHandlers.current?.scrollUp()}
            onScrollDown={() => scrollHandlers.current?.scrollDown()}
            onMenu={() => menuHandler.current?.()}
            onSelect={() => selectHandler.current?.()}
          >
            <IpodTrackList
              scrapeResult={scrapeResult}
              resolveResult={resolveResult}
              isScraping={isScraping}
              isResolving={isResolving}
              registerScrollHandlers={(h) => { scrollHandlers.current = h; }}
              registerMenuHandler={(h) => { menuHandler.current = h; }}
              registerSelectHandler={(h) => { selectHandler.current = h; }}
            />
          </IpodShell>
        </div>
      </main>
    </div>
  );
}
