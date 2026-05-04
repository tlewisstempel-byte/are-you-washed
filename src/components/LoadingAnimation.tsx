"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Checking your last 10 posts...",
  "Calculating engagement rate...",
  "Measuring conviction ratio...",
  "Finding your guardian...",
  "Almost there...",
];

export default function LoadingAnimation() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "64px 24px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 8, height: 8, borderRadius: "50%", background: "#0A0A0A", display: "inline-block",
              animation: `dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <p
        style={{
          fontFamily: "var(--font-mono, monospace)", fontSize: 12, textTransform: "uppercase",
          letterSpacing: "0.12em", color: "#0A0A0A", opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease-out", margin: 0, textAlign: "center",
        }}
      >
        {PHRASES[index]}
      </p>
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
