<div align="center">

# ✨ Lumi — Personal LifeOS

**Plan today. Build brighter tomorrows.**

A cosmic-inspired personal productivity app for organizing tasks, building habits, focusing on study sessions, and visualizing progress.

<!-- Save the matching banner image as `assets/lumi-banner.png` and uncomment the line below. -->
<!-- ![Lumi banner](assets/lumi-banner.png) -->

[Overview](#-overview) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Android](#-android)

</div>

---

## 🌌 Overview

Lumi is a personal productivity app with a minimalist cosmic-dark visual identity, glowing orange/violet/blue accents, and a friendly companion-inspired interface. It brings everyday planning and study routines into one place.

This repository is a work in progress. Feature availability may vary as development continues.

## ✨ Features

- **Task management** — keep one-off tasks and priorities separate from recurring routines.
- **Habit tracking** — organize recurring habits and track consistency.
- **Focus sessions** — use a timer to structure focused work or study time.
- **Progress dashboard** — view your productivity and study progress.
- **Calendar and study insights** — organize activity and review progress over time.
- **Local persistence** — IndexedDB is used for locally stored app data.
- **Supabase integration** — authentication/profile functionality and database integration are part of the project.
- **Progressive Web App** — built with PWA support.
- **Android app foundation** — Capacitor is used for the Android platform.

> **Status note:** This README intentionally avoids promising that every record is cloud-synced or that every native Android capability is fully implemented. Check the current code and migration files for the exact status.

## 🧰 Tech Stack

| Technology | Role |
|---|---|
| React | UI |
| TypeScript | Type-safe application code |
| Vite | Development server and build tooling |
| PWA | Installable web-app foundation |
| Capacitor | Android platform integration |
| Supabase | Authentication and backend/database integration |
| IndexedDB | Local client-side persistence |

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Git
- A Supabase project for the Supabase-backed parts of the app

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/lumi-productivity-app.git
cd lumi-productivity-app
```

Replace `YOUR-USERNAME` with your GitHub username and adjust the repository name if you chose a different one.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the values from your own Supabase project. Do not commit `.env.local`, service-role keys, access tokens, passwords, or other secrets.

### 4. Start the development server

```bash
npm run dev
```

Vite will print the local URL in the terminal. Open that URL in your browser.

### 5. Check available scripts

Use the scripts defined in `package.json` for the exact commands available in your checkout. Common Vite scripts may include:

```bash
npm run build
npm run preview
```

Run only the scripts that exist in your project's `package.json`.

## 📱 Android

Lumi uses Capacitor for Android integration. Android build steps depend on the project's current Capacitor configuration and Android Studio/JDK setup.

If the Android platform is configured, you can typically sync web assets with:

```bash
npx cap sync android
```

Then open the Android project in Android Studio or use the Gradle wrapper from the `android` directory. Verify the current configuration before building or distributing an APK.

## 🖼️ Screenshots

Add screenshots of the **actual running app** here as development progresses. For example:

```md
![Lumi dashboard](screenshots/dashboard.png)
![Lumi focus session](screenshots/focus-session.png)
```

Only include screenshots that match the current implementation.

## 🗺️ Roadmap

Potential areas to document as they become implemented and verified:

- [ ] Complete end-to-end cloud persistence and sync for all supported records
- [ ] Verify native Android reminder and notification flows
- [ ] Add screenshots and a short demo
- [ ] Document tested setup and build instructions

These are tracking items, not claims that the functionality is already available.

## 🔐 Security

- Keep `.env.local` and all credentials out of Git.
- Never expose Supabase service-role keys in client-side code.
- Review database Row Level Security policies before using real personal data.
- Do not publish personal records, local databases, or private configuration files.

## 📄 License

No license has been specified yet. Add a `LICENSE` file before presenting the project as open source. Without a license, normal copyright restrictions apply.

---

<div align="center">

**Lumi** · Make room for what matters.

</div>
