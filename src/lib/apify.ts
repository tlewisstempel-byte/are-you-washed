import { UserProfile, Tweet, Guardian } from "./scoring";

const BASE = "https://api.apify.com/v2";
const ACTOR = "apidojo~tweet-scraper";
const POLL_MS = 3000;
const MAX_MS = 120_000;

interface ApifyAuthor {
  userName?: string;
  name?: string;
  profilePicture?: string;
  followers?: number;
  following?: number;
}

interface ApifyTweet {
  likeCount?: number;
  favorite_count?: number;
  replyCount?: number;
  reply_count?: number;
  bookmarkCount?: number;
  bookmark_count?: number;
  postBookmarks?: number;
  createdAt?: string;
  author?: ApifyAuthor;
}

async function startRun(handle: string, token: string): Promise<string> {
  const res = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [
        // User's own timeline — gives us tweet metrics and profile data
        { url: `https://twitter.com/${handle}` },
        // Search for tweets replying to this user — gives us commenter authors
        { url: `https://twitter.com/search?q=to%3A${handle}&f=live` },
      ],
      maxTweets: 30,
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

export async function scrapeProfile(
  handle: string
): Promise<{ profile: UserProfile; guardian: Guardian | null }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");

  const runId = await startRun(handle, token);
  await waitForRun(runId, token);
  const items = await getItems(runId, token);

  if (!items.length) throw new Error(`No data returned for @${handle} — check the handle and try again`);

  const lowerHandle = handle.toLowerCase();

  // Split: user's own tweets vs. reply tweets from other people
  const userTweets = items.filter(
    (item) => item.author?.userName?.toLowerCase() === lowerHandle
  );
  const replyTweets = items.filter(
    (item) => item.author?.userName?.toLowerCase() !== lowerHandle
  );

  if (!userTweets.length) throw new Error(`Could not find tweets for @${handle}`);

  const profileAuthor = userTweets[0].author;

  const tweets: Tweet[] = userTweets.slice(0, 10).map((item) => ({
    likeCount: likes(item),
    replyCount: replyCount(item),
    bookmarkCount: books(item),
    createdAt: item.createdAt ?? new Date().toISOString(),
  }));

  const profile: UserProfile = {
    handle,
    displayName: profileAuthor?.name ?? handle,
    avatarUrl: profileAuthor?.profilePicture ?? "",
    followerCount: profileAuthor?.followers ?? 0,
    followingCount: profileAuthor?.following ?? 0,
    tweets,
  };

  // Guardian = highest-follower commenter (author of a reply to the user)
  const candidates = new Map<string, Guardian>();
  for (const item of replyTweets) {
    const a = item.author;
    if (!a?.userName) continue;
    const key = a.userName.toLowerCase();
    if (!candidates.has(key)) {
      candidates.set(key, {
        handle: a.userName,
        avatarUrl: a.profilePicture ?? "",
        followerCount: a.followers ?? 0,
      });
    }
  }

  const guardian =
    candidates.size > 0
      ? [...candidates.values()].sort((a, b) => b.followerCount - a.followerCount)[0]
      : null;

  return { profile, guardian };
}
