import { UserProfile, Tweet, Guardian } from "./scoring";

const BASE = "https://api.apify.com/v2";
const ACTOR = "apidojo~tweet-scraper";
const POLL_MS = 3000;
const MAX_MS = 120_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApifyItem = Record<string, any>;

async function startRun(handle: string, token: string): Promise<string> {
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

async function waitForRun(runId: string, token: string): Promise<void> {
  const deadline = Date.now() + MAX_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`${BASE}/actor-runs/${runId}?token=${token}`);
    if (!res.ok) continue;
    const { data } = await res.json();
    if (data.status === "SUCCEEDED") return;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status))
      throw new Error(`Apify run ended: ${data.status}`);
  }
  throw new Error("Apify run timed out");
}

async function getItems(runId: string, token: string): Promise<ApifyItem[]> {
  const res = await fetch(
    `${BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=50`
  );
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

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

async function fetchReplies(handle: string, token: string): Promise<ApifyItem[]> {
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
  if (!res.ok) return [];
  const data = await res.json();
  const runId = data.data.id as string;

  const deadline = Date.now() + MAX_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const statusRes = await fetch(`${BASE}/actor-runs/${runId}?token=${token}`);
    if (!statusRes.ok) continue;
    const { data: runData } = await statusRes.json();
    if (runData.status === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runData.status)) return [];
  }

  const itemsRes = await fetch(
    `${BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=30`
  );
  if (!itemsRes.ok) return [];
  return itemsRes.json();
}

export async function scrapeProfile(
  handle: string
): Promise<{ profile: UserProfile; guardian: Guardian | null }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  const runId = await startRun(handle, token);
  await waitForRun(runId, token);
  const items = await getItems(runId, token);

  if (!items.length)
    throw new Error(`No data returned for @${handle} — check the handle and try again`);

  console.log(`[apify] ${items.length} items returned for @${handle}`);
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

  // Fetch replies for guardian — runs after profile is built, failure is non-fatal
  let guardian: Guardian | null = null;
  try {
    const replyItems = await fetchReplies(handle, token);

    if (replyItems.length > 0) {
      console.log(`[apify] reply item keys:`, Object.keys(replyItems[0]).join(", "));
      console.log(`[apify] reply item sample:`, JSON.stringify(replyItems[0]).slice(0, 400));
    }

    const candidates = new Map<string, Guardian>();
    for (const item of replyItems) {
      const replyAuthor = item?.author ?? item?.user ?? item?.userData ?? {};
      const h =
        getStr(replyAuthor, "userName", "username", "screen_name") ||
        getStr(item, "authorHandle", "authorUserName", "userName");
      if (!h || h.toLowerCase() === handle.toLowerCase()) continue;
      if (item.isRetweet || item.retweeted) continue;
      if (!candidates.has(h.toLowerCase())) {
        candidates.set(h.toLowerCase(), {
          handle: h,
          avatarUrl:
            getStr(replyAuthor, "profilePicture", "profile_image_url", "avatar") ||
            getStr(item, "authorProfilePicture", "profilePicture"),
          followerCount:
            getNum(replyAuthor, "followers", "followers_count", "followersCount") ||
            getNum(item, "authorFollowers", "followersCount"),
        });
      }
    }

    if (candidates.size > 0) {
      guardian = [...candidates.values()].sort((a, b) => b.followerCount - a.followerCount)[0];
    }
  } catch {
    guardian = null;
  }

  return { profile, guardian };
}
