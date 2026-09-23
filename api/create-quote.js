import { calculate, calculateCharges } from "./catalog.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"}});
export async function POST(request){
  try{
    const body=await request.json();
    const serviceIds=Array.isArray(body.serviceIds)?body.serviceIds:body.serviceId?[body.serviceId]:[];
    const addonIds=Array.isArray(body.addonIds)?body.addonIds:[];
    const customer=body.customer||{};
    const {services,addons,subtotal}=calculate(serviceIds,addonIds);
    if(!customer.name||!customer.email||!customer.phone||!customer.business)return json({error:"Name, email, phone and business name are required."},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email)))return json({error:"Please enter a valid email address."},400);
    const discountPercent=Number((0.5+Math.random()*1.5).toFixed(2));
    const luckyName=String(customer.name).trim().split(/\s+/)[0]||"Lucky Customer";
    const charges=calculateCharges(subtotal,discountPercent);
    return json({ok:true,services:services.map((s,i)=>({id:serviceIds[i],name:s.name,price:s.price,delivery:s.delivery,description:s.description})),addons:addons.map((a,i)=>({id:addonIds[i],name:a.name,price:a.price,delivery:a.delivery})),subtotal,charges,discountPercent,luckyName});
  }catch(e){console.error("create-quote",e);return json({error:"Could not prepare the quote."},500)}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"}})}
