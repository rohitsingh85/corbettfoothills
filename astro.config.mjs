import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "static",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      entryLimit: 5000,
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
      filter: (page) => !page.includes("/about/"),
    }),
  ],
  site: "https://corbett.life",
});
