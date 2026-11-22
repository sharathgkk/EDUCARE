# EduCare - Inclusive Education

## Run Locally

**Prerequisites:** Node.js and npm

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the credentials you use locally.
3. Run `npm run dev`.

## Deploy

The frontend is deployed to Vercel and the persistent API, file-backed data, and WebSocket chat run as a Render web service. The Render service uses a persistent disk; its `starter` plan is required for that disk.

1. Push this repository to GitHub.
2. In Render, create a Blueprint from the repository. The `render.yaml` service creates the API and persistent disk. Enter `GEMINI_API_KEY`, `NEXCONN_APP_KEY`, and `NEXCONN_APP_SECRET` as secrets when prompted.
3. In Vercel, import the same repository. Keep the Vite framework, `npm run build` command, and `dist` output directory from `vercel.json`.
4. Add `VITE_API_BASE_URL` to Vercel with the Render service origin (for example, `https://educare-api.onrender.com`, with no trailing slash), then redeploy the frontend.
5. Set Render's `CORS_ORIGINS` to the exact Vercel production origin and any preview origins you use, comma-separated (for example, `https://educare.vercel.app`). Save and redeploy the API.
6. Add the Vercel domain to Firebase Authentication's authorized domains. For reliable cross-site session cookies, use custom frontend and API domains under the same registered domain.

Do not put backend secrets in Vercel `VITE_*` variables or commit them to GitHub. `VITE_API_BASE_URL` is public and contains only the API origin.
