import { UserProfile, Tweet, Guardian } from "./scoring";

const BASE = "https://api.apify.com/v2";
const ACTOR = "apidojo~tweet-scraper";
const POLL_MS = 3000;
const MAX_MS = 120_000;

interface ApifyAuthor {
  userName?: string;
  username?: string;
  screen_name?: string;
  name?: string;
  profilePicture?: string;
  profile_image_url?: string;
  followers?: number;
  followers_count?: number;
  following?: number;
  friends_count?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApifyItem = Record<string, any>;

interface ApifyTweet extends ApifyItem {
  id?: string;
  tweetId?: string;
  tweet_id?: string;
  likeCount?: number;
  favorite_count?: number;
  replyCount?: number;
  reply_count?: number;
  bookmarkCount?: number;
  bookmark_count?: number;
  postBookmarks?: number;
  createdAt?: string;
  created_at?: string;
  author?: ApifyAuthor;
  user?: ApifyAuthor;
  inReplyToId?: string;
  inReplyToTweetId?: string;
  in_reply_to_status_id_str?: string;
  isRetweet?: boolean;
  retweeted?: boolean;
}

async function startRun(handle: string, token: string): Promise<string> {
  const res = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      twitterHandles: [handle],
      searchTerms: [`to:${handle}`],
      maxItems: 30,
      sort: "Latest",
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

async function getItems(runId: string, token: string): Promise<ApifyTweet[]> {
  const res = await fetch(
    `${BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=50`
  );
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

function books(t: ApifyTweet) { return t.bookmarkCount ?? t.bookmark_count ?? t.postBookmarks ?? 0; }
function likes(t: ApifyTweet) { return t.likeCount ?? t.favorite_count ?? 0; }
function replyCount(t: ApifyTweet) { return t.replyCount ?? t.reply_count ?? 0; }

function authorHandle(t: ApifyTweet): string {
  const a = t.author ?? t.user;
  return (a?.userName ?? a?.username ?? a?.screen_name ?? "").toLowerCase();
}

function authorOf(t: ApifyTweet): ApifyAuthor | undefined {
  return t.author ?? t.user;
}

export async function scrapeProfile(
  handle: string
): Promise<{ profile: UserProfile; guardian: Guardian | null }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  const runId = await startRun(handle, token);
  await waitForRun(runId, token);
  const items = await getItems(runId, token);

  if (!items.length) throw new Error(`No data returned for @${handle} — check the handle and try again`);

  console.log(`[apify] ${items.length} items returned for @${handle}`);
  console.log(`[apify] first item keys: ${Object.keys(items[0] ?? {}).join(", ")}`);
  console.log(`[apify] first item author/user:`, JSON.stringify(items[0]?.author ?? items[0]?.user ?? null));

  const lowerHandle = handle.toLowerCase();

  const userTweets = items.filter((item) => authorHandle(item) === lowerHandle);
  const replyTweets = items.filter((item) => authorHandle(item) !== lowerHandle);

  if (!userTweets.length) {
    const sample = items.slice(0, 3).map((it) => ({
      keys: Object.keys(it),
      author: it.author ?? it.user ?? null,
      authorHandle: authorHandle(it),
    }));
    console.log(`[apify] NO USER TWEETS FOUND. sample:`, JSON.stringify(sample));
    throw new Error(
      `Could not find tweets for @${handle} — ${items.length} items returned but none matched. ` +
      `First item author: ${JSON.stringify(items[0]?.author ?? items[0]?.user ?? items[0]?.authorName ?? "none")}`
    );
  }

  const profileAuthor = authorOf(userTweets[0]);

  const tweets: Tweet[] = userTweets.slice(0, 10).map((item) => ({
    likeCount: likes(item),
    replyCount: replyCount(item),
    bookmarkCount: books(item),
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
  }));

  const profile: UserProfile = {
    handle,
    displayName: profileAuthor?.name ?? handle,
    avatarUrl: profileAuthor?.profilePicture ?? profileAuthor?.profile_image_url ?? "",
    followerCount: profileAuthor?.followers ?? profileAuthor?.followers_count ?? 0,
    followingCount: profileAuthor?.following ?? profileAuthor?.friends_count ?? 0,
    tweets,
  };

  const candidates = new Map<string, Guardian>();
  for (const item of replyTweets) {
    const a = authorOf(item);
    const h = authorHandle(item);
    if (!h || !a) continue;
    if (item.isRetweet || item.retweeted) continue;
    if (!candidates.has(h)) {
      candidates.set(h, {
        handle: a.userName ?? a.username ?? a.screen_name ?? h,
        avatarUrl: a.profilePicture ?? a.profile_image_url ?? "",
        followerCount: a.followers ?? a.followers_count ?? 0,
      });
    }
  }

  const guardian =
    candidates.size > 0
      ? [...candidates.values()].sort((a, b) => b.followerCount - a.followerCount)[0]
      : null;

  return { profile, guardian };
}
