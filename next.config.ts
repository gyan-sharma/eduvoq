import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@node-rs/argon2",
    "pino",
    "nodemailer",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "stripe",
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
      {
        source: "/category/all-products",
        destination: "/store",
        permanent: true,
      },
      {
        source: "/product-page/:slug",
        destination: "/store/products/:slug",
        permanent: true,
      },
      {
        source: "/cart-page",
        destination: "/cart",
        permanent: true,
      },
      {
        source: "/my-orders",
        destination: "/account/orders",
        permanent: true,
      },
      {
        source: "/my-addresses",
        destination: "/account/addresses",
        permanent: true,
      },
      {
        source: "/account/my-orders",
        destination: "/account/orders",
        permanent: true,
      },
      {
        source: "/account/my-addresses",
        destination: "/account/addresses",
        permanent: true,
      },
      {
        source: "/event-list",
        destination: "/events",
        permanent: true,
      },
      {
        source: "/event-details/:slug",
        destination: "/events/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
