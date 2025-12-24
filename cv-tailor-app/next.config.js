/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable serverless functions with longer timeout for PDF generation
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig

