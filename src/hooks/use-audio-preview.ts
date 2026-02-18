"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseAudioPreviewReturn {
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  togglePlayPause: () => void;
  stop: () => void;
}

export function useAudioPreview(
  previewUrl: string | null
): UseAudioPreviewReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Create audio element once (client-side only)
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // When previewUrl changes, stop current playback and load new source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);

    if (previewUrl) {
      audio.src = previewUrl;
      audio.load();
    } else {
      audio.src = "";
    }
  }, [previewUrl]);

  // Attach event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !previewUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [previewUrl, isPlaying]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  return { isPlaying, progress, currentTime, duration, togglePlayPause, stop };
}
