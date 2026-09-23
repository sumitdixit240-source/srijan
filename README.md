# SRIJAN — production-ready static/Vercel MVP

SRIJAN is a multi-page client service platform with a public service marketplace, Supabase authentication/database, ₹0 enquiries, Razorpay checkout, server-side payment verification, email/receipt processing, customer dashboard and protected admin dashboard.

## Stack
- Static HTML/CSS/ES modules
- Supabase Auth + Postgres + RLS
- Vercel serverless API routes
- Razorpay Checkout
- Resend email API
- PDFKit receipts

## Deploy
1. Import this folder into a Git repository and deploy it to Vercel.
2. Add the variables from `.env.example` in Vercel. Use the new Supabase publishable/secret keys; never expose the secret key in browser code.
3. Replace the placeholders in `supabase-config.js` with your Supabase project URL and publishable key.
4. In Supabase SQL Editor run `supabase-schema.sql`, then `supabase-seed.sql`.
5. Create the first admin account in Supabase Auth and promote it with the SQL comment at the end of the schema.
6. Enable Email/Password and Google under Supabase Authentication Providers. Add your exact production URL and auth callback URL to Supabase Authentication URL Configuration.
7. Configure a verified Resend sender/domain.
8. Configure Razorpay test keys first. Verify successful, failed and cancelled payments before switching to live keys.
9. In Supabase run `supabase-production-hardening.sql` after the base schema. Review Security Advisor before going live.
10. Enable MFA on your Supabase organization/admin accounts and keep production secrets only in Vercel.

## Browser vs server secrets
Browser-safe: `SUPABASE_URL` and the Supabase publishable key in `supabase-config.js`.
Server-only: `SUPABASE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, `RESEND_API_KEY` and any database credentials.

## Important
The website is deployment-ready, but production activation still requires your own Supabase/Razorpay/Resend credentials and domain settings. Never paste secrets into HTML/JS or Git.
