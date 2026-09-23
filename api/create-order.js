import Razorpay from "razorpay";
import { calculate, calculateCharges } from "./catalog.js";

const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { serviceId, addonIds=[], customer={} } = body;
    const { service, addons, subtotal } = calculate(serviceId, Array.isArray(addonIds) ? addonIds : []);

    if (!customer.name || !customer.email || !customer.phone || !customer.business) return json({error:"Name, email, phone and business name are required."},400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email))) return json({error:"Please enter a valid email address."},400);

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return json({error:"Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel."},500);

    // The lucky discount is applied only to the ₹9 gateway + ₹10 processing fees.
    const discountPercent = 3 + Math.floor(Math.random() * 5); // 3–7%
    const charges = calculateCharges(subtotal, discountPercent);
    const razorpay = new Razorpay({key_id:keyId,key_secret:keySecret});
    const receipt = `SRJ-${Date.now()}`.slice(0,40);
    const order = await razorpay.orders.create({
      amount: Math.round(charges.total * 100), currency:"INR", receipt,
      notes:{
        service_id:serviceId, service_name:service.name,
        addons:addons.map(a=>a.name).join(", ").slice(0,250),
        customer_name:String(customer.name).slice(0,100), customer_email:String(customer.email).slice(0,120),
        customer_phone:String(customer.phone).slice(0,30), discount_percent:String(discountPercent)
      }
    });
    return json({keyId,orderId:order.id,amount:order.amount,currency:order.currency,receipt,
      service:{id:serviceId,name:service.name,price:service.price,delivery:service.delivery},
      addons:addons.map(a=>({name:a.name,price:a.price,delivery:a.delivery})),subtotal,charges,discountPercent});
  } catch (e) {
    console.error("create-order",e);
    return json({error:"Could not create the payment order. Please try again."},500);
  }
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS"}})}
