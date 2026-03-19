import React from "react";

interface PACCLogoProps {
  className?: string;
  size?: number;
}

export function PACCLogo({ className = "", size = 32 }: PACCLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#7C3AED" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="12"
        fontWeight="700"
        fill="white"
        letterSpacing="-0.5"
      >
        P
      </text>
    </svg>
  );
}
