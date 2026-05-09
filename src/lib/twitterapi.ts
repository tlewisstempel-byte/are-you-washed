import { UserProfile, Tweet, Guardian } from "./scoring";
import { calculateScore } from "./scoring";
import type { ScoreResult } from "./scoring";

const BASE = "https://api.twitterapi.io";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = Record<string, any>;

function getNum(obj: ApiResponse, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && !isNaN(Number(v))) return Number(v);
  }
  return 0;
}

function getStr(obj: ApiResponse, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function upgradeAvatarUrl(url: string): string {
  if (!url) return url;
  return url.replace(/_normal(\.\w+)$/, "_400x400$1");
}

async function apiFetch(path: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "X-API-Key": token,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`twitterapi.io error: ${res.status} ${await res.text()}`);
  return res.json();
}

function extractTweetArray(res: ApiResponse): ApiResponse[] {
  if (Array.isArray(res)) return res;
  // { data: { tweets: [...] } } — last_tweets shape
  if (Array.isArray(res?.data?.tweets)) return res.data.tweets;
  // { data: [...] }
  if (Array.isArray(res?.data)) return res.data;
  // { tweets: [...] }
  if (Array.isArray(res?.tweets)) return res.tweets;
  // { results: [...] }
  if (Array.isArray(res?.results)) return res.results;
  return [];
}

export async function scrapeProfile(
  handle: string
): Promise<{ profile: UserProfile; guardian: Guardian | null }> {
  const token = process.env.TWITTER_API_TOKEN;
  if (!token) throw new Error("TWITTER_API_TOKEN is not configured");

  // ── 1. Fetch user profile and recent tweets in parallel ──────────────────
  const [userRes, tweetsRes] = await Promise.all([
    apiFetch(`/twitter/user/info?userName=${encodeURIComponent(handle)}`, token),
    apiFetch(`/twitter/user/last_tweets?userName=${encodeURIComponent(handle)}&count=15`, token),
  ]);

  console.log(`[twitterapi] user keys:`, Object.keys(userRes).join(", "));
  console.log(`[twitterapi] user sample:`, JSON.stringify(userRes).slice(0, 400));

  // ── 2. Extract profile fields ────────────────────────────────────────────
  const userData = userRes?.data ?? userRes?.user ?? userRes;

  const displayName =
    getStr(userData, "name", "displayName", "full_name") || handle;

  const avatarUrl = upgradeAvatarUrl(
    getStr(userData, "profilePicture", "profile_image_url", "profile_image_url_https",
      "avatarUrl", "avatar", "profile_pic_url")
  );

  const followerCount =
    getNum(userData, "followers", "followersCount", "followers_count",
      "follower_count", "public_metrics.followers_count") ||
    getNum(userRes, "followers", "followersCount");

  const followingCount =
    getNum(userData, "following", "followingCount", "friends_count",
      "following_count") ||
    getNum(userRes, "following", "followingCount");

  // ── 3. Extract tweets ────────────────────────────────────────────────────
  const rawTweets = extractTweetArray(tweetsRes);

  console.log(`[twitterapi] tweets count:`, rawTweets.length);
  if (rawTweets.length > 0) {
    console.log(`[twitterapi] tweet[0] keys:`, Object.keys(rawTweets[0]).join(", "));
    console.log(`[twitterapi] tweet[0] sample:`, JSON.stringify(rawTweets[0]).slice(0, 400));
  }

  const tweets: Tweet[] = rawTweets.slice(0, 10).map((item) => {
    // twitterapi.io returns counts directly on the tweet, not nested in public_metrics
    const metrics = item?.public_metrics ?? item;
    return {
      likeCount: getNum(metrics, "likeCount", "like_count", "favorite_count",
        "likes", "favouriteCount"),
      replyCount: getNum(metrics, "replyCount", "reply_count", "replies"),
      retweetCount: getNum(metrics, "retweetCount", "retweet_count", "retweets"),
      createdAt: getStr(item, "createdAt", "created_at", "timestamp") ||
        new Date().toISOString(),
    };
  });

  const profile: UserProfile = {
    handle,
    displayName,
    avatarUrl,
    followerCount,
    followingCount,
    tweets,
  };

  // ── 4. Guardian: fetch replies to first 5 tweets, find highest-follower author ──
  let guardian: Guardian | null = null;
  try {
    const tweetIds = rawTweets
      .slice(0, 5)
      .map((t) => t.id ?? t.tweetId ?? t.id_str)
      .filter(Boolean);

    const replyResults = await Promise.allSettled(
      tweetIds.map((id) =>
        apiFetch(`/twitter/tweet/replies?tweetId=${id}&count=20`, token)
      )
    );

    const allReplies: ApiResponse[] = [];
    for (const result of replyResults) {
      if (result.status === "fulfilled") {
        allReplies.push(...extractTweetArray(result.value));
      }
    }

    if (allReplies.length > 0) {
      console.log(`[twitterapi] reply[0] keys:`, Object.keys(allReplies[0]).join(", "));
      console.log(`[twitterapi] reply[0] sample:`, JSON.stringify(allReplies[0]).slice(0, 400));
    }

    const candidates = new Map<string, Guardian>();
    for (const item of allReplies) {
      const authorObj = item?.author ?? item?.user ?? item?.userData ?? {};
      const h =
        getStr(authorObj, "userName", "username", "screen_name") ||
        getStr(item, "authorHandle", "authorUserName", "userName");
      if (!h || h.toLowerCase() === handle.toLowerCase()) continue;
      if (item.isRetweet || item.retweeted) continue;
      if (!candidates.has(h.toLowerCase())) {
        candidates.set(h.toLowerCase(), {
          handle: h,
          avatarUrl: upgradeAvatarUrl(
            getStr(authorObj, "profilePicture", "profile_image_url", "avatarUrl", "avatar") ||
            getStr(item, "authorProfilePicture", "profilePicture")
          ),
          followerCount:
            getNum(authorObj, "followers", "followersCount", "followers_count") ||
            getNum(item, "authorFollowers", "followersCount"),
        });
      }
    }

    if (candidates.size > 0) {
      guardian = [...candidates.values()].sort(
        (a, b) => b.followerCount - a.followerCount
      )[0];
      console.log(`[twitterapi] guardian: @${guardian.handle} (${guardian.followerCount} followers)`);
    }
  } catch {
    // Guardian is optional — never block the score
    guardian = null;
  }

  return { profile, guardian };
}
