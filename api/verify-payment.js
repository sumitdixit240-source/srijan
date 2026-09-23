import crypto from "crypto";
import Razorpay from "razorpay";
import PDFDocument from "pdfkit";
import { calculate, calculateCharges } from "./catalog.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
const __filename=fileURLToPath(import.meta.url); const __dirname=path.dirname(__filename);

function makePdf(info){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margin:45}); const chunks=[];
    doc.on("data",c=>chunks.push(c)); doc.on("end",()=>resolve(Buffer.concat(chunks))); doc.on("error",reject);
    const logo=path.join(__dirname,"..","assets","srijan-logo.png");
    if(info.customer.logoData && info.customer.logoData.startsWith("data:image/")){ try{ doc.image(Buffer.from(info.customer.logoData.split(",")[1],"base64"),{fit:[160,80],align:"center"}); }catch{} }
    else if(fs.existsSync(logo)) doc.image(logo,{fit:[180,52],align:"center"}); else doc.fontSize(26).fillColor("#111827").text("SRIJAN.",{align:"center"});
    doc.fontSize(10).fillColor("#6b7280").text("Create • Connect • Grow",{align:"center"}); doc.moveDown(1.3);
    doc.fontSize(19).fillColor("#111827").text("Payment Receipt"); doc.moveDown(.5);
    doc.fontSize(10).fillColor("#374151").text(`Receipt: ${info.receipt}`); doc.text(`Date: ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}`); doc.moveDown();
    doc.fontSize(12).fillColor("#111827").text("Customer details"); doc.fontSize(10).fillColor("#374151");
    doc.text(`Name: ${info.customer.name}`); doc.text(`Email: ${info.customer.email}`); doc.text(`Phone / WhatsApp: ${info.customer.phone}`); doc.text(`Business / Project: ${info.customer.business||"Not provided"}`);
    if(info.customer.instagram) doc.text(`Instagram: ${info.customer.instagram}`); if(info.customer.twitter) doc.text(`Twitter / X: ${info.customer.twitter}`); if(info.customer.facebook) doc.text(`Facebook / Meta: ${info.customer.facebook}`); if(info.customer.otherSocial) doc.text(`Other social: ${info.customer.otherSocial}`);
    doc.text(`Requirements: ${info.customer.notes||"Not provided"}`); doc.moveDown();
    doc.fontSize(12).fillColor("#111827").text("Order details"); doc.fontSize(10).fillColor("#374151").text(`Service: ${info.service.name} — ₹${info.service.price.toLocaleString("en-IN")}`);
    for(const a of info.addons) doc.text(`Add-on: ${a.name} — ₹${a.price.toLocaleString("en-IN")}`);
    doc.moveDown(.4); doc.text(`Subtotal: ₹${info.subtotal.toLocaleString("en-IN")}`); doc.text(`GST (18%): ₹${info.charges.gst.toFixed(2)}`); doc.text(`Gateway fee: ₹${info.charges.gatewayFee.toFixed(2)}`); doc.text(`Processing fee: ₹${info.charges.processingFee.toFixed(2)}`); doc.text(`Lucky fee discount (${info.discountPercent}%): -₹${info.charges.discount.toFixed(2)}`);
    doc.moveDown(.5); doc.fontSize(14).fillColor("#111827").text(`Total paid: ₹${info.charges.total.toFixed(2)}`); doc.fontSize(10).fillColor("#374151").text(`Payment ID: ${info.paymentId}`); doc.text(`Razorpay Order ID: ${info.orderId}`); doc.text(`Payment method: ${info.paymentMethod||"Razorpay Checkout"}`); doc.text("Status: Captured");
    doc.moveDown(1.4); doc.fontSize(9).fillColor("#6b7280").text("Thank you for choosing SRIJAN. Delivery begins after requirement confirmation and receipt of required content/assets. This receipt records the payment processed through Razorpay."); doc.moveDown(.6); doc.text("Official communication: alertaiq6@gmail.com");
    doc.end();
  });
}
function escapeHtml(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;")}

export async function POST(request){
 try{
  const body=await request.json(); const {razorpay_order_id,razorpay_payment_id,razorpay_signature,serviceId,addonIds=[],customer={},receipt,discountPercent}=body;
  if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature) return json({error:"Payment verification details are incomplete."},400);
  const secret=process.env.RAZORPAY_KEY_SECRET,keyId=process.env.RAZORPAY_KEY_ID; if(!secret||!keyId) return json({error:"Razorpay server configuration is missing."},500);
  const expected=crypto.createHmac("sha256",secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(razorpay_signature)))) return json({error:"Payment signature verification failed."},400);
  const {service,addons,subtotal}=calculate(serviceId,Array.isArray(addonIds)?addonIds:[]);
  const razorpay=new Razorpay({key_id:keyId,key_secret:secret}); const payment=await razorpay.payments.fetch(razorpay_payment_id);
  const verifiedOrder=await razorpay.orders.fetch(razorpay_order_id);
  const orderDiscount=Number(verifiedOrder?.notes?.discount_percent);
  const dp=Number.isFinite(orderDiscount) ? Math.min(7,Math.max(3,orderDiscount)) : Math.min(7,Math.max(3,Number(discountPercent)||3));
  const charges=calculateCharges(subtotal,dp);
  if(payment.order_id!==razorpay_order_id || verifiedOrder.id!==razorpay_order_id) return json({error:"Payment order mismatch."},400);
  if(payment.status!=="captured") return json({error:`Payment is ${payment.status}. Receipt will be issued after capture.`},400);
  if(Number(payment.amount)!==Math.round(charges.total*100)) return json({error:"Payment amount does not match the verified order."},400);
  const info={receipt:receipt||`SRJ-${Date.now()}`,customer:{name:String(customer.name||"").slice(0,100),email:String(customer.email||"").slice(0,150),phone:String(customer.phone||"").slice(0,40),business:String(customer.business||"").slice(0,150),notes:String(customer.notes||"").slice(0,3000),instagram:String(customer.instagram||"").slice(0,150),twitter:String(customer.twitter||"").slice(0,150),facebook:String(customer.facebook||"").slice(0,150),otherSocial:String(customer.otherSocial||"").slice(0,200),logoData:String(customer.logoData||"").slice(0,1500000),logoName:String(customer.logoName||"").slice(0,120)},service,addons,subtotal,charges,discountPercent:dp,paymentId:razorpay_payment_id,orderId:razorpay_order_id,paymentMethod:payment.method};
  const pdf=await makePdf(info); const resendKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL,to=process.env.CONTACT_TO_EMAIL||"alertaiq6@gmail.com";
  if(!resendKey||!from) return json({ok:true,emailSent:false,receipt:info},200);
  const attachments=[{filename:`SRIJAN-Receipt-${info.receipt}.pdf`,content:pdf.toString("base64")}];
  if(info.customer.logoData && info.customer.logoData.startsWith("data:image/")){ const parts=info.customer.logoData.split(","); const mime=(parts[0].match(/data:(.*?);/)||[])[1]||"image/png"; const ext=mime.includes("jpeg")||mime.includes("jpg")?"jpg":mime.includes("webp")?"webp":"png"; attachments.push({filename:info.customer.logoName||`customer-logo.${ext}`,content:parts[1]}); }
  const rows=[`<b>Service:</b> ${escapeHtml(info.service.name)}`,`<b>Business / Project:</b> ${escapeHtml(info.customer.business||"Not provided")}`,`<b>Email:</b> ${escapeHtml(info.customer.email)}`,`<b>Phone:</b> ${escapeHtml(info.customer.phone)}`,`<b>Requirements:</b> ${escapeHtml(info.customer.notes||"Not provided")}`,`<b>Instagram:</b> ${escapeHtml(info.customer.instagram||"Not provided")}`,`<b>Twitter / X:</b> ${escapeHtml(info.customer.twitter||"Not provided")}`,`<b>Facebook / Meta:</b> ${escapeHtml(info.customer.facebook||"Not provided")}`,`<b>Other social:</b> ${escapeHtml(info.customer.otherSocial||"Not provided")}`,`<b>Logo:</b> ${escapeHtml(info.customer.logoName||"Not provided")}`,`<b>Subtotal:</b> ₹${info.subtotal.toLocaleString("en-IN")}`,`<b>GST:</b> ₹${info.charges.gst.toFixed(2)}`,`<b>Gateway fee:</b> ₹${info.charges.gatewayFee}`,`<b>Processing fee:</b> ₹${info.charges.processingFee}`,`<b>Lucky discount:</b> -₹${info.charges.discount.toFixed(2)}`,`<b>Total paid:</b> ₹${info.charges.total.toFixed(2)}`,`<b>Payment ID:</b> ${escapeHtml(info.paymentId)}`,`<b>Order ID:</b> ${escapeHtml(info.orderId)}`].join("<br>");
  const html=`<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.65;max-width:700px"><div style="padding:24px;background:#070b14;color:white;border-radius:14px"><div style="font-size:30px;font-weight:800;color:#fbbf24">SRIJAN.</div><div style="color:#94a3b8">Create • Connect • Grow</div></div><h2>Payment successful</h2><p>Thank you, ${escapeHtml(info.customer.name)}. Your payment has been verified and captured successfully.</p><p>${rows}</p><p>The professional PDF receipt is attached. Please keep it for your records.</p><p>We have received your project details. Our team can proceed after confirming the submitted requirements/assets.</p><p>Official communication: <a href="mailto:alertaiq6@gmail.com">alertaiq6@gmail.com</a></p></div>`;
  const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${resendKey}`},body:JSON.stringify({from,to:[to,info.customer.email],reply_to:to,subject:`SRIJAN payment receipt — ${info.receipt}`,html,attachments})});
  const mailData=await mail.json(); if(!mail.ok){console.error("Resend receipt error",mailData);return json({ok:true,emailSent:false,receipt:info},200)}
  return json({ok:true,emailSent:true,receipt:info,receiptEmailId:mailData.id});
 }catch(e){console.error("verify-payment",e);return json({error:"Payment was received but receipt processing needs attention. Please contact alertaiq6@gmail.com."},500)}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS"}})}
