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
  const handle =
    typeof params.handle === "string"
      ? params.handle
      : Array.isArray(params.handle)
      ? params.handle[0]
      : "";

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

  // 3D tilt — animates transform AND box-shadow together
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const MAX_TILT = 10;
    const rotateY = x * MAX_TILT * 2;
    const rotateX = -y * MAX_TILT * 2;
    el.style.transition = "";
    el.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
    el.style.boxShadow = `${-rotateY * 1.5}px ${rotateX * 1.5 + 16}px 40px rgba(0,0,0,0.18)`;
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transition = "transform 0.5s ease, box-shadow 0.5s ease";
    el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)";
    el.style.boxShadow = "4px 8px 24px rgba(0,0,0,0.10)";
    setTimeout(() => {
      if (el) el.style.transition = "";
    }, 500);
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
    <main
      style={{
        minHeight: "100vh",
        background: OFF_WHITE,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
      }}
    >
      {/* Header — faded, acts as a back button */}
      <h1
        onClick={() => router.push("/")}
        style={{
          fontFamily: GROTESK,
          fontWeight: 700,
          fontSize: "clamp(28px, 4vw, 48px)",
          letterSpacing: "-0.03em",
          color: CARBON,
          lineHeight: 1,
          margin: "0 0 64px",
          cursor: "pointer",
          opacity: 0.15,
        }}
      >
        Are You Washed?
      </h1>

      {loading && <LoadingAnimation />}

      {error && (
        <div
          style={{
            padding: "18px 24px",
            border: "1px solid rgba(255,45,85,0.28)",
            background: "rgba(255,45,85,0.05)",
            maxWidth: 560,
            width: "100%",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: MONO,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#FF2D55",
              margin: 0,
            }}
          >
            {error}
          </p>
        </div>
      )}

      {!loading && result && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 40,
            width: "100%",
          }}
        >
          {/* Tilt wrapper — card displayed at 50% scale (600×314) */}
          <div
            ref={tiltRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{
              width: 600,
              height: 314,
              position: "relative",
              flexShrink: 0,
              transformStyle: "preserve-3d",
              borderRadius: 5,
              boxShadow: "4px 8px 24px rgba(0,0,0,0.10)",
              cursor: "default",
            }}
          >
            {/* Scale the 1200×628 card down to 50% */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transformOrigin: "top left",
                transform: "scale(0.5)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <Card ref={cardRef} data={result} />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={download}
              style={{
                padding: "14px 32px",
                fontFamily: MONO,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                background: CARBON,
                color: OFF_WHITE,
                cursor: "pointer",
                border: "none",
              }}
            >
              Download Card
            </button>
            <button
              onClick={shareOnX}
              style={{
                padding: "14px 32px",
                fontFamily: MONO,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                background: "transparent",
                color: CARBON,
                border: `1px solid ${CARBON}`,
                cursor: "pointer",
              }}
            >
              Share on X
            </button>
          </div>

          {/* Score another */}
          <button
            onClick={() => router.push("/")}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(10,10,10,0.35)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Score Another Handle
          </button>

          {/* Attribution */}
          <a
            href="https://different.agency"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: MONO,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(10,10,10,0.28)",
              textDecoration: "none",
              marginTop: -16,
            }}
          >
            Want to work with the best? → different.agency
          </a>
        </div>
      )}
    </main>
  );
}
