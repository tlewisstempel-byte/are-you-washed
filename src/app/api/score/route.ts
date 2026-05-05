import { NextRequest, NextResponse } from "next/server";
import { getTier } from "@/lib/tiers";

export async function POST(req: NextRequest) {
  const { handle } = await req.json();
  if (!handle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }

  const score = 20;
  const tier = getTier(score);

  return NextResponse.json({
    handle: handle.replace(/^@/, ""),
    displayName: handle.replace(/^@/, ""),
    avatarUrl: `https://unavatar.io/twitter/${handle.replace(/^@/, "")}`,
    followerCount: 142000,
    score,
    tier: tier.tier,
    tierName: tier.name,
    accentColor: tier.color,
    motion: 12,
    conviction: 18,
    volume: 45,
    guardian: null,
  });
}
