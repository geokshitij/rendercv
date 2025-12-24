# Deployment Guide

## Quick Start for Vercel

### Prerequisites
1. Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Vercel account (free tier works)
3. GitHub account (for easy deployment)

### Steps

1. **Prepare your CV templates:**
   - Copy `Kshitij_Dahal_CV.yaml` and `Kshitij_Dahal_Cover_Letter.yaml` to the `cv-tailor-app` directory
   - Or update the paths in `app/api/tailor/route.ts` to point to your template locations

2. **Push to GitHub:**
   ```bash
   cd cv-tailor-app
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

3. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variable: `GEMINI_API_KEY` = your API key
   - Click "Deploy"

### Important Notes

⚠️ **Python/RenderCV Limitation**: Vercel serverless functions may have issues running Python subprocess commands. 

**Solutions:**

1. **Option A - Use External PDF Service:**
   - Deploy RenderCV as a separate service (Railway, Render, Fly.io)
   - Modify the API route to call that service instead

2. **Option B - Pre-process Templates:**
   - Generate base PDFs and use client-side PDF manipulation
   - Less ideal but more reliable on Vercel

3. **Option C - Use Vercel's Python Runtime:**
   - Create a Python serverless function in `api/tailor.py`
   - Configure `vercel.json` to use Python runtime
   - May require additional configuration

### Recommended Architecture for Production

```
┌─────────────┐
│   Vercel    │  Next.js Frontend + API (Gemini AI)
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│   Railway/  │  Python Service (RenderCV PDF Generation)
│   Render    │
└─────────────┘
```

This separates concerns:
- Vercel handles the web UI and AI tailoring
- Separate service handles PDF generation

### Environment Variables

Required:
- `GEMINI_API_KEY`: Your Google Gemini API key

Optional (for external PDF service):
- `PDF_SERVICE_URL`: URL of your PDF generation service

## Local Testing

Before deploying, test locally:

```bash
npm install
npm run dev
```

Make sure:
1. RenderCV is installed: `pip install -e ".[full]"` (from parent directory)
2. Template files are accessible
3. Gemini API key is set in `.env.local`

## Troubleshooting

### "rendercv: command not found"
- Install RenderCV: `pip install -e ".[full]"`
- Or use Python module: `python -m rendercv.cli.entry_point`

### "Template files not found"
- Copy template YAML files to the app directory
- Or update paths in the API route

### Timeout errors on Vercel
- Increase timeout in `vercel.json` (already set to 300s)
- Consider using Vercel Pro for longer timeouts
- Or move PDF generation to external service

