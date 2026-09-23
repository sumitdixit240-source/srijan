import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "public");

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for the production build."
  );
}

// -----------------------------------------
// 1. Remove previous production build
// -----------------------------------------

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, {
    recursive: true,
    force: true
  });
}

// -----------------------------------------
// 2. Create public directory
// -----------------------------------------

fs.mkdirSync(outputDir, {
  recursive: true
});

// -----------------------------------------
// 3. Copy root website files
// -----------------------------------------

const rootFiles = [
  "index.html",
  "about.html",
  "admin.html",
  "auth.html",
  "contact.html",
  "dashboard.html",
  "faq.html",
  "pay.html",
  "services.html",
  "work.html",
  "app.js",
  "auth.js",
  "styles.css",
  "README.md"
];

for (const file of rootFiles) {
  const source = path.join(rootDir, file);
  const destination = path.join(outputDir, file);

  if (fs.existsSync(source)) {
    fs.copyFileSync(source, destination);
    console.log(`Copied: ${file}`);
  }
}

// -----------------------------------------
// 4. Copy important directories
// -----------------------------------------

const directories = [
  "assets",
  "src",
  "demos"
];

for (const directory of directories) {
  const source = path.join(rootDir, directory);
  const destination = path.join(outputDir, directory);

  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, {
      recursive: true,
      force: true
    });

    console.log(`Copied directory: ${directory}`);
  }
}

// -----------------------------------------
// 5. Generate Supabase configuration
// -----------------------------------------

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

console.log("Generated: supabase-config.js");

// -----------------------------------------
// 6. Verify required files
// -----------------------------------------

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "supabase-config.js"
];

for (const file of requiredFiles) {
  const filePath = path.join(outputDir, file);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Production build failed: ${file} was not created.`
    );
  }
}

// -----------------------------------------
// 7. Build completed
// -----------------------------------------

console.log("");
console.log("======================================");
console.log(" SRIJAN PRODUCTION BUILD SUCCESSFUL");
console.log("======================================");
console.log(`Output: ${outputDir}`);
console.log("");
