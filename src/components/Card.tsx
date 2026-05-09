"use client";

import { forwardRef } from "react";
import type { ScoreResult } from "@/lib/scoring";

const GROTESK = "var(--font-grotesk, sans-serif)";
const MONO = "var(--font-mono, monospace)";

const TIER_TAGLINES: Record<number, string> = {
  1: "YOU'RE SO UNWASHED YOU'RE ROAMING FREE",
  2: "YOU'RE NOT WASHED - WELL DONE",
  3: "YOU'RE A LITTLE BIT WASHED",
  4: "YOU ARE COMPLETELY WASHED",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#0A0A0A",
          fontWeight: 600,
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div
        style={{
          height: 2,
          background: "rgba(10,10,10,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function Avatar({ src, name, size, color }: { src: string; name: string; size: number; color: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: `3px solid ${color}`,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: GROTESK,
        fontWeight: 700,
        fontSize: size * 0.35,
        flexShrink: 0,
      }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

function Illustration({ tier, tierName }: { tier: number; tierName: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/illustrations/tier${tier}.png`}
      alt={tierName}
      style={{
        height: 300,
        width: "auto",
        position: "absolute",
        top: 40,
        right: 40,
        mixBlendMode: "multiply",
        pointerEvents: "none",
      }}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith(".svg")) {
          img.onerror = null;
          img.src = `/illustrations/tier${tier}.svg`;
        }
      }}
    />
  );
}

const Card = forwardRef<HTMLDivElement, { data: ScoreResult }>(function Card({ data }, ref) {
  const {
    handle,
    avatarUrl,
    followerCount,
    score,
    tier,
    tierName,
    accentColor,
    motion,
    conviction,
    volume,
    guardian,
  } = data;

  return (
    <div
      ref={ref}
      style={{
        width: 1200,
        height: 628,
        background: "#F5F4F0",
        display: "flex",
        flexDirection: "column",
        fontFamily: GROTESK,
        overflow: "hidden",
        borderRadius: 10,
      }}
    >
      {/* Accent line */}
      <div style={{ height: 3, background: accentColor, flexShrink: 0 }} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left column ── */}
        <div
          style={{
            flex: 1,
            padding: "40px 44px 36px 56px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            position: "relative",
          }}
        >
          {/* Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar src={avatarUrl} name={handle} size={120} color={accentColor} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 28,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                @{handle}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "rgba(10,10,10,0.55)",
                }}
              >
                {fmt(followerCount)} followers
              </span>
            </div>
          </div>

          {/* Score */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#0A0A0A",
                fontWeight: 700,
              }}
            >
              Washed Score
            </span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 128,
                  lineHeight: 1,
                  color: accentColor,
                  letterSpacing: "-0.02em",
                }}
              >
                {score}
              </span>
              <span
                style={{
                  fontFamily: GROTESK,
                  fontSize: 28,
                  fontWeight: 400,
                  color: "#0A0A0A",
                  opacity: 0.4,
                  marginLeft: 4,
                  alignSelf: "flex-end",
                  paddingBottom: 8,
                }}
              >
                /100
              </span>
            </div>
            <span
              style={{
                fontWeight: 500,
                fontSize: 42,
                lineHeight: 1.1,
                marginTop: 8,
                marginBottom: 24,
              }}
            >
              {tierName}
            </span>
          </div>

          {/* Illustration — absolutely positioned, top-right of left column */}
          <Illustration tier={tier} tierName={tierName} />

          {/* Bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: -16 }}>
            <Bar label="Engagement" value={motion} color={accentColor} />
            <Bar label="Credibility" value={conviction} color={accentColor} />
            <Bar label="Consistency" value={volume} color={accentColor} />
          </div>

          {/* Tier tagline */}
          <p
            style={{
              fontFamily: GROTESK,
              fontWeight: 700,
              fontSize: 18,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "#0A0A0A",
              margin: 0,
              position: "absolute",
              bottom: 36,
              left: 40,
            }}
          >
            {TIER_TAGLINES[tier] ?? ""}
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            background: "rgba(10,10,10,0.08)",
            alignSelf: "stretch",
            flexShrink: 0,
          }}
        />

        {/* ── Guardian column ── */}
        <div
          style={{
            width: 370,
            background: "#E8E2D9",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "40px 32px",
            gap: 0,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#0A0A0A",
              marginBottom: 24,
            }}
          >
            Your Guardian
          </span>

          {guardian ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <Avatar src={guardian.avatarUrl} name={guardian.handle} size={140} color="#0A0A0A" />
              </div>
              <span
                style={{
                  fontFamily: GROTESK,
                  fontWeight: 700,
                  fontSize: 22,
                  textAlign: "center",
                  marginBottom: 6,
                }}
              >
                @{guardian.handle}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "rgba(10,10,10,0.55)",
                  marginBottom: 20,
                }}
              >
                {fmt(guardian.followerCount)} followers
              </span>
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  lineHeight: 1.7,
                  textAlign: "center",
                  color: "rgba(10,10,10,0.5)",
                  margin: 0,
                  maxWidth: 200,
                }}
              >
                Your most famous recent supporter. Keeping you unwashed - or trying to.
              </p>
            </>
          ) : (
            <p
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: "rgba(10,10,10,0.38)",
                lineHeight: 1.6,
                margin: 0,
                textAlign: "center",
                maxWidth: 200,
              }}
            >
              No guardian found. You&apos;re out here alone.
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

export default Card;
