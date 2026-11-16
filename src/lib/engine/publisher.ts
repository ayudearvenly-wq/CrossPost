import { uploadVideoToYouTube } from "@/lib/youtube/client";
import { publishToInstagramReels } from "@/lib/meta/instagram";
import { publishToFacebookReels } from "@/lib/meta/facebook";
import { Readable } from "stream";

export interface PlatformPublishTaskParams {
  jobId: string;
  userId: string;
  platform: "youtube" | "instagram" | "facebook";
  title: string;
  description: string;
  hashtags: string;
  privacyStatus?: "public" | "unlisted" | "private";
  videoUrl: string; // Accessible storage URL
  connectedAccount: any;
}

export interface PlatformPublishTaskResult {
  platform: "youtube" | "instagram" | "facebook";
  status: "published" | "failed";
  platformVideoId?: string;
  publishedUrl?: string;
  errorMessage?: string;
}

/**
 * Executes the publishing workflow for a specific platform.
 * Fully verifies real completion, retrieves live ID & URL, and catches errors safely.
 */
export async function executePlatformPublish(
  params: PlatformPublishTaskParams
): Promise<PlatformPublishTaskResult> {
  const { platform, connectedAccount, title, description, hashtags, videoUrl, privacyStatus } = params;

  try {
    if (platform === "youtube") {
      // 1. YouTube Shorts requires video buffer stream
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) {
        throw new Error("Failed to fetch video stream from storage for YouTube.");
      }
      const arrayBuffer = await videoRes.arrayBuffer();
      const videoStream = Readable.from(Buffer.from(arrayBuffer));

      const ytDescription = hashtags ? `${description}\n\n${hashtags}`.trim() : description.trim();
      const tagList = hashtags
        .split(/\s+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter((t) => t.length > 0);

      const ytResult = await uploadVideoToYouTube({
        accessToken: connectedAccount.encrypted_access_token,
        refreshToken: connectedAccount.encrypted_refresh_token,
        title,
        description: ytDescription,
        tags: tagList,
        privacyStatus: privacyStatus || "private",
        videoStream,
      });

      return {
        platform: "youtube",
        status: "published",
        platformVideoId: ytResult.videoId,
        publishedUrl: ytResult.videoUrl,
      };
    } else if (platform === "instagram") {
      // 2. Instagram Reels: Meta container -> poll until FINISHED -> publish -> permalink
      const igResult = await publishToInstagramReels({
        igUserId: connectedAccount.account_identifier,
        accessToken: connectedAccount.encrypted_access_token,
        videoUrl,
        title,
        description,
        hashtags,
      });

      return {
        platform: "instagram",
        status: "published",
        platformVideoId: igResult.mediaId,
        publishedUrl: igResult.permalink,
      };
    } else if (platform === "facebook") {
      // 3. Facebook Reels: Init session -> rupload bytes -> publish -> poll status
      const fbResult = await publishToFacebookReels({
        pageId: connectedAccount.account_identifier,
        pageAccessToken: connectedAccount.encrypted_access_token,
        videoUrl,
        title,
        description,
        hashtags,
      });

      return {
        platform: "facebook",
        status: "published",
        platformVideoId: fbResult.videoId,
        publishedUrl: fbResult.permalinkUrl,
      };
    }

    throw new Error(`Unsupported platform: ${platform}`);
  } catch (err: any) {
    console.error(`Error publishing to ${platform}:`, err);
    return {
      platform,
      status: "failed",
      errorMessage: err?.message || `Failed to publish to ${platform}.`,
    };
  }
}
