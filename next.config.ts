import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@node-rs/argon2",
    "pino",
    "nodemailer",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/learning-material",
        destination: "/resources/learning-material",
        permanent: true,
      },
      {
        source: "/class-notes",
        destination: "/resources/class-notes",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
