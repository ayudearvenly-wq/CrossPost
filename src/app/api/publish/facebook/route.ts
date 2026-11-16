import { NextRequest, NextResponse } from "next/server";
import { publishToFacebookReels } from "@/lib/meta/facebook";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300; // Allow 5 minutes execution for media transfer & encoding

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

    // Retrieve Facebook Page connection from Supabase
    const { data: fbAccount, error: accErr } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "facebook")
      .single();

    if (accErr || !fbAccount || !fbAccount.encrypted_access_token) {
      return NextResponse.json(
        {
          error: "Facebook Page is not connected.",
          message: "Please connect your Meta / Facebook account on the Connected Accounts page first.",
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

    // 1. Upload to Supabase Storage to get accessible media URL for transfer
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${user.id}/fb_${Date.now()}_${sanitizedName}`;

    const { error: storageErr } = await supabase.storage
      .from("videos")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageErr) {
      throw new Error(`Failed to upload media to Supabase Storage: ${storageErr.message}`);
    }

    const { data: signedData, error: signErr } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 3600);

    if (signErr || !signedData?.signedUrl) {
      throw new Error("Failed to create signed URL for Facebook media processing.");
    }

    const videoUrl = signedData.signedUrl;

    // 2. Execute Facebook Reels publication pipeline
    const result = await publishToFacebookReels({
      pageId: fbAccount.account_identifier,
      pageAccessToken: fbAccount.encrypted_access_token,
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
          platform: "facebook",
          publishing_status: "published",
          platform_video_id: result.videoId,
          published_url: result.permalinkUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      videoId: result.videoId,
      permalinkUrl: result.permalinkUrl,
      pageName: fbAccount.account_name,
    });
  } catch (error: any) {
    console.error("Facebook publish error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to publish Reel to Facebook." },
      { status: 500 }
    );
  }
}
