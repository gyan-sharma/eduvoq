import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/about-us", destination: "/about", permanent: true },
      {
        source: "/privacy-policy",
        destination: "/privacy",
        permanent: true,
      },
      { source: "/tnc", destination: "/terms", permanent: true },
      {
        source: "/plans-pricing",
        destination: "/pricing",
        permanent: true,
      },
      { source: "/site-map", destination: "/sitemap", permanent: true },
      {
        source: "/thank-you-page",
        destination: "/thank-you",
        permanent: true,
      },
      {
        source: "/copy-of-cultural-activities",
        destination: "/services/marketing",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
