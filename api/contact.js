export async function POST(request) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();

    // Honeypot: bots that fill this hidden field are silently accepted.
    if (body.website) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    const required = ["name", "email", "phone", "service", "budget", "desc"];
    for (const field of required) {
      if (!body[field] || String(body[field]).trim().length === 0) {
        return new Response(JSON.stringify({ error: `Missing field: ${field}` }), {
          status: 400, headers
        });
      }
    }

    const name = String(body.name).trim().slice(0, 100);
    const business = String(body.business || "").trim().slice(0, 150);
    const email = String(body.email).trim().slice(0, 200);
    const phone = String(body.phone).trim().slice(0, 60);
    const service = String(body.service).trim().slice(0, 120);
    const budget = String(body.budget).trim().slice(0, 80);
    const desc = String(body.desc).trim().slice(0, 5000);

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "SRIJAN <onboarding@resend.dev>";
    const to = process.env.CONTACT_TO_EMAIL || "alertaiq6@gmail.com";

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: "Email service is not configured yet. Add RESEND_API_KEY in Vercel."
      }), { status: 500, headers });
    }

    const safe = (value) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>New SRIJAN Website Enquiry</h2>
        <p style="color:#6b7280">Submitted from the SRIJAN website.</p>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0">
        <p><strong>Name:</strong> ${safe(name)}</p>
        <p><strong>Business / Project:</strong> ${safe(business || "Not provided")}</p>
        <p><strong>Email:</strong> ${safe(email)}</p>
        <p><strong>WhatsApp / Phone:</strong> ${safe(phone)}</p>
        <p><strong>Service:</strong> ${safe(service)}</p>
        <p><strong>Budget:</strong> ${safe(budget)}</p>
        <p><strong>Requirements:</strong></p>
        <div style="white-space:pre-wrap;background:#f3f4f6;padding:14px;border-radius:8px">${safe(desc)}</div>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `New SRIJAN enquiry — ${name} — ${service}`,
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      return new Response(JSON.stringify({
        error: "Email delivery failed. Please try again or use WhatsApp."
      }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ ok: true, id: resendData.id }), {
      status: 200, headers
    });
  } catch (error) {
    console.error("Contact API error:", error);
    return new Response(JSON.stringify({
      error: "Invalid request. Please try again."
    }), { status: 400, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
