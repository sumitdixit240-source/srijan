import { calculate } from "./catalog.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const money=n=>`₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function code(){return `SRJ-ENQ-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`}
async function supabaseUser(accessToken){
  const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if(!url||!anon||!accessToken)return null;
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${accessToken}`}});
  if(!r.ok)return null; return await r.json();
}
export async function POST(request){
 try{
  const body=await request.json(); const customer=body.customer||{};
    if(JSON.stringify(body).length>120000) return json({error:"Request is too large."},413);
  const serviceIds=Array.isArray(body.serviceIds)?body.serviceIds:body.serviceId?[body.serviceId]:[];
  const addonIds=Array.isArray(body.addonIds)?body.addonIds:[];
  const {services,addons,subtotal}=await calculate(serviceIds,addonIds);
  if(!customer.name||!customer.email||!customer.phone||!customer.business)return json({error:"Name, email, phone and business name are required."},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email)))return json({error:"Please enter a valid email address."},400);
  const enquiryCode=code();
  const token=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const authUser=await supabaseUser(token);
  const userId=authUser?.id||null;
  const supaUrl=process.env.SUPABASE_URL,supaKey=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(supaUrl&&supaKey){
    const payload={enquiry_code:enquiryCode,user_id:userId,customer_name:String(customer.name).slice(0,100),customer_email:String(customer.email).slice(0,150),customer_phone:String(customer.phone).slice(0,40),business_name:String(customer.business).slice(0,150),notes:String(customer.notes||"").slice(0,3000),service_ids:serviceIds,addon_ids:addonIds,service_snapshot:services,addon_snapshot:addons,estimated_value:subtotal,status:"new"};
    const r=await fetch(`${supaUrl}/rest/v1/enquiries`,{method:"POST",headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(payload)});
    if(!r.ok){const t=await r.text();console.error("Supabase enquiry insert failed",t);return json({error:"Your enquiry could not be saved. Please try again."},500)}
  } else console.warn("Supabase enquiry storage is not configured; email-only fallback.");

  const resendKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL,admin=process.env.ADMIN_NOTIFICATION_EMAIL||"sumitdixit240@gmail.com";
  let emailSent=false;
  if(resendKey&&from&&admin){
    const serviceRows=services.map(s=>`<li><b>${esc(s.name)}</b> — ${money(s.price)} · ${esc(s.delivery)}</li>`).join("");
    const addonRows=addons.length?addons.map(a=>`<li>${esc(a.name)} — ${money(a.price)} · ${esc(a.delivery)}</li>`).join(""):`<li>No add-ons selected</li>`;
    const html=`<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;color:#172033;line-height:1.6"><div style="background:#08101d;padding:24px;border-radius:16px;color:white"><div style="font-size:30px;font-weight:800;color:#fbbf24">SRIJAN.</div><div style="color:#94a3b8">Create • Connect • Grow</div></div><h2>New enquiry received</h2><p>A customer has submitted a free project enquiry through the SRIJAN website. No payment was requested for this enquiry.</p><p><b>Enquiry ID:</b> ${esc(enquiryCode)}<br><b>Date:</b> ${esc(new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}))}<br><b>Status:</b> New</p><h3>Customer details</h3><p><b>Name:</b> ${esc(customer.name)}<br><b>Email:</b> ${esc(customer.email)}<br><b>Phone / WhatsApp:</b> ${esc(customer.phone)}<br><b>Business / Project:</b> ${esc(customer.business)}</p><h3>Selected services</h3><ul>${serviceRows}</ul><h3>Add-ons</h3><ul>${addonRows}</ul><p><b>Estimated service value:</b> ${money(subtotal)}</p><h3>Customer requirement</h3><p>${esc(customer.notes||"No additional message provided.")}</p><h3>Key points</h3><ul><li>Customer requested a consultation/customization discussion.</li><li>Selected package and add-on scope is captured above.</li><li>Confirm requirements, delivery timeline and final quotation before starting paid work.</li></ul><h3>Recommended next action</h3><p>Review the enquiry in the SRIJAN admin dashboard, contact the customer using the submitted details, clarify scope, and send a quotation or payment request when the final scope is agreed.</p><p>Regards,<br><b>SRIJAN</b><br>Official communication: alertaiq6@gmail.com</p></div>`;
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${resendKey}`},body:JSON.stringify({from,to:admin,reply_to:customer.email,subject:`SRIJAN — New enquiry ${enquiryCode} — ${String(customer.business).slice(0,80)}`,html})});
    emailSent=r.ok; if(!r.ok)console.error("Resend enquiry error",await r.text());
  }
  return json({ok:true,enquiryId:enquiryCode,emailSent});
 }catch(e){console.error("create-enquiry",e);return json({error:"Could not submit your enquiry. Please try again."},500)}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"}})}
