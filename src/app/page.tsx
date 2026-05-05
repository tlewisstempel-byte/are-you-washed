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
  const [scoreOverride, setScoreOverride] = useState("");
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
        body: JSON.stringify({
          handle: h,
          scoreOverride: scoreOverride ? Number(scoreOverride) : undefined,
        }),
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
        background: OFF_WHITE,
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
            color: CARBON,
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
            color: "rgba(10,10,10,0.42)",
            marginTop: 28,
          }}
        >
          Enter an X handle. Get your score. Share the shame (or the flex).
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
            ? "0 14px 32px rgba(10,10,10,0.08)"
            : "0 0 0 rgba(10,10,10,0)",
          transition:
            "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <span
            styl
