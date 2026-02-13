"use client";

import { useState, type FormEvent } from "react";

interface Props {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a URL");
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError("Please enter a valid URL (e.g., https://example.com/...)");
      return;
    }

    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="Paste a source URL..."
            disabled={isLoading}
            className="te-input w-full py-3 pl-4 pr-4 font-semibold disabled:opacity-50"
            style={{ fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif' }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="aqua-button shrink-0 px-6 py-3 font-semibold"
          style={{ fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="te-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            </span>
          ) : (
            "Import"
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--te-red)]">
          {error}
        </p>
      )}
    </form>
  );
}
