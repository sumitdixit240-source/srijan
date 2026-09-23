import fs from 'node:fs';
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
if(!url||!key)throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for the production build.');
const content=`// Generated at build time. Do not commit real secrets.\nexport const SUPABASE_URL=${JSON.stringify(url)};\nexport const SUPABASE_PUBLISHABLE_KEY=${JSON.stringify(key)};\nexport const SUPABASE_ANON_KEY=SUPABASE_PUBLISHABLE_KEY;\nexport const isSupabaseConfigured=()=>true;\n`;
fs.writeFileSync('supabase-config.js',content);
console.log('Generated browser-safe Supabase configuration.');
