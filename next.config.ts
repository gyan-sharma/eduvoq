import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@node-rs/argon2", "pino", "nodemailer"],
  async redirects() {
    return [
      { source: "/expert-consultation", destination: "/consult", permanent: true },
      { source: "/booking-calendar", destination: "/consult", permanent: true },
      { source: "/booking-form", destination: "/consult", permanent: true },
      { source: "/my-bookings", destination: "/account/bookings", permanent: true },
      {
        source: "/account/my-bookings",
        destination: "/account/bookings",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
