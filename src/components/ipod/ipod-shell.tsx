"use client";

import type { ReactNode } from "react";
import { useClickWheel } from "@/hooks/use-click-wheel";

interface Props {
  children: ReactNode;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onMenu?: () => void;
  onSelect?: () => void;
}

export function IpodShell({ children, onScrollUp, onScrollDown, onMenu, onSelect }: Props) {
  const { wheelRef, onPointerDown, onPointerMove, onPointerUp } = useClickWheel({
    onScrollUp: onScrollUp ?? (() => {}),
    onScrollDown: onScrollDown ?? (() => {}),
  });

  return (
    <div className="ipod-shell">
      {/* Screen */}
      <div className="ipod-screen">
        {children}
      </div>

      {/* Click Wheel */}
      <div
        className="ipod-wheel"
        ref={wheelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span
          className="ipod-wheel-label ipod-wheel-label-top"
          onClick={(e) => { e.stopPropagation(); onMenu?.(); }}
          style={{ cursor: "pointer" }}
        >
          MENU
        </span>
        <span className="ipod-wheel-label ipod-wheel-label-left">&#9664;&#9664;</span>
        <span className="ipod-wheel-label ipod-wheel-label-right">&#9654;&#9654;</span>
        <span className="ipod-wheel-label ipod-wheel-label-bottom">&#9654;&#10073;&#10073;</span>
        <div
          className="ipod-wheel-center"
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          style={{ cursor: "pointer" }}
        />
      </div>
    </div>
  );
}
