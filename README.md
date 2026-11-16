# CrossPost - Short Video Multi-Platform Distribution SaaS

CrossPost is a web application and installable Progressive Web App (PWA) designed to upload one short video and broadcast it simultaneously across three major social media platforms:

1. **YouTube Shorts** (via Google YouTube Data API v3 & OAuth 2.0)
2. **Instagram Reels** (via Meta Graph API v21.0 - Creator/Business Account)
3. **Facebook Reels** (via Meta Graph API v21.0 - Facebook Page)

---

## Architecture & Tech Stack

- **Frontend & App Framework:** Next.js 16 (App Router) + React 19 + TypeScript.
- **Styling & UI:** Tailwind CSS (Linear/Vercel inspired SaaS design, Dark/Light theme toggle).
- **Icons:** Lucide React + custom SVG brand icons for YouTube, Instagram, and Facebook.
- **PWA Experience:** Web App Manifest (`manifest.json`), service worker (`sw.js`), standalone installation for Android and desktop.
- **Database & Auth:** Supabase PostgreSQL with strict Row Level Security (RLS) & Supabase Auth.
- **Storage:** Supabase Storage (`videos` bucket) with user isolation and automated cleanup.
- **Social Media Engines:** Official Google APIs (`googleapis`), Meta Graph API v21.0, parallel execution engine, and idempotent retry handlers.

---

## Prerequisites

Before running or deploying CrossPost, ensure you have:
- [Node.js](https://nodejs.org/) version 18.17 or higher.
- A free [Supabase](https://supabase.com/) account.
- A [Google Cloud Console](https://console.cloud.google.com/) account.
- A [Meta for Developers](https://developers.facebook.com/) account.

---

## 1. Supabase Setup (Database & Storage)

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** on the left menu.
3. Open [`supabase/migrations/20261116_initial_schema.sql`](./supabase/migrations/20261116_initial_schema.sql), copy the entire SQL script, and click **Run**.
   - This creates `connected_accounts`, `videos`, `publishing_jobs`, `publishing_results`, and the `videos` storage bucket with Row Level Security (RLS) enabled.
4. Go to **Project Settings** -> **API**:
   - Copy **Project URL**.
   - Copy **anon public key**.
   - Copy **service_role secret key**.

---

## 2. Google Cloud Setup (YouTube Shorts API)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `crosspost-app`).
2. Navigate to **APIs & Services** -> **Library**, search for **YouTube Data API v3**, and click **Enable**.
3. Go to **APIs & Services** -> **OAuth consent screen**:
   - Select User Type: **External** -> Click **Create**.
   - Fill in App name: `CrossPost`, support email, and developer contact.
   - Click **Add or Remove Scopes** and add:
     - `.../auth/youtube.upload`
     - `.../auth/youtube.readonly`
     - `.../auth/userinfo.profile`
   - Under **Test Users**, add your personal Google account email (required while in Testing mode).
4. Go to **APIs & Services** -> **Credentials**:
   - Click **Create Credentials** -> **OAuth client ID**.
   - Application type: **Web application**.
   - Add Authorized redirect URI:
     - Local: `http://localhost:3000/api/auth/youtube/callback`
     - Production: `https://your-domain.vercel.app/api/auth/youtube/callback`
   - Copy your **Client ID** and **Client Secret**.

---

## 3. Meta for Developers Setup (Instagram & Facebook Reels)

1. Log in to [Meta for Developers](https://developers.facebook.com/) and click **My Apps** -> **Create App**.
2. Select Use case: **Other** -> App type: **Business**.
3. Under **Add products to your app**:
   - Add **Facebook Login for Business**.
   - Add **Instagram Graph API**.
4. In **Facebook Login for Business** -> **Settings**, add Valid OAuth Redirect URIs:
   - Local: `http://localhost:3000/api/auth/meta/callback`
   - Production: `https://your-domain.vercel.app/api/auth/meta/callback`
5. Ensure your accounts are linked:
   - Convert your Instagram to a **Creator or Business** account.
   - Link your Instagram account to your managed **Facebook Page** in **Meta Accounts Center**.
6. In **App settings** -> **Basic**, copy your **App ID** and **App Secret**.

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your actual API keys in `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google OAuth 2.0 (YouTube Data API v3)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# Meta Graph API v21.0 (Facebook & Instagram)
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=http://localhost:3000/api/auth/meta/callback
```

---

## 5. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run the Next.js development server
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## 6. How to Deploy to Vercel

1. Push your project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "feat: complete CrossPost multi-platform publisher"
   git remote add origin https://github.com/yourusername/crosspost.git
   git push -u origin main
   ```
2. Log in to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add all keys from `.env.local`:
   - Set `GOOGLE_REDIRECT_URI` to `https://your-app.vercel.app/api/auth/youtube/callback`.
   - Set `META_REDIRECT_URI` to `https://your-app.vercel.app/api/auth/meta/callback`.
5. Update the authorized redirect URIs in Google Cloud Console and Meta App Dashboard to match your Vercel production URL.
6. Click **Deploy**.

---

## 7. Production Testing Checklist

- [ ] **Auth:** Register a new user, log in, refresh session, log out.
- [ ] **YouTube OAuth:** Connect channel, verify channel title and green status indicator.
- [ ] **Meta OAuth:** Connect Facebook Page and Instagram Creator profile.
- [ ] **One-Click Publishing:** Upload vertical video (9:16), click **PUBLISH EVERYWHERE**, and verify progress updates.
- [ ] **Idempotent Retry:** If any platform experiences a temporary rate limit or network error, click **Retry Failed Platforms**. Verified that successful platforms are not duplicated.
- [ ] **Storage Cleanup:** Verify temporary file is automatically removed from Supabase Storage once all 3 platforms confirm publication.
- [ ] **PWA:** Open on Android Chrome and verify the "Install App" / "Add to Home screen" prompt.

---

## 8. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **YouTube 403 `quotaExceeded`** | Daily YouTube Data API v3 limit reached (10,000 free units/day; uploads take 1,600 units). | Request a quota increase in Google Cloud Console or wait 24h for quota reset. |
| **Google `access_denied` / 403** | Google OAuth is in "Testing" mode and current email is not registered as a test user. | Add your Google account in Google Cloud Console -> OAuth consent screen -> Test users. |
| **Instagram `no_business_account`** | Instagram account is Personal or not linked to a Facebook Page. | Switch to Creator account in Instagram app settings and link to your Facebook Page in Meta Accounts Center. |
| **Meta `token_expired` (190)** | OAuth token reached expiration. | Click **Reconnect** on the Connected Accounts page to obtain a fresh 60-day token. |
| **Storage 403 Forbidden** | Supabase Storage RLS blocking access. | Ensure [`supabase/migrations/20261116_initial_schema.sql`](./supabase/migrations/20261116_initial_schema.sql) was executed in Supabase SQL Editor. |

## 6. How to Deploy to Vercel

1. Push your project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "feat: complete CrossPost multi-platform publisher"
   git remote add origin https://github.com/yourusername/crosspost.git
   git push -u origin main
   ```
2. Log in to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add all keys from `.env.local`:
   - Set `GOOGLE_REDIRECT_URI` to `https://your-app.vercel.app/api/auth/youtube/callback`.
   - Set `META_REDIRECT_URI` to `https://your-app.vercel.app/api/auth/meta/callback`.
5. Update the authorized redirect URIs in Google Cloud Console and Meta App Dashboard to match your Vercel production URL.
6. Click **Deploy**.

---

## 7. Production Testing Checklist

- [ ] **Auth:** Register a new user, log in, refresh session, log out.
- [ ] **YouTube OAuth:** Connect channel, verify channel title and green status indicator.
- [ ] **Meta OAuth:** Connect Facebook Page and Instagram Creator profile.
- [ ] **One-Click Publishing:** Upload vertical video (9:16), click **PUBLISH EVERYWHERE**, and verify progress updates.
- [ ] **Idempotent Retry:** If any platform experiences a temporary rate limit or network error, click **Retry Failed Platforms**. Verified that successful platforms are not duplicated.
- [ ] **Storage Cleanup:** Verify temporary file is automatically removed from Supabase Storage once all 3 platforms confirm publication.
- [ ] **PWA:** Open on Android Chrome and verify the "Install App" / "Add to Home screen" prompt.

---

## 8. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **YouTube 403 `quotaExceeded`** | Daily YouTube Data API v3 limit reached (10,000 free units/day; uploads take 1,600 units). | Request a quota increase in Google Cloud Console or wait 24h for quota reset. |
| **Google `access_denied` / 403** | Google OAuth is in "Testing" mode and current email is not registered as a test user. | Add your Google account in Google Cloud Console -> OAuth consent screen -> Test users. |
| **Instagram `no_business_account`** | Instagram account is Personal or not linked to a Facebook Page. | Switch to Creator account in Instagram app settings and link to your Facebook Page in Meta Accounts Center. |
| **Meta `token_expired` (190)** | OAuth token reached expiration. | Click **Reconnect** on the Connected Accounts page to obtain a fresh 60-day token. |
| **Storage 403 Forbidden** | Supabase Storage RLS blocking access. | Ensure [`supabase/migrations/20261116_initial_schema.sql`](./supabase/migrations/20261116_initial_schema.sql) was executed in Supabase SQL Editor. |

