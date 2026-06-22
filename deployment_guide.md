# Step-by-Step Deployment Guide 🚀

This document provides a highly detailed, step-by-step guide to deploying the **ResearchMate** full-stack RAG application for free using **Render** (for the FastAPI backend) and **Vercel** (for the Next.js frontend).

---

## 📋 Prerequisites

Before starting, ensure you have:
1. A **GitHub** account with your code pushed to repository: `https://github.com/DJShreyans/Retrieval-Augmented-LLM-Assistant-for-Research-Paper-Analysis`
2. A free **Render** account: [Sign up here](https://dashboard.render.com/register) (Log in with your GitHub account for easiest connection).
3. A free **Vercel** account: [Sign up here](https://vercel.com/signup) (Log in with your GitHub account).
4. Your active **NVIDIA API Key** ready.

---

## 📦 Step 1: Deploy the Backend API (Render)

Render will host the FastAPI server which processes your document uploads, runs ChromaDB queries, and integrates with the NVIDIA Cloud LLM.

### 1.1 Connect to GitHub
1. Log in to your **[Render Dashboard](https://dashboard.render.com/)**.
2. In the top-right corner, click the blue **New +** button, then select **Web Service** from the dropdown menu.
3. On the next screen, choose **Build and deploy from a Git repository**.
4. In the list of repositories, find `Retrieval-Augmented-LLM-Assistant-for-Research-Paper-Analysis` and click the **Connect** button next to it.

### 1.2 Input Configuration Details
Configure the settings exactly as specified below:
*   **Name**: `researchmate-backend`
*   **Region**: Select the region closest to you (e.g., `Singapore` or `Oregon`).
*   **Branch**: `main`
*   **Language**: `Python`
*   **Root Directory**: `backend`
*   **Build Command**: `pip install -r requirements.txt`
*   **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
*   **Instance Type**: Select **Free** (Scroll to the bottom of the list to find the free tier option).

### 1.3 Add Environment Variables
1. Scroll down to the bottom of the page and click the **Advanced** button.
2. Click **Add Environment Variable**.
3. Configure the following variable details:
   *   **Key**: `NVIDIA_API_KEY`
   *   **Value**: `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`
4. Make sure there are no spaces or extra characters in the key or value.

### 1.4 Start the Deployment
1. Click the blue **Create Web Service** button.
2. Render will spin up a container, download your Python environment, install all libraries from `requirements.txt`, and boot the server.
3. Wait about 3-4 minutes. In the live terminal log panel, look for this line to confirm success:
   ```text
   INFO:     Application startup complete.
   ```
4. Look at the top-left corner of the page under your project name to find your public URL (it will look like: `https://researchmate-backend.onrender.com`).
5. **Copy this URL** to your clipboard.

---

## 🌐 Step 2: Deploy the Frontend UI (Vercel)

Vercel will build your Next.js frontend pages and host them globally.

### 2.1 Import the Repository
1. Log in to your **[Vercel Dashboard](https://vercel.com/)**.
2. Click the **Add New...** dropdown button in the top-right corner, then select **Project**.
3. Under "Import Git Repository," click **Import** next to your `Retrieval-Augmented-LLM-Assistant-for-Research-Paper-Analysis` repository.

### 2.2 Configure Framework & Project Folders
1. Under **Framework Preset**, Vercel will automatically detect **Next.js**. Leave this as default.
2. Under **Root Directory**, click **Edit** and select the `frontend` folder (so Vercel knows to build the Next.js files in the frontend directory rather than the root). Click **OK**.

### 2.3 Configure the Backend API Environment Variable
This tells the Next.js UI where your Render backend server lives.
1. Scroll down and expand the **Environment Variables** section.
2. Enter the following key-value details:
   *   **Name**: `NEXT_PUBLIC_API_URL`
   *   **Value**: *Paste the public Render URL you copied in Step 1.5* (e.g., `https://researchmate-backend.onrender.com`).
   *   *(CRITICAL: Ensure there is no trailing slash `/` at the end of the URL, for example, do NOT input `https://.../`)*.
3. Click the **Add** button.

### 2.4 Launch Deployment
1. Click **Deploy**.
2. Vercel will run `npm run build` to compile the Next.js dashboard, chat page, comparison page, and mind mapper.
3. Within 60 seconds, you will see a congratulations screen indicating your project is live!
4. Click the preview screen to open your public ResearchMate MVP link (e.g., `https://researchmate-frontend.vercel.app`).

---

## 🔧 Part 3: Troubleshooting

### The Chatbot is loading forever or throws an error
*   **Cause**: The Render backend spins down to save resources on the Free tier if it doesn't receive any requests for 15 minutes. The first query after it falls asleep can take 30-50 seconds to "wake up" the server container.
*   **Solution**: Give it a few seconds, refresh your browser tab, and check the Service Health status indicator in your Sidebar (it should turn green once the backend wakes up).

### Uploaded Files vanish after a day
*   **Cause**: Render's free instances use an ephemeral filesystem. Every time Render redeploys your app or restarts the container, the uploads directory is reset.
*   **Solution**: To get permanent storage in production, you can attach a persistent volume (Render Starter tier, $7/month) to the `/data` path, or use local tunneling (via `ngrok`) to showcase your project locally during evaluations.
