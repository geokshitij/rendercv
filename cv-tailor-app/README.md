# CareerCraft

AI-powered application that tailors your resume and cover letter to match job advertisements using Google's Gemini API and RenderCV.

*"Success is where preparation and opportunity meet." — Bobby Unser*

**Developed by Kshitij Dahal**

## Features

- 🎯 **AI-Powered Tailoring**: Uses Gemini AI to customize your CV and cover letter based on job ads
- 📄 **PDF Generation**: Automatically generates professional PDFs using RenderCV
- 🚀 **Vercel Deployment**: Ready to deploy on Vercel
- 💼 **Professional Output**: Maintains professional formatting and structure

## Setup

### Prerequisites

- Node.js 18+ 
- Python 3.12+ (for RenderCV)
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey) (using `gemini-2.5-flash` model)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Ensure RenderCV is installed:**
   ```bash
   cd ..
   pip install -e ".[full]"
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### Option 1: Using Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add `GEMINI_API_KEY` with your API key

### Option 2: Using Vercel Dashboard

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variable `GEMINI_API_KEY`
4. Deploy

### Important Notes for Vercel Deployment

⚠️ **RenderCV Python Dependency**: Vercel serverless functions have limitations with Python subprocess calls. You may need to:

1. **Option A**: Use a separate API service for PDF generation (e.g., Railway, Render, or a dedicated Python service)
2. **Option B**: Modify the API route to call an external service
3. **Option C**: Use Vercel's Python runtime with proper configuration

For production, consider creating a separate microservice for PDF generation that Vercel can call.

## Usage

1. Paste a job advertisement into the text area
2. Click "Tailor CV & Cover Letter"
3. Wait for AI processing (may take 1-2 minutes)
4. Download your tailored CV and cover letter as PDFs

## Project Structure

```
cv-tailor-app/
├── app/
│   ├── api/
│   │   └── tailor/
│   │       └── route.ts          # API endpoint for tailoring
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main page component
├── api/
│   └── tailor.py                  # Python API handler (alternative)
├── package.json
├── tsconfig.json
├── vercel.json                    # Vercel configuration
└── README.md
```

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key (required)

## Troubleshooting

### PDF Generation Fails

If PDF generation fails on Vercel, it's likely due to Python/RenderCV dependencies. Consider:
- Using a separate API service for PDF generation
- Pre-generating templates and using client-side PDF libraries
- Using a Docker container on a platform that supports Python better

### API Timeout

The default Vercel timeout is 10 seconds. This project is configured for 300 seconds (5 minutes) in `vercel.json`. If you need longer, consider using Vercel Pro.

## License

MIT

