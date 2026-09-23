import Razorpay from "razorpay";
import { calculate, calculateCharges } from "./catalog.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
export async function POST(request){
  try{
    const body=await request.json();
    const serviceIds=Array.isArray(body.serviceIds)?body.serviceIds:body.serviceId?[body.serviceId]:[];
    const addonIds=Array.isArray(body.addonIds)?body.addonIds:[];
    const customer=body.customer||{};
    const {services,addons,subtotal}=calculate(serviceIds,addonIds);
    if(!customer.name||!customer.email||!customer.phone||!customer.business) return json({error:"Name, email, phone and business name are required."},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email))) return json({error:"Please enter a valid email address."},400);
    const keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET;
    if(!keyId||!keySecret) return json({error:"Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel."},500);
    const discountPercent=Number((0.5+Math.random()*1.5).toFixed(2));
    const luckyName=String(customer.name).trim().split(/\s+/)[0]||"Lucky Customer";
    const charges=calculateCharges(subtotal,discountPercent);
    const razorpay=new Razorpay({key_id:keyId,key_secret:keySecret});
    const receipt=`SRJ-${Date.now()}`.slice(0,40);
    const order=await razorpay.orders.create({amount:Math.round(charges.total*100),currency:"INR",receipt,notes:{service_ids:serviceIds.join(","),service_names:services.map(s=>s.name).join(", ").slice(0,250),addons:addons.map(a=>a.name).join(", ").slice(0,250),customer_name:String(customer.name).slice(0,100),customer_email:String(customer.email).slice(0,120),discount_percent:String(discountPercent),lucky_name:luckyName}});
    return json({keyId,orderId:order.id,amount:order.amount,currency:order.currency,receipt,services:services.map((s,i)=>({id:serviceIds[i],name:s.name,price:s.price,delivery:s.delivery,description:s.description})),addons:addons.map(a=>({name:a.name,price:a.price,delivery:a.delivery})),subtotal,charges,discountPercent,luckyName});
  }catch(e){console.error("create-order",e);return json({error:"Could not create the payment order. Please try again."},500)}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS"}})}
