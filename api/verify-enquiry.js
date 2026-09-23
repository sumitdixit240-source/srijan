import crypto from "crypto";
import Razorpay from "razorpay";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

const esc = (v) => String(v || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customer = {},
      selectedServices = [],
      selectedAddons = [],
      receipt,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Enquiry payment verification details are incomplete." }, 400);
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;

    if (!secret || !keyId) {
      return json({ error: "Razorpay server configuration is missing." }, 500);
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const received = String(razorpay_signature);
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
    ) {
      return json({ error: "Enquiry payment signature verification failed." }, 400);
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: secret });
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const order = await razorpay.orders.fetch(razorpay_order_id);

    if (payment.order_id !== razorpay_order_id || order.id !== razorpay_order_id) {
      return json({ error: "Enquiry payment order mismatch." }, 400);
    }

    if (payment.status !== "captured") {
      return json({ error: `Enquiry payment is ${payment.status}.` }, 400);
    }

    if (Number(payment.amount) !== 200) {
      return json({ error: "Enquiry payment amount does not match ₹2." }, 400);
    }

    if (String(order.notes?.enquiry_fee) !== "2") {
      return json({ error: "This is not a valid SRIJAN enquiry order." }, 400);
    }

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "alertaiq6@gmail.com";
    const admin = process.env.ADMIN_NOTIFICATION_EMAIL || "sumitdixit240@gmail.com";

    if (!resendKey) {
      return json({
        ok: true,
        emailSent: false,
        warning: "₹2 enquiry payment verified, but RESEND_API_KEY is missing.",
      });
    }

    const serviceText = Array.isArray(selectedServices) && selectedServices.length
      ? selectedServices.map(esc).join(", ")
      : "Not provided";
    const addonText = Array.isArray(selectedAddons) && selectedAddons.length
      ? selectedAddons.map(esc).join(", ")
      : "None";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:720px;color:#172033;line-height:1.6">
        <div style="background:#08101d;padding:24px;border-radius:16px;color:white">
          <div style="font-size:30px;font-weight:800;color:#fbbf24">SRIJAN.</div>
          <div style="color:#94a3b8">NEW ENQUIRY — ₹2 PAID</div>
        </div>
        <h2>Customer requested more updates</h2>
        <p>A customer paid the ₹2 enquiry fee and requested further discussion/updation before continuing with the main service payment.</p>
        <h3>Customer</h3>
        <p>
          <b>Name:</b> ${esc(customer.name)}<br>
          <b>Email:</b> ${esc(customer.email)}<br>
          <b>Phone:</b> ${esc(customer.phone)}<br>
          <b>Business / Project:</b> ${esc(customer.business)}<br>
          <b>Requirements:</b> ${esc(customer.notes || "Not provided")}<br>
          <b>Instagram:</b> ${esc(customer.instagram || "Not provided")}<br>
          <b>Twitter / X:</b> ${esc(customer.twitter || "Not provided")}<br>
          <b>Facebook / Meta:</b> ${esc(customer.facebook || "Not provided")}<br>
          <b>Other social:</b> ${esc(customer.otherSocial || "Not provided")}
        </p>
        <h3>Current selection</h3>
        <p><b>Services:</b> ${serviceText}<br><b>Add-ons:</b> ${addonText}</p>
        <h3>Enquiry payment</h3>
        <p><b>Amount:</b> ₹2.00<br><b>Payment ID:</b> ${esc(razorpay_payment_id)}<br><b>Order ID:</b> ${esc(razorpay_order_id)}<br><b>Receipt:</b> ${esc(receipt || order.receipt || "N/A")}</p>
        <p>Please contact the customer and discuss the requested updates. The customer has been returned to the SRIJAN home page.</p>
      </div>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: admin,
        reply_to: "alertaiq6@gmail.com",
        subject: `SRIJAN — New enquiry: ${String(customer.business || "Customer")}`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend enquiry error", data);
      return json({
        ok: true,
        emailSent: false,
        emailError: data?.message || "Resend rejected the email.",
        paymentVerified: true,
      }, 200);
    }

    return json({ ok: true, emailSent: true, paymentVerified: true });
  } catch (e) {
    console.error("verify-enquiry", e);
    return json({ error: "₹2 enquiry payment was received but enquiry email processing needs attention." }, 500);
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
