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

// Upgrade Twitter avatar from _normal (48px) to _400x400
function upgradeAvatarUrl(url: string): string {
  if (!url) return url;
  return url.replace(/_normal(\.\w+)$/, "_400x400$1");
}

/**
 * Start the main profile run (fetches the user's own tweets).
 * Returns the runId immediately (< 1s).
 */
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

/**
 * Start the guardian run (searches for replies TO the handle).
 * Returns the runId immediately (< 1s). Fails silently — returns null if the start fails.
 */
export async function startGuardianRun(handle: string): Promise<string | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchTerms: [`to:${handle}`],
        maxItems: 20,
        maxRequestRetries: 2,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ["DATACENTER"],
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data.id as string;
  } catch {
    return null;
  }
}

/**
 * Check the status of any Apify run.
 * Returns the raw status string e.g. "RUNNING", "SUCCEEDED", "FAILED".
 */
export async function getRunStatus(runId: string): Promise<string> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  const res = await fetch(`${BASE}/actor-runs/${runId}?token=${token}`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  const { data } = await res.json();
  return data.status as string;
}

/**
 * Fetch items from a completed profile run and compute the ScoreResult.
 * If a guardianRunId is provided and has SUCCEEDED, extracts the guardian too.
 * If the guardian run hasn't finished or failed, returns guardian: null — score is unaffected.
 */
export async function buildScoreFromRun(
  handle: string,
  profileRunId: string,
  guardianRunId: string | null
): Promise<ScoreResult> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  // ── Profile items ──────────────────────────────────────────────────────────────────────
  const res = await fetch(
    `${BASE}/actor-runs/${profileRunId}/dataset/items?token=${token}&limit=50`
  );
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  const items: ApifyItem[] = await res.json();

  if (!items.length)
    throw new Error(`No data returned for @${handle} — check the handle and try again`);

  console.log(`[apify] profile: ${items.length} items for @${handle}`);
  console.log(`[apify] first item keys:`, Object.keys(items[0] ?? {}).join(", "));
  console.log(`[apify] first item (truncated):`, JSON.stringify(items[0]).slice(0, 600));

  const userTweets = items.slice(0, 10);
  const first = items[0];
  const authorObj = first?.author ?? first?.user ?? first?.userData ?? {};

  const displayName =
    getStr(authorObj, "name", "displayName", "full_name") ||
    getStr(first, "authorName", "displayName", "name") ||
    handle;

  const avatarUrl = upgradeAvatarUrl(
    getStr(authorObj, "profilePicture", "profile_image_url", "profile_image_url_https", "avatar") ||
    getStr(first, "authorProfilePicture", "profilePicture", "avatarUrl") ||
    ""
  );

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

  // ── Guardian ─────────────────────────────────────────────────────────────────────────────
  let guardian: Guardian | null = null;

  if (guardianRunId) {
    try {
      const guardianRes = await fetch(
        `${BASE}/actor-runs/${guardianRunId}/dataset/items?token=${token}&limit=30`
      );
      if (guardianRes.ok) {
        const replyItems: ApifyItem[] = await guardianRes.json();

        if (replyItems.length > 0) {
          console.log(`[apify] guardian: ${replyItems.length} reply items`);
          console.log(`[apify] reply item keys:`, Object.keys(replyItems[0]).join(", "));
          console.log(`[apify] reply item sample:`, JSON.stringify(replyItems[0]).slice(0, 400));
        }

        const candidates = new Map<string, Guardian>();
        for (const item of replyItems) {
          const authorObj2 = item?.author ?? item?.user ?? item?.userData ?? {};
          const h =
            getStr(authorObj2, "userName", "username", "screen_name") ||
            getStr(item, "authorHandle", "authorUserName", "userName");
          if (!h || h.toLowerCase() === handle.toLowerCase()) continue;
          if (item.isRetweet || item.retweeted) continue;
          if (!candidates.has(h.toLowerCase())) {
            candidates.set(h.toLowerCase(), {
              handle: h,
              avatarUrl: upgradeAvatarUrl(
                getStr(authorObj2, "profilePicture", "profile_image_url", "avatar") ||
                getStr(item, "authorProfilePicture", "profilePicture")
              ),
              followerCount:
                getNum(authorObj2, "followers", "followers_count", "followersCount") ||
                getNum(item, "authorFollowers", "followersCount"),
            });
          }
        }

        if (candidates.size > 0) {
          guardian = [...candidates.values()].sort(
            (a, b) => b.followerCount - a.followerCount
          )[0];
          console.log(`[apify] guardian found: @${guardian.handle} (${guardian.followerCount} followers)`);
        }
      }
    } catch {
      guardian = null;
    }
  }

  return calculateScore(profile, guardian);
}
