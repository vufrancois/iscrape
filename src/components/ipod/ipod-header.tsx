"use client";

interface Props {
  title: string;
  isLoading?: boolean;
  isPlaying?: boolean;
}

function BatteryIcon() {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
      <rect x="0.5" y="0.5" width="16" height="9" rx="1.5" stroke="#333" strokeWidth="1" />
      <rect x="17" y="3" width="2.5" height="4" rx="0.5" fill="#333" />
      <rect x="2" y="2" width="10" height="6" rx="0.5" fill="#4CD964" />
    </svg>
  );
}

export function IpodHeader({ title, isLoading, isPlaying }: Props) {
  return (
    <div className="ipod-header">
      <span className="ipod-header-title">
        {isPlaying && (
          <span style={{ marginRight: 4, fontSize: 9 }}>{"\u25B6"}</span>
        )}
        {isLoading ? "Loading..." : title}
      </span>
      <BatteryIcon />
    </div>
  );
}
