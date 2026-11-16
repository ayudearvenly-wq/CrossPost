import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { uploadVideoToYouTube } from "@/lib/youtube/client";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300; // Allow 5 minutes execution for video uploads

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to publish." },
        { status: 401 }
      );
    }

    // Retrieve user's connected YouTube channel credentials from Supabase
    const { data: ytAccount, error: accErr } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "youtube")
      .single();

    if (accErr || !ytAccount || !ytAccount.encrypted_access_token) {
      return NextResponse.json(
        {
          error: "YouTube account is not connected.",
          message: "Please connect your YouTube channel on the Connected Accounts page first.",
        },
        { status: 400 }
      );
    }

    // Parse form-data
    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const title = (formData.get("title") as string) || "Shorts Video";
    const description = (formData.get("description") as string) || "";
    const hashtags = (formData.get("hashtags") as string) || "";
    const privacyStatus = ((formData.get("privacyStatus") as string) || "private") as
      | "public"
      | "unlisted"
      | "private";

    if (!file) {
      return NextResponse.json({ error: "Missing video file in request." }, { status: 400 });
    }

    // Format description with hashtags
    const fullDescription = hashtags
      ? `${description}\n\n${hashtags}`.trim()
      : description.trim();

    // Extract tags from hashtags input
    const tagList = hashtags
      .split(/\s+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter((t) => t.length > 0);

    // Convert File into a Node.js Readable stream for googleapis resumable upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const videoStream = Readable.from(buffer);

    // 1. Upload to YouTube Data API v3
    const result = await uploadVideoToYouTube({
      accessToken: ytAccount.encrypted_access_token,
      refreshToken: ytAccount.encrypted_refresh_token,
      title,
      description: fullDescription,
      tags: tagList,
      privacyStatus,
      videoStream,
    });

    // 2. Save video record in Supabase
    const { data: videoRecord } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title,
        description,
        hashtags,
        original_filename: file.name,
        storage_path: `youtube_direct/${result.videoId}`,
        file_size_bytes: file.size,
      })
      .select()
      .single();

    // 3. Create job and publishing result record
    if (videoRecord) {
      const { data: job } = await supabase
        .from("publishing_jobs")
        .insert({
          user_id: user.id,
          video_id: videoRecord.id,
          overall_status: "completed",
        })
        .select()
        .single();

      if (job) {
        await supabase.from("publishing_results").insert({
          job_id: job.id,
          user_id: user.id,
          platform: "youtube",
          publishing_status: "published",
          platform_video_id: result.videoId,
          published_url: result.videoUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      videoId: result.videoId,
      videoUrl: result.videoUrl,
      title: result.title,
      privacyStatus: result.privacyStatus,
    });
  } catch (error: any) {
    console.error("YouTube publish API route error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to publish video to YouTube.",
      },
      { status: 500 }
    );
  }
}
