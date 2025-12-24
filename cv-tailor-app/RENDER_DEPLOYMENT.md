# Render Deployment Guide

## Quick Deploy Steps

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push origin main
   ```

2. **Deploy on Render:**
   - Go to [render.com](https://render.com) and sign up/login
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml` and create the service
   - OR manually create a "Web Service" and point to the repository

3. **Set Environment Variable:**
   - In Render dashboard, go to your service
   - Navigate to "Environment" tab
   - Add: `GEMINI_API_KEY` = your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

4. **Deploy:**
   - Render will automatically build and deploy
   - First build may take 5-10 minutes (installing dependencies)
   - Your app will be live at: `https://your-app-name.onrender.com`

## Configuration Files

- `render.yaml` - Render service configuration (in root directory)
- `cv-tailor-app/Dockerfile` - Docker build configuration
- `cv-tailor-app/.dockerignore` - Files to exclude from Docker build

## Troubleshooting

### Build fails with "rendercv: command not found"
- Check that RenderCV installed correctly in the Docker build logs
- The PATH should include `/usr/local/bin` where pip installs binaries

### Template files not found
- Ensure `Kshitij_Dahal_CV.yaml` and `Kshitij_Dahal_Cover_Letter.yaml` are in `cv-tailor-app/` directory
- They are copied during Docker build

### Timeout errors
- Render free tier has 30s timeout
- Upgrade to paid plan for longer timeouts (up to 2400s)
- Or optimize the PDF generation process

### PDF generation fails
- Check that Typst is installed (included in RenderCV full dependencies)
- Verify system dependencies (curl, fontconfig) are installed
- Check Render service logs for detailed error messages

## Cost

- **Free tier**: 750 hours/month, 30s request timeout
- **Starter ($7/month)**: Better performance, longer timeouts
- **Standard ($25/month)**: Production-ready, auto-scaling

## Notes

- First deployment may take 10-15 minutes
- Subsequent deployments are faster (cached layers)
- Free tier services spin down after 15 minutes of inactivity
- First request after spin-down may be slow (cold start)

