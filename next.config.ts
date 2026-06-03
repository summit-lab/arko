import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Cache de las imagenes optimizadas (24h) + webp. Reduce el re-fetch/re-encode
    // del optimizer on-demand para las imagenes que SI pasan por next/image
    // (YouTube, demograficos). Los thumbnails de reels ya NO pasan por el optimizer
    // (se sirven directo desde reel-media storage / IG CDN con <img>).
    minimumCacheTTL: 60 * 60 * 24,
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "scontent.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
      },
      {
        // Algunos thumbnails de IG (competencia) vienen de lookaside.fbcdn.net
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
