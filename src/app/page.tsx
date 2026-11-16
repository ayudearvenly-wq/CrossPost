"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  UploadCloud, 
  Share2, 
  Video, 
  ArrowUpRight, 
  Sparkles, 
  Clock, 
  Layers, 
  Database,
  ShieldCheck,
  Inbox
} from "lucide-react";
import { YouTubeIcon, InstagramIcon, FacebookIcon } from "@/components/SocialIcons";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user, isConfigured } = useAuth();
  const [totalVideos, setTotalVideos] = useState<number>(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<{ [key: string]: boolean }>({
    youtube: false,
    instagram: false,
    facebook: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!isConfigured || !user) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // 1. Fetch total videos count
        const { count: videoCount, error: countErr } = await supabase
          .from("videos")
          .select("*", { count: "exact", head: true });

        if (!countErr && videoCount !== null) {
          setTotalVideos(videoCount);
        }

        // 2. Fetch connected accounts
        const { data: accounts } = await supabase
          .from("connected_accounts")
          .select("platform, connection_status");

        if (accounts) {
          const map: { [key: string]: boolean } = {
            youtube: false,
            instagram: false,
            facebook: false,
          };
          accounts.forEach((acc) => {
            if (acc.connection_status === "connected") {
              map[acc.platform] = true;
            }
          });
          setConnectedPlatforms(map);
        }

        // 3. Fetch recent publishing jobs
        const { data: jobs } = await supabase
          .from("publishing_jobs")
          .select(`
            id,
            overall_status,
            created_at,
            videos (title),
            publishing_results (platform, publishing_status, published_url)
          `)
          .order("created_at", { ascending: false })
          .limit(5);

        if (jobs) {
          setRecentJobs(jobs);
        }
      } catch (err) {
        console.error("Failed to load dashboard data from Supabase:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user, isConfigured]);

  const stats = [
    {
      title: "Total Videos Published",
      value: loading ? "..." : totalVideos.toString(),
      subtitle: isConfigured ? "Live database count" : "Sample state",
      icon: Video,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      title: "YouTube Status",
      value: connectedPlatforms.youtube ? "Connected" : "Disconnected",
      subtitle: "Shorts API status",
      icon: YouTubeIcon,
      color: "text-red-500",
      bg: "bg-red-500/10 border-red-500/20",
    },
    {
      title: "Instagram Status",
      value: connectedPlatforms.instagram ? "Connected" : "Disconnected",
      subtitle: "Graph API status",
      icon: InstagramIcon,
      color: "text-pink-500",
      bg: "bg-pink-500/10 border-pink-500/20",
    },
    {
      title: "Facebook Status",
      value: connectedPlatforms.facebook ? "Connected" : "Disconnected",
      subtitle: "Page Reels status",
      icon: FacebookIcon,
      color: "text-blue-500",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top SaaS Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-slate-900/10 dark:from-indigo-950/50 dark:via-purple-950/30 dark:to-slate-950/40 border border-[var(--border)] p-6 sm:p-8 backdrop-blur-sm">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-semibold mb-4">
            <Database className="w-3.5 h-3.5" />
            <span>Supabase PostgreSQL & Storage Connected</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
            One Short Video, Three Giant Platforms
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            Upload your short-form video once. CrossPost stores your assets securely in Supabase Storage and records multi-platform pipelines in PostgreSQL with strict Row Level Security.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Video</span>
            </Link>
            <Link
              href="/accounts"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] font-medium transition"
            >
              <Share2 className="w-4 h-4" />
              <span>Connected Accounts</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className={`p-5 rounded-2xl border ${stat.bg} bg-[var(--bg-card)] backdrop-blur-sm transition hover:border-[var(--border-subtle)] shadow-xs`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">{stat.title}</span>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{stat.value}</div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{stat.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Publishing Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Recent Publishing Activity</h2>
            <p className="text-xs text-[var(--text-muted)]">Live database activity stream from Supabase</p>
          </div>
          <Link
            href="/history"
            className="text-xs font-medium text-indigo-500 hover:underline inline-flex items-center space-x-1"
          >
            <span>View Full History</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentJobs.length > 0 ? (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden shadow-xs">
            {recentJobs.map((job) => (
              <div key={job.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-hover)] transition">
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">
                    {job.videos?.title || "Untitled Video"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span>{new Date(job.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span className="capitalize font-medium text-indigo-500">Status: {job.overall_status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {job.publishing_results?.map((res: any) => (
                    <span
                      key={res.platform}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)]"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${res.publishing_status === 'published' ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                      <span className="capitalize">{res.platform}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] text-center flex flex-col items-center justify-center">
            <Inbox className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">No Publishing Activity Yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
              Your video uploads and publishing results will appear directly here as they are created.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
