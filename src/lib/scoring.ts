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
  return Math.round(Math.min(rawRate / 0.2, 1) * 100);
}

function calcConviction(followerCount: number, followingCount: number): number {
  const ratio = followingCount > 0 ? followerCount / followingCount : followerCount > 0 ? 10 : 1;
  const ratioScore = Math.min(100, (ratio / 5) * 100);
  const scaleScore = followerCount > 0
    ? Math.min(100, (Math.log10(followerCount) / 6) * 100)
    : 0;
  return Math.round(ratioScore * 0.5 + scaleScore * 0.5);
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
  let raw: number;
  if (tpw < 1) raw = Math.round(tpw * 30);
  else if (tpw <= 10) raw = Math.round(30 + (tpw / 10) * 70);
  else raw = Math.max(Math.round(100 - (tpw - 10) * 5), 20);
  return Math.max(35, raw);
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
    Math.min(100, Math.round(motion * 0.4 + conviction * 0.4 + volume * 0.2))
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
