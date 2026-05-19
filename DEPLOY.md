# Deploy

## Backend on Render

1. Create a new Render Web Service from this repo.
2. Set the service root directory to `backend` if you are not using `render.yaml`.
3. Use:
   - Build command: `./build.sh`
   - Start command: `./start.sh`
4. Add a persistent disk mounted at `/var/data`.
5. Set environment variables:
   - `DATABASE_URL=file:/var/data/dev.db`
   - `GEMINI_API_KEY=...`
   - `PINECONE_API_KEY=...`
   - `PINECONE_INDEX_NAME=cat-prep-index`
   - `BACKEND_CORS_ORIGINS=https://your-vercel-project.vercel.app`

The backend health check is `/healthz`.

## Admin frontend on Vercel

1. Import the `admin-frontend` directory as a separate Vercel project.
2. Set:
   - Framework preset: `Other`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add environment variable:
   - `ADMIN_BACKEND_URL=https://your-render-service.onrender.com`
4. Redeploy.

The build writes `dist/config.js` with the backend URL injected from `ADMIN_BACKEND_URL`.
