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

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "public");

// Remove old build
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, {
    recursive: true,
    force: true
  });
}

// Create output directory
fs.mkdirSync(outputDir, {
  recursive: true
});

// Files to copy from project root
const filesToCopy = [
  "index.html",
  "about.html",
  "services.html",
  "contact.html",
  "faq.html",
  "login.html",
  "signup.html"
];

// Copy HTML files if they exist
for (const file of filesToCopy) {
  const source = path.join(rootDir, file);

  if (fs.existsSync(source)) {
    fs.copyFileSync(
      source,
      path.join(outputDir, file)
    );
  }
}

// Directories to copy
const directoriesToCopy = [
  "assets",
  "css",
  "js",
  "images",
  "img",
  "fonts"
];

for (const directory of directoriesToCopy) {
  const source = path.join(rootDir, directory);
  const destination = path.join(outputDir, directory);

  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, {
      recursive: true,
      force: true
    });
  }
}

// Generate Supabase configuration
const supabaseConfig = `// Generated automatically during production build.
// Do not commit real secrets.

export const SUPABASE_URL = ${JSON.stringify(url)};

export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(key)};

export const SUPABASE_ANON_KEY =
  SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = () => true;
`;

fs.writeFileSync(
  path.join(outputDir, "supabase-config.js"),
  supabaseConfig,
  "utf8"
);

console.log("=================================");
console.log("SRIJAN production build complete");
console.log("=================================");
console.log(`Output directory: ${outputDir}`);
console.log("Supabase configuration generated.");
