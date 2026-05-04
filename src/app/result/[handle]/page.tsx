"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import Card from "@/components/Card";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { ScoreResult } from "@/lib/scoring";

const GROTESK = "var(--font-grotesk, sans-serif)";
const MONO = "var(--font-mono, monospace)";
const CARBON = "#0A0A0A";
const OFF_WHITE = "#F5F4F0";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const handle = typeof params.handle === "string" ? params.handle : Array.isArray(params.handle) ? params.handle[0] : "";

  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!handle) return;
    const cached = sessionStorage.getItem(`washed:${handle.toLowerCase()}`);
    if (cached) {
      try {
        setResult(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        // fall through to re-fetch
      }
    }
    // Re-fetch if no cached result
    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error ?? "Request failed");
        setResult(data as ScoreResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [handle]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1200px) rotateY(${x * 12}deg) rotateX(${-y * 8}deg) scale(1.02)`;
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

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
        <h1
          onClick={() => router.push("/")}
          style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: "clamp(32px, 6vw, 64px)", letterSpacing: "-0.03em", color: CARBON, lineHeight: 1, margin: 0, cursor: "pointer" }}
        >
          Are You Washed?
        </h1>
      </div>

      {loading && <LoadingAnimation />}

      {error && (
        <div style={{ padding: "18px 24px", border: "1px solid rgba(255,45,85,0.28)", background: "rgba(255,45,85,0.05)", maxWidth: 560, width: "100%", textAlign: "center" }}>
          <p style={{ fontFamily: MONO, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "#FF2D55", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {!loading && result && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, width: "100%" }}>

          {/* Tilt wrapper at 50% scale */}
          <div
            ref={tiltRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{
              width: 600, height: 314,
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
              transformStyle: "preserve-3d",
              transition: "transform 120ms ease-out",
              borderRadius: 5,
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: "scale(0.5)" }}>
              <Card ref={cardRef} data={result} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={download}
              style={{ padding: "13px 28px", fontFamily: MONO, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", background: CARBON, color: OFF_WHITE, cursor: "pointer", border: "none" }}
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

          {/* Try another */}
          <button
            onClick={() => router.push("/")}
            style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(10,10,10,0.38)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Score another handle
          </button>

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
