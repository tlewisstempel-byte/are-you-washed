import { getTierForScore } from "./tiers";

export interface Tweet {
  likeCount: number;
  replyCount: number;
  bookmarkCount: number;
  createdAt: string;
}

export interface UserProfile {
  handle: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  tweets: Tweet[];
}

export interface Guardian {
  handle: string;
  avatarUrl: string;
  followerCount: number;
}

export interface ScoreResult {
  handle: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  score: number;
  tier: 1 | 2 | 3 | 4;
  tierName: string;
  accentColor: string;
  motion: number;
  conviction: number;
  volume: number;
  guardian: Guardian | null;
}

function calcMotion(tweets: Tweet[], followerCount: number): number {
  const totalWeighted = tweets.reduce(
    (sum, t) => sum + t.bookmarkCount * 3 + t.replyCount * 2 + t.likeCount,
    0
  );
  const rawRate = totalWeighted / Math.max(followerCount, 1);
  return Math.round(Math.min(rawRate / 0.1, 1) * 100);
}

function calcConviction(followerCount: number, followingCount: number): number {
  const ratio = followerCount / Math.max(followingCount, 1);
  return Math.round(Math.min(ratio / 50, 1) * 100);
}

function calcVolume(tweets: Tweet[]): number {
  if (tweets.length < 2) return 0;
  const sorted = [...tweets].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const days =
    (new Date(sorted[sorted.length - 1].createdAt).getTime() -
      new Date(sorted[0].createdAt).getTime()) /
    86_400_000;
  if (days === 0) return 100;
  const tpw = tweets.length / (days / 7);
  if (tpw < 1) return Math.round(tpw * 30);
  if (tpw <= 10) return Math.round(30 + (tpw / 10) * 70);
  return Math.max(Math.round(100 - (tpw - 10) * 5), 20);
}

export function calculateScore(
  profile: UserProfile,
  guardian: Guardian | null
): ScoreResult {
  const motion = calcMotion(profile.tweets, profile.followerCount);
  const conviction = calcConviction(profile.followerCount, profile.followingCount);
  const volume = calcVolume(profile.tweets);
  const score = Math.max(
    0,
    Math.min(100, Math.round(motion * 0.5 + conviction * 0.3 + volume * 0.2))
  );
  const tier = getTierForScore(score);
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    followerCount: profile.followerCount,
    score,
    tier: tier.number,
    tierName: tier.name,
    accentColor: tier.accentColor,
    motion,
    conviction,
    volume,
    guardian,
  };
}
