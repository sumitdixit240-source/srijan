# SRIJAN Priority 1 setup

This version adds the Priority-1 MVP: service marketplace, free enquiry flow, Razorpay checkout foundation, email/password customer auth, customer dashboard, admin dashboard, server-side payment verification, and database-backed service/enquiry/order/project records.

## 1. Create Supabase project
1. Create a Supabase project.
2. In Authentication > Providers, enable Email.
3. In Authentication > URL Configuration, add your deployed SRIJAN URL (for example `https://your-domain.com`) and `https://your-domain.com/auth.html` as appropriate redirect URLs.
4. Open SQL Editor and run `supabase-schema.sql`.
5. Run `supabase-seed.sql`.
6. Create your first account through `auth.html`.
7. In SQL Editor, promote that account: `update public.profiles set role='super_admin' where email='YOUR_ADMIN_EMAIL';`

## 2. Configure browser auth
Edit `supabase-config.js` and put only the Supabase Project URL and anon/publishable key there. These are browser-safe public values when RLS is correctly configured.

Never put a Supabase service-role key in frontend code.

## 3. Existing payment/email environment variables
Keep these in Vercel Project Settings > Environment Variables:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (use a verified Resend sender/domain)
- `ADMIN_NOTIFICATION_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it in browser code)

## 4. Priority-1 customer flow
Services → select package/add-ons → enter customer details → free enquiry or Razorpay payment → server verification → receipt/email → dashboard records.

The current payment API remains the authoritative place for Razorpay secret/signature/amount/status checks.

## 5. Security checklist before production
- HTTPS only
- Supabase RLS enabled (included in SQL)
- Strong admin password + MFA when you move to Priority 2
- Never expose Razorpay secret, Resend API key or service-role key
- Use a verified email sender
- Restrict Supabase redirect URLs to your own domain
- Keep dependencies updated
