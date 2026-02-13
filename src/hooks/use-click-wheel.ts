"use client";

import { useRef, useCallback, type PointerEvent } from "react";

interface UseClickWheelOptions {
  onScrollUp: () => void;
  onScrollDown: () => void;
  threshold?: number; // degrees per step, default 15
}

export function useClickWheel({
  onScrollUp,
  onScrollDown,
  threshold = 15,
}: UseClickWheelOptions) {
  const isTracking = useRef(false);
  const lastAngle = useRef(0);
  const accumulated = useRef(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  const getAngle = useCallback((clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const isInRing = useCallback((clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
    const outerRadius = rect.width / 2;
    const innerRadius = 36; // center button radius
    return dist >= innerRadius && dist <= outerRadius;
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isInRing(e.clientX, e.clientY)) return;
      isTracking.current = true;
      lastAngle.current = getAngle(e.clientX, e.clientY);
      accumulated.current = 0;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getAngle, isInRing]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isTracking.current) return;
      const angle = getAngle(e.clientX, e.clientY);
      let delta = angle - lastAngle.current;

      // Handle wrap-around at ±180°
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      accumulated.current += delta;
      lastAngle.current = angle;

      if (accumulated.current >= threshold) {
        onScrollDown();
        accumulated.current = 0;
      } else if (accumulated.current <= -threshold) {
        onScrollUp();
        accumulated.current = 0;
      }
    },
    [getAngle, threshold, onScrollDown, onScrollUp]
  );

  const onPointerUp = useCallback(() => {
    isTracking.current = false;
    accumulated.current = 0;
  }, []);

  return { wheelRef, onPointerDown, onPointerMove, onPointerUp };
}
