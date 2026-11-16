"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  History, 
  UploadCloud, 
  Clock, 
  ExternalLink, 
  Calendar, 
  Sparkles, 
  Inbox, 
  Film, 
  RotateCcw, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Tag, 
  FileText 
} from "lucide-react";
import { YouTubeIcon, InstagramIcon, FacebookIcon } from "@/components/SocialIcons";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export default function HistoryPage() {
  const { user, isConfigured } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  async function loadPublishingHistory() {
    if (!isConfigured || !user) {
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("publishing_jobs")
        .select(`
          id,
          overall_status,
          created_at,
          videos (
            id,
            title,
            description,
            hashtags,
            storage_path,
            original_filename,
            file_size_bytes
          ),
          publishing_results (
            id,
            platform,
            publishing_status,
            platform_video_id,
            published_url,
            error_message,
            retry_count
          )
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to load history from Supabase:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPublishingHistory();
  }, [user, isConfigured]);

  const handleRetryJob = async (jobId: string) => {
    try {
      setRetryingJobId(jobId);
      const res = await fetch("/api/publish/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Retry failed.");
      } else {
        await loadPublishingHistory();
      }
    } catch (err: any) {
      alert(err?.message || "Failed to execute retry.");
    } finally {
      setRetryingJobId(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "youtube":
        return YouTubeIcon;
      case "instagram":
        return InstagramIcon;
      case "facebook":
        return FacebookIcon;
      default:
        return Sparkles;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Publishing History
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Review past multi-platform broadcasts, live video links, descriptions, and statuses.
          </p>
        </div>

        <Link
          href="/upload"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload New Video</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)]">
          Loading publishing history...
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] text-center flex flex-col items-center justify-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">No Publishing Records Yet</h2>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
            Upload your short video to start broadcasting and tracking across YouTube Shorts, Instagram Reels, and Facebook Reels.
          </p>
          <div className="mt-6">
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Go to Upload Video</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const hasFailed = job.publishing_results?.some(
              (r: any) => r.publishing_status === "failed" || r.publishing_status === "pending"
            );
            const isRetryingThis = retryingJobId === job.id;
            const isExpanded = expandedJobId === job.id;

            return (
              <div
                key={job.id}
                className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-subtle)] transition shadow-xs space-y-4"
              >
                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                  {/* Thumbnail & Title */}
                  <div className="flex items-start sm:items-center space-x-4">
                    <div className="w-14 h-24 sm:w-16 sm:h-28 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-700 shrink-0 flex items-center justify-center text-white shadow-md border border-[var(--border)] overflow-hidden relative">
                      <Film className="w-6 h-6 text-white/80" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-muted)] font-mono">
                          Job #{job.id.slice(0, 8)}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                            job.overall_status === "completed"
                              ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                              : job.overall_status === "partial"
                              ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                              : "text-rose-500 bg-rose-500/10 border-rose-500/20"
                          }`}
                        >
                          {job.overall_status}
                        </span>
                      </div>

                      <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-snug">
                        {job.videos?.title || "Untitled Video"}
                      </h2>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(job.created_at).toLocaleString()}</span>
                        </div>
                        {job.videos?.original_filename && (
                          <span>File: {job.videos.original_filename}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Platform Statuses & Retry Trigger */}
                  <div className="w-full md:w-auto flex flex-col sm:flex-row sm:items-center gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--border)]">
                    <div className="flex flex-wrap gap-2">
                      {job.publishing_results?.map((res: any) => {
                        const Icon = getPlatformIcon(res.platform);
                        const isSuccess = res.publishing_status === "published";
                        return (
                          <div
                            key={res.platform}
                            className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-xs"
                          >
                            <div className="flex items-center space-x-1.5">
                              <Icon className="w-3.5 h-3.5" />
                              <span className="font-medium text-[var(--text-secondary)] capitalize">{res.platform}</span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  isSuccess
                                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                                    : res.publishing_status === "uploading"
                                    ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                                    : "text-rose-500 bg-rose-500/10 border-rose-500/20"
                                }`}
                              >
                                {res.publishing_status}
                              </span>
                              {res.published_url ? (
                                <a
                                  href={res.published_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-500 hover:text-indigo-600 transition"
                                  title={`Open live ${res.platform} video`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : res.publishing_status === "uploading" ? (
                                <Clock className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center space-x-2">
                      {hasFailed && (
                        <button
                          type="button"
                          onClick={() => handleRetryJob(job.id)}
                          disabled={isRetryingThis}
                          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/25 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          {isRetryingThis ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>Retry</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition"
                        title={isExpanded ? "Hide details" : "View description and metadata"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Metadata (Description & Hashtags) */}
                {isExpanded && (
                  <div className="pt-3 border-t border-[var(--border)] space-y-2 text-xs bg-[var(--bg-card-subtle)] p-3.5 rounded-xl">
                    {job.videos?.description && (
                      <div>
                        <span className="font-semibold text-[var(--text-secondary)] block mb-1">Description:</span>
                        <p className="text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed">{job.videos.description}</p>
                      </div>
                    )}
                    {job.videos?.hashtags && (
                      <div className="pt-1 flex items-center space-x-2">
                        <Tag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <code className="text-[11px] text-indigo-400 font-mono">{job.videos.hashtags}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
