# ResearchMate Deployment Guide 🚀

This guide provides step-by-step instructions to deploy your ResearchMate full-stack application for free using **Render** (for the FastAPI backend) and **Vercel** (for the Next.js frontend).

---

## 📦 Part 1: Deploy the Backend (FastAPI on Render)

Render is a cloud platform that hosts Python APIs. We will configure it to run the FastAPI app and set up a persistent disk to ensure your uploaded research papers and ChromaDB vectors are never deleted.

### Step 1.1: Log in and Import Repository
1. Go to **[Render](https://render.com/)** and sign in using your GitHub account.
2. On the dashboard, click **New** > **Web Service**.
3. Under "Connect a repository," locate `Retrieval-Augmented-LLM-Assistant-for-Research-Paper-Analysis` and click **Connect**.

### Step 1.2: Configure Build & Start Settings
Configure the web service parameters exactly as follows:
*   **Name**: `researchmate-backend` (or a name of your choice)
*   **Language**: `Python`
*   **Branch**: `main`
*   **Root Directory**: `backend`
*   **Build Command**: `pip install -r requirements.txt`
*   **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
*   **Instance Type**: Select **Free** (or Starter if you want persistent disks).

### Step 1.3: Add Environment Variables
1. Scroll down and click **Advanced**.
2. Click **Add Environment Variable** and configure your secret key:
   *   **Key**: `NVIDIA_API_KEY`
   *   **Value**: `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`

### Step 1.4: (Optional but Recommended) Persistent Storage
> [!NOTE]
> Render's Free instance tier uses ephemeral storage (uploaded PDFs and vectors are cleared if the server sleeps or restarts).
> To persist documents permanently in production, upgrade to Render's **Starter** tier ($7/month) and attach a persistent disk volume:
> - **Volume Name**: `researchmate-data`
> - **Mount Path**: `/data`
> - **Size**: `1 GB` (or larger)
> - Change `DB_PATH` and `UPLOADS_PATH` in `backend/app/rag.py` to point to `/data` (if utilizing a persistent volume).

### Step 1.5: Deploy and Copy API URL
1. Click **Deploy Web Service** at the bottom of the page.
2. Wait 2-3 minutes for the build to complete. Once the log says `Application startup complete.`, look at the top left of the screen to find your public backend URL (e.g., `https://researchmate-backend.onrender.com`).
3. **Copy this URL.** You will need it for the frontend.

---

## 🌐 Part 2: Deploy the Frontend (Next.js on Vercel)

Vercel is the default cloud platform for Next.js web applications.

### Step 2.1: Log in and Import Repository
1. Go to **[Vercel](https://vercel.com/)** and log in with your GitHub account.
2. Click **Add New** > **Project** on your dashboard.
3. Import your repository: `Retrieval-Augmented-LLM-Assistant-for-Research-Paper-Analysis`.

### Step 2.2: Configure Environment Variables
Before deploying, we must tell Next.js where to send chatbot, compare, and mindmap queries:
1. In the Vercel project configuration menu, expand the **Environment Variables** section.
2. Configure the following variable:
   *   **Name / Key**: `NEXT_PUBLIC_API_URL`
   *   **Value**: *Paste the Render Backend URL you copied in Step 1.5* (e.g., `https://researchmate-backend.onrender.com`)
   *(Make sure there is no trailing slash `/` at the end of the URL).*

### Step 2.3: Deploy!
1. Click the **Deploy** button.
2. Vercel will build the frontend pages, optimize static elements, and deploy it to a public `.vercel.app` domain in less than a minute.
3. Once completed, click **Go to Dashboard** to access your public live web app link!

---

## 🔄 Updating Deployed Code
Whenever you want to push updates, bug fixes, or design improvements to your live application:
1. Commit and push changes to your GitHub main branch:
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```
2. Vercel and Render will automatically detect the push, rebuild, and update your live frontend and backend endpoints instantly!
