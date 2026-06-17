import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "hybrid",
  adapter: cloudflare({
    imageService: "cloudflare",
    platformProxy: { enabled: true },
  }),
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      filter: (page) => !page.includes("/blog/blog-"),
      entryLimit: 5000,
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  site: "https://corbett.life",
  trailingSlash: "always",
  vite: {
    ssr: {
      noExternal: ["@astrojs/tailwind"],
    },
  },
});
