import fs from "node:fs";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for the production build."
  );
}

// Create Vercel output directory
const outputDir = path.resolve("public");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate browser-safe Supabase configuration
const content = `// Generated at build time. Do not commit real secrets.
export const SUPABASE_URL = ${JSON.stringify(url)};
export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(key)};
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = () => true;
`;

fs.writeFileSync(
  path.join(outputDir, "supabase-config.js"),
  content,
  "utf8"
);

console.log("Generated browser-safe Supabase configuration.");
console.log(`Output directory: ${outputDir}`);
