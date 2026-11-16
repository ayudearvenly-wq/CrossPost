"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings as SettingsIcon, 
  ShieldCheck, 
  HardDrive, 
  Sliders, 
  Bell, 
  Key,
  Info,
  Sun,
  Moon,
  LogOut,
  Trash2,
  Share2,
  Check,
  User as UserIcon,
  Smartphone
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [defaultHashtags, setDefaultHashtags] = useState("#shorts #reels #crosspost");
  const [defaultFooter, setDefaultFooter] = useState("Follow for daily content! Published via CrossPost.");
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("crosspost_default_hashtags", defaultHashtags);
    localStorage.setItem("crosspost_default_footer", defaultFooter);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
          Settings & Preferences
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage your interface theme, default publishing presets, account sessions, and storage cleanup.
        </p>
      </div>

      <div className="space-y-6">
        {/* 1. Theme Selection */}
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-xs">
          <div className="flex items-center space-x-3 pb-3 border-b border-[var(--border)]">
            <Sun className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Theme Selection</h2>
              <p className="text-xs text-[var(--text-muted)]">Select your preferred SaaS interface style.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-xl border flex flex-col items-start space-y-2 transition cursor-pointer ${
                theme === "dark"
                  ? "bg-indigo-600/10 border-indigo-500 text-indigo-400 font-semibold shadow-xs"
                  : "bg-[var(--bg-card-subtle)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <Moon className="w-5 h-5" />
              <div className="text-left">
                <p className="text-xs font-semibold">Dark Theme</p>
                <p className="text-[11px] text-[var(--text-muted)]">Linear / Vercel style deep dark palette</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`p-4 rounded-xl border flex flex-col items-start space-y-2 transition cursor-pointer ${
                theme === "light"
                  ? "bg-indigo-600/10 border-indigo-500 text-indigo-600 font-semibold shadow-xs"
                  : "bg-[var(--bg-card-subtle)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <Sun className="w-5 h-5" />
              <div className="text-left">
                <p className="text-xs font-semibold">Light Theme</p>
                <p className="text-[11px] text-[var(--text-muted)]">Clean, high-contrast light mode</p>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Default Publishing Preferences */}
        <form onSubmit={handleSaveDefaults} className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-xs">
          <div className="flex items-center space-x-3 pb-3 border-b border-[var(--border)]">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Default Publishing Preferences</h2>
              <p className="text-xs text-[var(--text-muted)]">Preset tags and descriptions to speed up your upload workflow.</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1.5">
                Default Hashtags
              </label>
              <input
                type="text"
                value={defaultHashtags}
                onChange={(e) => setDefaultHashtags(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1.5">
                Default Caption Footer
              </label>
              <textarea
                rows={3}
                value={defaultFooter}
                onChange={(e) => setDefaultFooter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
              >
                Save Default Preferences
              </button>
              {savedNotice && (
                <span className="text-xs text-emerald-500 font-semibold flex items-center space-x-1">
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </span>
              )}
            </div>
          </div>
        </form>

        {/* 3. Account Settings & Authentication */}
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-xs">
          <div className="flex items-center space-x-3 pb-3 border-b border-[var(--border)]">
            <UserIcon className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Account & Authentication</h2>
              <p className="text-xs text-[var(--text-muted)]">Active user session and social connections.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] text-xs">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                {user ? user.email : "Guest Mode"}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {user ? `User ID: ${user.id}` : "Not logged in to cloud account"}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Link
                href="/accounts"
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-hover)] transition flex items-center space-x-1"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Manage Social Accounts</span>
              </Link>
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 font-semibold hover:bg-rose-500/20 transition flex items-center space-x-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Storage Cleanup Information */}
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-xs">
          <div className="flex items-center space-x-3 pb-3 border-b border-[var(--border)]">
            <HardDrive className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Storage Management & Cleanup</h2>
              <p className="text-xs text-[var(--text-muted)]">How temporary files and database records are handled.</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-[var(--text-muted)] leading-relaxed">
            <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] flex items-start space-x-3">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">Automated Post-Publishing Cleanup</p>
                <p className="mt-0.5 text-[11px]">
                  When a video publishes successfully to all three platforms, CrossPost immediately removes the temporary video file from your Supabase Storage bucket to conserve space.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] flex items-start space-x-3">
              <Trash2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">Failure Retention Policy</p>
                <p className="mt-0.5 text-[11px]">
                  If any platform fails (e.g. temporary API quota or network error), the temporary file is safely retained until you trigger a retry.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border)] flex items-start space-x-3">
              <Smartphone className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">Zero Device Impact</p>
                <p className="mt-0.5 text-[11px]">
                  The original video file on your Android phone or laptop is never modified or deleted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
