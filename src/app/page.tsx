"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import Card from "@/components/Card";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { ScoreResult } from "@/lib/scoring";

type Phase = "idle" | "loading" | "done" | "error";

const GROTESK = "var(--font-grotesk, sans-serif)";
const MONO = "var(--font-mono, monospace)";
const CARBON = "#0A0A0A";
const OFF_WHITE = "#F5F4F0";

export default function Home() {
  const [handle, setHandle] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = handle.replace(/^@/, "").trim();
    if (!h) return;
    setPhase("loading");
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: h }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data as ScoreResult);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }

  async function download() {
    if (!cardRef.current) return;
    const url = await toPng(cardRef.current, { width: 1200, height: 628, pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `washed-${result?.handle ?? "score"}.png`;
    a.click();
  }

  function shareOnX() {
    if (!result) return;
    const text = `My washed score is ${result.score}/100 — ${result.tierName}.\n\nFind out if you're washed: areyouwashed.xyz`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener noreferrer"
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: OFF_WHITE, display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 24px 60px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <h1 style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: "clamp(48px, 9vw, 96px)", letterSpacing: "-0.03em", color: CARBON, lineHeight: 1, margin: 0 }}>
          Are You Washed?
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(10,10,10,0.42)", marginTop: 20 }}>
          Enter an X handle. Get your score. Share the shame (or the flex).
        </p>
      </div>

      {/* Input */}
      <form onSubmit={submit} style={{ display: "flex", width: "100%", maxWidth: 560, marginBottom: 60 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontFamily: GROTESK, fontSize: 18, color: "rgba(10,10,10,0.32)", pointerEvents: "none", userSelect: "none" }}>
            @
          </span>
          <input
            type="text"
            placeholder="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            disabled={phase === "loading"}
            style={{
              width: "100%", padding: "16px 16px 16px 36px",
              fontFamily: GROTESK, fontSize: 18, color: CARBON,
              background: "#fff", border: `1px solid rgba(10,10,10,0.18)`,
              borderRight: "none", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={phase === "loading" || !handle.trim()}
          style={{
            padding: "16px 32px", fontFamily: MONO, fontSize: 11,
            textTransform: "uppercase", letterSpacing: "0.12em",
            background: CARBON, color: OFF_WHITE, flexShrink: 0,
            opacity: phase === "loading" || !handle.trim() ? 0.45 : 1,
            cursor: phase === "loading" || !handle.trim() ? "not-allowed" : "pointer",
            transition: "opacity 200ms",
          }}
        >
          Score me
        </button>
      </form>

      {/* Loading */}
      {phase === "loading" && <LoadingAnimation />}

      {/* Error */}
      {phase === "error" && (
        <div style={{ padding: "18px 24px", border: "1px solid rgba(255,45,85,0.28)", background: "rgba(255,45,85,0.05)", maxWidth: 560, width: "100%", textAlign: "center" }}>
          <p style={{ fontFamily: MONO, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "#FF2D55", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Result */}
      {phase === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, width: "100%" }}>

          {/* Card at 50% scale */}
          <div style={{ width: 600, height: 314, position: "relative", overflow: "hidden", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: "scale(0.5)" }}>
              <Card ref={cardRef} data={result} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={download}
              style={{ padding: "13px 28px", fontFamily: MONO, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", background: CARBON, color: OFF_WHITE, cursor: "pointer" }}
            >
              Download Card
            </button>
            <button
              onClick={shareOnX}
              style={{ padding: "13px 28px", fontFamily: MONO, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", background: "transparent", color: CARBON, border: `1px solid ${CARBON}`, cursor: "pointer" }}
            >
              Share on X
            </button>
          </div>

          {/* Attribution */}
          <a
            href="https://different.agency"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(10,10,10,0.38)", textDecoration: "underline" }}
          >
            Want to work with the best? → different.agency
          </a>
        </div>
      )}
    </main>
  );
}
