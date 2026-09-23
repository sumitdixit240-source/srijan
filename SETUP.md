# SRIJAN — deployment setup

## 1. Supabase
1. Create/open the Supabase project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Run `supabase-seed.sql` once.
4. Run `supabase-production-hardening.sql`.
5. Authentication → Providers → enable Email/Password.
6. Enable Google OAuth if you want Google login and add the exact production callback URL.
7. Authentication → URL Configuration → add your exact production site URL and `https://YOUR-DOMAIN/auth.html`.
8. Create your first admin user. Then promote it in SQL:
   `update public.profiles set role='super_admin', status='active' where email='YOUR_ADMIN_EMAIL';`
9. Review Database → Security Advisor. Supabase recommends RLS on all exposed tables, SSL enforcement and MFA for administrative access.

## 2. Browser configuration
For local development, edit `supabase-config.js` with only:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

For Vercel production, the build script generates `supabase-config.js` from the environment automatically. Do not commit real credentials.

## 3. Vercel environment variables
Add these to Production, Preview and Development as appropriate:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`
- `CONTACT_TO_EMAIL` (optional; falls back to admin email)
- `APP_ORIGIN` = exact production URL

Supabase's current API-key guidance is to use publishable keys in browser code and secret keys only in server-controlled components. Legacy `anon`/`service_role` keys are being phased out during 2026.

## 4. Razorpay
Start with test keys. Verify:
- successful payment
- failed/cancelled payment
- amount verification
- receipt generation
- order record
- project creation
- dashboard visibility

Only then switch to live credentials.

## 5. Resend
Use a verified sender/domain. The sender must match the configured verified identity. Test both customer and admin emails.

## 6. Deploy
Push this folder to GitHub and import it into Vercel. Vercel runs `npm run build`, which writes the browser-safe Supabase configuration. Server API secrets remain in Vercel environment variables.

## 7. Production security checklist
- HTTPS enabled
- Supabase RLS and Security Advisor reviewed
- Supabase org/admin MFA enabled
- Secret key never in frontend/Git
- Razorpay secret never in frontend/Git
- Resend key never in frontend/Git
- Exact auth redirect URLs only
- Verified email sender/domain
- Test keys used before live payment
- Production domain set in `APP_ORIGIN`
- Dependencies kept updated
- Backups and recovery plan enabled
