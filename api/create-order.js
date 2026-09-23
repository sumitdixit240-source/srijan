import Razorpay from "razorpay";
import { calculate, calculateCharges } from "./catalog.js";
async function supabaseUser(accessToken){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;if(!url||!key||!accessToken)return null;const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${accessToken}`}});return r.ok?r.json():null}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function POST(request){
  try{
    const body=await request.json();
    if(JSON.stringify(body).length>120000)return json({error:'Request is too large.'},413);
    const accessToken=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const authUser=await supabaseUser(accessToken);
    const serviceIds=Array.isArray(body.serviceIds)?body.serviceIds:body.serviceId?[body.serviceId]:[];
    const addonIds=Array.isArray(body.addonIds)?body.addonIds:[];
    const customer=body.customer||{};
    const {services,addons,subtotal}=await calculate(serviceIds,addonIds);
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
    const supaUrl=process.env.SUPABASE_URL,supaKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(supaUrl&&supaKey){
      const payload={order_code:receipt,user_id:authUser?.id||null,customer_email:String(customer.email).slice(0,150),customer_name:String(customer.name).slice(0,100),service_snapshot:services.map((x,i)=>({id:serviceIds[i],name:x.name,price:x.price,delivery:x.delivery,description:x.description})),addon_snapshot:addons.map(x=>({name:x.name,price:x.price,delivery:x.delivery})),subtotal,total:charges.total,razorpay_order_id:order.id,payment_status:'created'};
      const db=await fetch(`${supaUrl}/rest/v1/orders`,{method:'POST',headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`, 'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload)});
      if(!db.ok){console.error('pending order insert failed',await db.text());return json({error:'Could not save the payment order. Please try again.'},500);}
    }
    return json({keyId,orderId:order.id,amount:order.amount,currency:order.currency,receipt,services:services.map((s,i)=>({id:serviceIds[i],name:s.name,price:s.price,delivery:s.delivery,description:s.description})),addons:addons.map(a=>({name:a.name,price:a.price,delivery:a.delivery})),subtotal,charges,discountPercent,luckyName});
  }catch(e){console.error("create-order",e);return json({error:"Could not create the payment order. Please try again."},500)}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS"}})}
