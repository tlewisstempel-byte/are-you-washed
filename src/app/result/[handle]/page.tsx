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
  const [scale, setScale] = useState(0.75);

  const cardRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const scaleW = (window.innerWidth * 0.88) / 1200;
      const scaleH = (window.innerHeight * 0.62) / 628;
      setScale(Math.min(scaleW, scaleH));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!handle) return;

    const cached = sessionStorage.getItem(`washed:${handle.toLowerCase()}`);
    if (cached) {
      try {
        setResult(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        /* fall through */
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
    el.style.transform = `perspective(1800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    el.style.boxShadow = `${-rotateY * 3}px ${rotateX * 3 + 40}px 100px rgba(0,0,0,0.9), ${-rotateY}px ${rotateX + 12}px 30px rgba(0,0,0,0.6)`;
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = tiltRef.current;
    if (!el) return;

    el.style.transition = "transform 0.6s ease, box-shadow 0.6s ease";
    el.style.transform = "perspective(1800px) rotateX(0deg) rotateY(0deg) scale(1)";
    el.style.boxShadow = "0 40px 100px rgba(0,0,0,0.8), 0 8px 30px rgba(0,0,0,0.5)";

    setTimeout(() => {
      if (el) el.style.transition = "";
    }, 600);
  }, []);

  async function download() {
    if (!cardRef.current) return;

    const url = await toPng(cardRef.current, {
      width: 1200,
      height: 628,
      pixelRatio: 2,
    });

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

  const cardW = Math.round(1200 * scale);
  const cardH = Math.round(628 * scale);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: CARBON,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px 64px",
        gap: 48,
      }}
    >
      <h1
        onClick={() => router.push("/")}
        style={{
          fontFamily: GROTESK,
          fontWeight: 700,
          fontSize: "clamp(20px, 2.5vw, 36px)",
          letterSpacing: "-0.03em",
          color: OFF_WHITE,
          opacity: 0.96,
          lineHeight: 1,
          margin: 0,
          cursor: "pointer",
        }}
      >
        Are You Washed?
      </h1>

      {loading && <LoadingAnimation />}

      {error && (
        <div
          style={{
            padding: "18px 24px",
            border: "1px solid rgba(255,45,85,0.4)",
            background: "rgba(255,45,85,0.08)",
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
        <>
          <div
            ref={tiltRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{
              width: cardW,
              height: cardH,
              position: "relative",
              flexShrink: 0,
              transformStyle: "preserve-3d",
              borderRadius: Math.round(10 * scale),
              boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 8px 30px rgba(0,0,0,0.5)",
              cursor: "default",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transformOrigin: "top left",
                transform: `scale(${scale})`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <Card ref={cardRef} data={result} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={download}
              style={{
                padding: "14px 32px",
                fontFamily: MONO,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                background: OFF_WHITE,
                color: CARBON,
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
                color: OFF_WHITE,
                border: `1px solid rgba(245,244,240,0.3)`,
                cursor: "pointer",
              }}
            >
              Share on X
            </button>
          </div>

          <button
            onClick={() => router.push("/")}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(245,244,240,0.3)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              marginTop: -24,
            }}
          >
            Score Another Handle
          </button>
        </>
      )}
    </main>
  );
}
