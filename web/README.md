# LISA Web (Phase 1: premium white UI)

The web app for LISA: a full-screen, white and silver studio with a soft violet accent and floating glass controls.

**Status: Phase 1 only.** The interface is built and tested. Nothing below is connected yet:

| Part | Status |
|---|---|
| White/silver full-screen UI, glass controls, settings drawer | Done (Phase 1) |
| Five states (idle, listening, processing, speaking, error) with visual feedback | Done (Phase 1) |
| Realistic 3D avatar | Not started (Phase 2). A plain orb is a placeholder. |
| Avatar animation: blinking, eye tracking, expressions | Not started (Phase 3) |
| Microphone, speech-to-text, text-to-speech, voice activity detection | Not started (Phase 4) |
| Claude chat with streaming (Node + Express, key on the server) | Not started (Phase 5) |
| Lip-sync from real audio | Not started (Phase 6) |

What is real today: the layout, the state visuals, the settings (saved on your device only) and the accessibility labels. What is **not** real yet: the waveform bars are decorative (they follow the state until real audio is connected in Phase 4), and the microphone and message box only tell you which phase will add them. A small "dev preview" strip, shown only in `npm run dev`, lets you look at each state. It does not appear in production builds.

## What you need

- **Node.js 20 or newer** (includes `npm`). Check with `node -v`. Install from https://nodejs.org (choose LTS).

## Install and run

Run these inside the `web` folder (`cd web`):

| Command | What it does |
|---|---|
| `npm install` | Downloads the libraries listed in `package.json` into a `node_modules` folder. Needed once, and again when `package.json` changes. |
| `npm run dev` | Starts the development server. Open the address it prints (usually http://localhost:5173). Stop with Ctrl+C. |
| `npm test` | Runs the automated tests once. |
| `npm run typecheck` | Checks the TypeScript code for mistakes without running it. |
| `npm run build` | Type-checks and creates the production files in `dist/`. |
| `npm run preview` | Serves the `dist/` build locally so you can try it. |

## Libraries used in Phase 1

- **React** and **TypeScript**: the interface
- **Vite**: development server and build tool
- **Tailwind CSS**: styling
- **Framer Motion**: the settings drawer and message animations
- **Vitest** with **Testing Library**: automated tests

Three.js, React Three Fiber, Drei, Express and the Anthropic SDK are added in the phase that needs them, not before.

## Settings

Model, language, speech speed and reduce-motion are saved in your browser's local storage. They are not sent anywhere. API keys are never stored in the browser: they will live on the server only (Phase 5).
