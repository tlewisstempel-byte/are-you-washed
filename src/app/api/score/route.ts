import { NextRequest, NextResponse } from "next/server";
import { getTierForScore } from "@/lib/tiers";

export async function POST(req: NextRequest) {
  const { handle, scoreOverride } = await req.json();
  if (!handle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }

  const score = typeof scoreOverride === "number" ? Math.max(0, Math.min(100, scoreOverride)) : 20;
  const tier = getTierForScore(score);

  return NextResponse.json({
    handle: handle.replace(/^@/, ""),
    displayName: handle.replace(/^@/, ""),
    avatarUrl: `https://unavatar.io/twitter/${handle.replace(/^@/, "")}`,
    followerCount: 142000,
    score,
    tier: tier.number,
    tierName: tier.name,
    accentColor: tier.accentColor,
    motion: 12,
    conviction: 18,
    volume: 45,
    guardian: null,
  });
}
