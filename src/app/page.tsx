"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { ScoreResult } from "@/lib/scoring";

type Phase = "idle" | "loading" | "error";

const GROTESK = "var(--font-grotesk, sans-serif)";
const MONO = "var(--font-mono, monospace)";
const CARBON = "#0A0A0A";
const OFF_WHITE = "#F5F4F0";

export default function Home() {
  const [handle, setHandle] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = handle.replace(/^@/, "").trim();
    if (!h) return;
    setPhase("loading");
    setError("");

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: h }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      sessionStorage.setItem(`washed:${h.toLowerCase()}`, JSON.stringify(data as ScoreResult));
      router.push(`/result/${h}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }

  const formInteractive = isHovered || isFocused;
  const canSubmit = phase !== "loading" && !!handle.trim();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: CARBON,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "104px 24px 72px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 72 }}>
        <h1
          style={{
            fontFamily: GROTESK,
            fontWeight: 700,
            fontSize: "clamp(56px, 10vw, 108px)",
            letterSpacing: "-0.04em",
            color: OFF_WHITE,
            lineHeight: 0.96,
            margin: 0,
          }}
        >
          Are You Washed?
        </h1>

        <p
          style={{
            fontFamily: MONO,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(245,244,240,0.38)",
            marginTop: 28,
          }}
        >
          Enter an X handle. See if you&apos;re washed or not.
        </p>
      </div>

      {/* Input */}
      <form
        onSubmit={submit}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "flex",
          width: "100%",
          maxWidth: 640,
          marginBottom: 76,
          transform: formInteractive ? "translateY(-2px) scale(1.012)" : "translateY(0) scale(1)",
          boxShadow: formInteractive
            ? "0 14px 32px rgba(0,0,0,0.4)"
            : "0 0 0 rgba(0,0,0,0)",
          transition:
            "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 18,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: GROTESK,
              fontSize: 18,
              color: isFocused ? "rgba(245,244,240,0.5)" : "rgba(245,244,240,0.28)",
              pointerEvents: "none",
              userSelect: "none",
              transition: "color 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            @
          </span>

          <input
            type="text"
            placeholder="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={phase === "loading"}
            style={{
              width: "100%",
              padding: "20px 18px 20px 36px",
              fontFamily: GROTESK,
              fontSize: 20,
              color: OFF_WHITE,
              background: "rgba(245,244,240,0.06)",
              border: `1px solid ${
                isFocused
                  ? "rgba(245,244,240,0.24)"
                  : formInteractive
                  ? "rgba(245,244,240,0.16)"
                  : "rgba(245,244,240,0.10)"
              }`,
              borderRight: "none",
              outline: "none",
              boxSizing: "border-box",
              transition:
                "border-color 180ms cubic-bezier(0.16, 1, 0.3, 1), background 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "20px 34px",
            minWidth: 184,
            fontFamily: MONO,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            background: canSubmit ? OFF_WHITE : "rgba(245,244,240,0.18)",
            color: canSubmit ? CARBON : "rgba(245,244,240,0.4)",
            flexShrink: 0,
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition:
              "background 180ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {phase === "loading" ? "Scoring..." : "Score me"}
        </button>
      </form>

      {/* Loading */}
      {phase === "loading" && <LoadingAnimation />}

      {/* Error */}
      {phase === "error" && (
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
    </main>
  );
}
