import { UserProfile, Tweet, Guardian } from "./scoring";
import { calculateScore } from "./scoring";
import type { ScoreResult } from "./scoring";

const BASE = "https://api.apify.com/v2";
const ACTOR = "apidojo~tweet-scraper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApifyItem = Record<string, any>;

function getNum(obj: ApifyItem, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number") return v;
  }
  return 0;
}

function getStr(obj: ApifyItem, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Start an Apify run for a handle. Returns the runId immediately (< 1s). */
export async function startProfileRun(handle: string): Promise<string> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  const res = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: `https://twitter.com/${handle}` }],
      maxTweets: 15,
      maxRequestRetries: 2,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["DATACENTER"],
      },
    }),
  });

  if (!res.ok) throw new Error(`Apify start failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data.id as string;
}

/** Check the status of a run. Returns the raw Apify status string. */
export async function getRunStatus(runId: string): Promise<string> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  const res = await fetch(`${BASE}/actor-runs/${runId}?token=${token}`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  const { data } = await res.json();
  return data.status as string;
}

/** Fetch items from a completed run and compute the ScoreResult. */
export async function buildScoreFromRun(
  handle: string,
  runId: string
): Promise<ScoreResult> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  const res = await fetch(
    `${BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=50`
  );
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  const items: ApifyItem[] = await res.json();

  if (!items.length)
    throw new Error(`No data returned for @${handle} — check the handle and try again`);

  console.log(`[apify] ${items.length} items for @${handle}`);
  console.log(`[apify] first item keys:`, Object.keys(items[0] ?? {}).join(", "));
  console.log(`[apify] first item (truncated):`, JSON.stringify(items[0]).slice(0, 600));

  const userTweets = items.slice(0, 10);
  const first = items[0];
  const authorObj = first?.author ?? first?.user ?? first?.userData ?? {};

  const displayName =
    getStr(authorObj, "name", "displayName", "full_name") ||
    getStr(first, "authorName", "displayName", "name") ||
    handle;

  const avatarUrl =
    getStr(authorObj, "profilePicture", "profile_image_url", "profile_image_url_https", "avatar") ||
    getStr(first, "authorProfilePicture", "profilePicture", "avatarUrl") ||
    "";

  const followerCount =
    getNum(authorObj, "followers", "followers_count", "followersCount") ||
    getNum(first, "authorFollowers", "followers", "followersCount") ||
    0;

  const followingCount =
    getNum(authorObj, "following", "friends_count", "followingCount") ||
    getNum(first, "authorFollowing", "following", "followingCount") ||
    0;

  const tweets: Tweet[] = userTweets.map((item) => ({
    likeCount: getNum(item, "likeCount", "favorite_count", "likes", "favouriteCount"),
    replyCount: getNum(item, "replyCount", "reply_count", "replies"),
    bookmarkCount: getNum(item, "bookmarkCount", "bookmark_count", "bookmarks", "postBookmarks"),
    createdAt:
      getStr(item, "createdAt", "created_at", "timestamp") || new Date().toISOString(),
  }));

  const profile: UserProfile = {
    handle,
    displayName,
    avatarUrl,
    followerCount,
    followingCount,
    tweets,
  };

  const guardian: Guardian | null = null;
  return calculateScore(profile, guardian);
}
