import crypto from "crypto";
import Razorpay from "razorpay";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { calculate, calculateCharges } from "./catalog.js";
async function supabaseUser(accessToken){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;if(!url||!key||!accessToken)return null;const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${accessToken}`}});return r.ok?r.json():null}

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const __filename=fileURLToPath(import.meta.url),__dirname=path.dirname(__filename);
const esc=v=>String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const money=n=>`₹${Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function makePdf(info){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margin:45}),chunks=[];
    doc.on("data",c=>chunks.push(c));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);
    const logo=path.join(__dirname,"..","assets","srijan-logo.png");
    if(fs.existsSync(logo))doc.image(logo,{fit:[180,55],align:"center"});
    doc.fontSize(10).fillColor("#6b7280").text("Create • Connect • Grow",{align:"center"});doc.moveDown(1.2);
    doc.fontSize(20).fillColor("#111827").text("SRIJAN Payment Receipt");doc.moveDown(.4);
    doc.fontSize(10).fillColor("#374151").text(`Receipt: ${info.receipt}`).text(`Date: ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}`).moveDown();
    doc.fontSize(12).fillColor("#111827").text("Customer details");doc.fontSize(10).fillColor("#374151");
    doc.text(`Name: ${info.customer.name}`).text(`Email: ${info.customer.email}`).text(`Phone / WhatsApp: ${info.customer.phone}`).text(`Business / Project: ${info.customer.business}`);
    if(info.customer.instagram)doc.text(`Instagram: ${info.customer.instagram}`);if(info.customer.twitter)doc.text(`Twitter / X: ${info.customer.twitter}`);if(info.customer.facebook)doc.text(`Facebook / Meta: ${info.customer.facebook}`);if(info.customer.otherSocial)doc.text(`Other social: ${info.customer.otherSocial}`);if(info.customer.notes)doc.text(`Requirements: ${info.customer.notes}`);
    doc.moveDown();doc.fontSize(12).fillColor("#111827").text("Selected services");doc.fontSize(10).fillColor("#374151");
    info.services.forEach(s=>doc.text(`${s.name} — ${money(s.price)} · ${s.delivery}`));
    info.addons.forEach(a=>doc.text(`Add-on: ${a.name} — ${money(a.price)} · ${a.delivery}`));
    doc.moveDown(.4).text(`Subtotal: ${money(info.subtotal)}`).text(`GST (18%): ${money(info.charges.gst)}`).text(`Gateway fee: ${money(info.charges.gatewayFee)}`).text(`Platform convenience fee: ${money(info.charges.platformFee)}`).text(`Lucky discount (${info.discountPercent}%): -${money(info.charges.discount)}`);
    doc.moveDown(.5).fontSize(14).fillColor("#111827").text(`Total paid: ${money(info.charges.total)}`);doc.fontSize(10).fillColor("#374151").text(`Payment ID: ${info.paymentId}`).text(`Razorpay Order ID: ${info.orderId}`).text(`Payment method: ${info.paymentMethod||"Razorpay Checkout"}`).text("Status: Captured");
    doc.moveDown(1.3).fontSize(9).fillColor("#6b7280").text("Thank you for choosing SRIJAN. We will shortly connect with you to confirm requirements and delivery details.");doc.text("Official communication: alertaiq6@gmail.com");doc.end();
  });
}

export async function POST(request){
 try{
  const body=await request.json();
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature,serviceIds,serviceId,addonIds=[],customer={},receipt}=body;
  const accessToken=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const authUser=await supabaseUser(accessToken);
  if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature)return json({error:"Payment verification details are incomplete."},400);
  const secret=process.env.RAZORPAY_KEY_SECRET,keyId=process.env.RAZORPAY_KEY_ID;
  if(!secret||!keyId)return json({error:"Razorpay server configuration is missing."},500);
  const expected=crypto.createHmac("sha256",secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if(expected.length!==String(razorpay_signature).length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(razorpay_signature))))return json({error:"Payment signature verification failed."},400);
  const razorpay=new Razorpay({key_id:keyId,key_secret:secret});
  const payment=await razorpay.payments.fetch(razorpay_payment_id);const order=await razorpay.orders.fetch(razorpay_order_id);
  const supaUrl=process.env.SUPABASE_URL,supaKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  let dbOrder=null;
  if(supaUrl&&supaKey){const qr=await fetch(`${supaUrl}/rest/v1/orders?select=*&razorpay_order_id=eq.${encodeURIComponent(razorpay_order_id)}&limit=1`,{headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`}});if(qr.ok){const rows=await qr.json();dbOrder=rows[0]||null;}}
  if(dbOrder?.payment_status==='captured'&&dbOrder.razorpay_payment_id===razorpay_payment_id)return json({ok:true,alreadyProcessed:true,emailSent:true});
  const services=[...(dbOrder?.service_snapshot||[])];const addons=[...(dbOrder?.addon_snapshot||[])];let subtotal=Number(dbOrder?.subtotal||0);
  if(!services.length){const ids=Array.isArray(serviceIds)?serviceIds:(serviceId?[serviceId]:[]);const calculated=await calculate(ids,Array.isArray(addonIds)?addonIds:[]);services.push(...calculated.services);addons.push(...calculated.addons);subtotal=calculated.subtotal;}
  const dp=Number(order?.notes?.discount_percent);if(!Number.isFinite(dp)||dp<0.5||dp>2)return json({error:"Verified order discount is invalid."},400);
  const charges=calculateCharges(subtotal,dp);
  if(payment.order_id!==razorpay_order_id||order.id!==razorpay_order_id)return json({error:"Payment order mismatch."},400);
  if(payment.status!=="captured")return json({error:`Payment is ${payment.status}. Receipt will be issued after capture.`},400);
  if(Number(payment.amount)!==Math.round(charges.total*100))return json({error:"Payment amount does not match the verified order."},400);
  if(dbOrder?.total&&Math.round(Number(dbOrder.total)*100)!==Number(payment.amount))return json({error:"Stored order total does not match the captured payment."},400);
  const info={receipt:receipt||`SRJ-${Date.now()}`,customer:{name:String(customer.name||"").slice(0,100),email:String(customer.email||"").slice(0,150),phone:String(customer.phone||"").slice(0,40),business:String(customer.business||"").slice(0,150),notes:String(customer.notes||"").slice(0,3000),instagram:String(customer.instagram||"").slice(0,150),twitter:String(customer.twitter||"").slice(0,150),facebook:String(customer.facebook||"").slice(0,150),otherSocial:String(customer.otherSocial||"").slice(0,200)},services,addons,subtotal,charges,discountPercent:dp,luckyName:order.notes?.lucky_name||customer.name,paymentId:razorpay_payment_id,orderId:razorpay_order_id,paymentMethod:payment.method};
  const pdf=await makePdf(info);
  // Mark the pre-created order as captured and create the initial project timeline.
  if(supaUrl&&supaKey){
    if(dbOrder?.id){
      const db=await fetch(`${supaUrl}/rest/v1/orders?id=eq.${encodeURIComponent(dbOrder.id)}`,{method:'PATCH',headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({razorpay_payment_id:info.paymentId,payment_status:'captured',updated_at:new Date().toISOString()})});
      if(!db.ok)console.error('Supabase order update failed',await db.text());
    }
    const projectCode=`SRJ-PRJ-${Date.now().toString(36).toUpperCase()}`;
    const projectPayload={project_code:projectCode,user_id:dbOrder?.user_id||authUser?.id||null,order_id:dbOrder?.id||null,title:info.services.map(x=>x.name).join(' + ').slice(0,150),status:'active',progress:5};
    const pr=await fetch(`${supaUrl}/rest/v1/projects`,{method:'POST',headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(projectPayload)});
    if(pr.ok){
      const rows=await pr.json();const projectId=rows[0]?.id;
      if(projectId){
        const milestones=['Requirements confirmed','Design / development','Integration & functionality','Testing & revisions','Deployment','Final delivery'];
        await fetch(`${supaUrl}/rest/v1/project_milestones`,{method:'POST',headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(milestones.map((title,i)=>({project_id:projectId,title,progress:i===0?100:0,status:i===0?'completed':'pending',sort_order:i})))});
        if(projectPayload.user_id)await fetch(`${supaUrl}/rest/v1/notifications`,{method:'POST',headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({user_id:projectPayload.user_id,title:'Payment confirmed',message:`Your payment ${info.paymentId} was verified. Project ${projectCode} has been created.`,created_at:new Date().toISOString()})});
      }
    }
  }
  const resendKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL,admin=process.env.ADMIN_NOTIFICATION_EMAIL||"sumitdixit240@gmail.com";
  if(!resendKey||!from)return json({ok:true,emailSent:false,receipt:info},200);
  const attachments=[{filename:`SRIJAN-Receipt-${info.receipt}.pdf`,content:pdf.toString("base64")}];
  const serviceRows=info.services.map(s=>`<li>${esc(s.name)} — ${money(s.price)} · ${esc(s.delivery)}</li>`).join("");
  const addonRows=info.addons.length?info.addons.map(a=>`<li>${esc(a.name)} — ${money(a.price)} · ${esc(a.delivery)}</li>`).join(""):`<li>No add-ons selected</li>`;
  const customerHtml=`<div style="font-family:Arial,sans-serif;max-width:720px;color:#172033;line-height:1.6"><div style="background:#08101d;padding:24px;border-radius:16px;color:white"><div style="font-size:30px;font-weight:800;color:#fbbf24">SRIJAN.</div><div style="color:#94a3b8">Create • Connect • Grow</div></div><h2>Payment successful</h2><p>Thank you, ${esc(info.customer.name)}. Your payment has been verified successfully.</p><h3>Customer details</h3><p>Name: ${esc(info.customer.name)}<br>Email: ${esc(info.customer.email)}<br>Phone: ${esc(info.customer.phone)}<br>Business: ${esc(info.customer.business)}<br>Requirements: ${esc(info.customer.notes||"Not provided")}</p><h3>Services</h3><ul>${serviceRows}</ul><h3>Add-ons</h3><ul>${addonRows}</ul><p><b>Subtotal:</b> ${money(info.subtotal)}<br><b>GST:</b> ${money(info.charges.gst)}<br><b>Gateway:</b> ${money(info.charges.gatewayFee)}<br><b>Platform:</b> ${money(info.charges.platformFee)}<br><b>Lucky discount:</b> -${money(info.charges.discount)}<br><b>Total paid:</b> ${money(info.charges.total)}</p><p>Your professional PDF receipt is attached. We will shortly connect with you.</p><p>Official email: alertaiq6@gmail.com</p></div>`;
  const adminHtml=`<div style="font-family:Arial,sans-serif;max-width:720px;color:#172033;line-height:1.6"><div style="background:#08101d;padding:24px;border-radius:16px;color:white"><div style="font-size:30px;font-weight:800;color:#fbbf24">SRIJAN.</div><div style="color:#94a3b8">NEW WORK RECEIVED</div></div><h2>New paid work has arrived</h2><p>A customer has completed payment. Please review the submitted requirements and begin follow-up.</p><h3>Customer</h3><p><b>Name:</b> ${esc(info.customer.name)}<br><b>Email:</b> ${esc(info.customer.email)}<br><b>Phone:</b> ${esc(info.customer.phone)}<br><b>Business:</b> ${esc(info.customer.business)}<br><b>Requirements:</b> ${esc(info.customer.notes||"Not provided")}</p><h3>Order</h3><ul>${serviceRows}</ul><h3>Add-ons</h3><ul>${addonRows}</ul><p><b>Total paid:</b> ${money(info.charges.total)}<br><b>Payment ID:</b> ${esc(info.paymentId)}<br><b>Order ID:</b> ${esc(info.orderId)}</p><p>Customer receipt is attached for reference.</p></div>`;
  const send=async(to,subject,html)=>{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${resendKey}`},body:JSON.stringify({from,to,reply_to:"alertaiq6@gmail.com",subject,html,attachments})});return {ok:r.ok,data:await r.json()};};
  const [customerMail,adminMail]=await Promise.all([send(info.customer.email,`SRIJAN — Payment receipt ${info.receipt}`,customerHtml),send(admin,`SRIJAN — New paid work: ${info.customer.business}`,adminHtml)]);
  return json({ok:true,emailSent:customerMail.ok&&adminMail.ok,customerEmailSent:customerMail.ok,adminEmailSent:adminMail.ok,receipt:info});
 }catch(e){console.error("verify-payment",e);return json({error:"Payment was received but receipt processing needs attention. Please contact alertaiq6@gmail.com."},500)}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS"}})}
