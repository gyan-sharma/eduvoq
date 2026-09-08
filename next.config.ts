import type { NextConfig } from "next";

import wixRedirects from "./redirects.json";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@node-rs/argon2",
    "pino",
    "nodemailer",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "stripe",
    "openai",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  async redirects() {
    return wixRedirects;
  },
};

export default nextConfig;
