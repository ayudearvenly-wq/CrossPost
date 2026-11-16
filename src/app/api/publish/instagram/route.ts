import { NextRequest, NextResponse } from "next/server";
import { publishToInstagramReels } from "@/lib/meta/instagram";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300; // Allow 5 minutes execution for media container processing

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

    // Retrieve Instagram connection from Supabase
    const { data: igAccount, error: accErr } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "instagram")
      .single();

    if (accErr || !igAccount || !igAccount.encrypted_access_token) {
      return NextResponse.json(
        {
          error: "Instagram Creator account is not connected.",
          message: "Please connect your Meta account on the Connected Accounts page first.",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";
    const hashtags = (formData.get("hashtags") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "Missing video file in request." }, { status: 400 });
    }

    // 1. Upload video to Supabase Storage to get a public/signed URL
    // Meta Graph API requires an accessible HTTPS video URL to fetch video containers
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${user.id}/ig_${Date.now()}_${sanitizedName}`;

    const { error: storageErr } = await supabase.storage
      .from("videos")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageErr) {
      throw new Error(`Failed to upload media to Supabase Storage: ${storageErr.message}`);
    }

    // Create a 1-hour signed URL for Meta servers to download
    const { data: signedData, error: signErr } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 3600);

    if (signErr || !signedData?.signedUrl) {
      throw new Error("Failed to create signed URL for Instagram media processing.");
    }

    const videoUrl = signedData.signedUrl;

    // 2. Execute Instagram Reels publication pipeline
    const result = await publishToInstagramReels({
      igUserId: igAccount.account_identifier,
      accessToken: igAccount.encrypted_access_token,
      videoUrl,
      title,
      description,
      hashtags,
    });

    // 3. Save records in Supabase
    const { data: videoRecord } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title,
        description,
        hashtags,
        original_filename: file.name,
        storage_path: storagePath,
        file_size_bytes: file.size,
      })
      .select()
      .single();

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
          platform: "instagram",
          publishing_status: "published",
          platform_video_id: result.mediaId,
          published_url: result.permalink,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mediaId: result.mediaId,
      permalink: result.permalink,
      accountName: igAccount.account_name,
    });
  } catch (error: any) {
    console.error("Instagram publish error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to publish Reel to Instagram." },
      { status: 500 }
    );
  }
}
