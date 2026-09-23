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

export async function POST(request) {
  try {
    const body = await request.json();
    const customer = body.customer || {};

    if (!customer.name || !customer.email || !customer.phone || !customer.business) {
      return json({ error: "Name, email, phone and business name are required." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email))) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return json({ error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel." }, 500);
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const receipt = `ENQ-${Date.now()}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: 200,
      currency: "INR",
      receipt,
      notes: {
        enquiry_fee: "2",
        enquiry_name: String(customer.name).slice(0, 100),
        enquiry_email: String(customer.email).slice(0, 120),
        enquiry_business: String(customer.business).slice(0, 150),
      },
    });

    return json({
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt,
    });
  } catch (e) {
    console.error("create-enquiry-order", e);
    return json({ error: "Could not create the ₹2 enquiry payment. Please try again." }, 500);
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
