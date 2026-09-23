import { json,readJson,emailRegex,clean } from './_utils.js';
export async function POST(request){
  try{
    const body=await readJson(request,30000);
    if(body.website)return json({ok:true});
    const name=clean(body.name,100),email=clean(body.email,200),message=clean(body.message,5000);
    if(!name||!email||!message)return json({error:'Name, email and message are required.'},400);
    if(!emailRegex.test(email))return json({error:'Please enter a valid email address.'},400);
    const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL,to=process.env.CONTACT_TO_EMAIL||process.env.ADMIN_NOTIFICATION_EMAIL;
    if(!apiKey||!from||!to)return json({error:'Email service is not configured yet.'},500);
    const safe=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const html=`<div style="font-family:Arial,sans-serif;max-width:720px;color:#172033;line-height:1.6"><div style="background:#08101d;padding:24px;border-radius:16px;color:#fff"><div style="font-size:30px;font-weight:800;color:#fbbf24">SRIJAN.</div><div style="color:#94a3b8">GENERAL CONTACT MESSAGE</div></div><h2>New message from the SRIJAN website</h2><p><b>Name:</b> ${safe(name)}<br><b>Email:</b> ${safe(email)}</p><h3>Message</h3><div style="white-space:pre-wrap;background:#f3f4f6;padding:14px;border-radius:8px">${safe(message)}</div><p>Reply directly to the customer's email to continue the conversation.</p></div>`;
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({from,to,reply_to:email,subject:`SRIJAN — Website message from ${name}`,html})});
    const data=await r.json();if(!r.ok){console.error('Resend contact error',data);return json({error:'Email delivery failed. Please try again.'},502)}
    return json({ok:true,id:data.id});
  }catch(e){console.error('contact',e);return json({error:'Invalid request. Please try again.'},400)}
}
export async function OPTIONS(){return new Response(null,{status:204})}
