const FALLBACK_SERVICES={
 free_demo:{name:'Free Demo',price:1,delivery:'Same day',description:'One small demo section or simple edit.'},
 quick_start:{name:'Quick Start',price:99,delivery:'Same day',description:'1 small website section / simple edit.'},
 mini_web:{name:'Mini Web',price:499,delivery:'1 day',description:'1-page basic website.'},
 starter:{name:'Starter',price:1499,delivery:'1–2 days',description:'1-page polished website.'},
 business:{name:'Business',price:2999,delivery:'2–3 days',description:'Up to 3 pages + WhatsApp.'},
 growth:{name:'Growth',price:4999,delivery:'3–5 days',description:'Up to 5 pages + forms + Maps.'},
 professional:{name:'Professional',price:7999,delivery:'5–7 days',description:'Up to 8 pages + premium UI + basic SEO.'},
 ai_smart:{name:'AI Smart',price:10999,delivery:'7–10 days',description:'Up to 10 pages + one practical AI feature.'},
 premium:{name:'Premium',price:14999,delivery:'10–14 days',description:'Up to 12 pages + AI + integrations.'}
};
const FALLBACK_ADDONS={
 extra_page:{name:'Extra Page',price:499,delivery:'1 day'},extra_images_3:{name:'3 Extra Images',price:299,delivery:'Same day'},extra_images_10:{name:'10 Extra Images',price:599,delivery:'Same day–1 day'},gallery:{name:'Gallery Section',price:799,delivery:'1 day'},premium_ui:{name:'Premium UI Section',price:999,delivery:'1 day'},animation:{name:'Extra Animation',price:499,delivery:'Same day–1 day'},whatsapp:{name:'WhatsApp Integration',price:499,delivery:'Same day'},maps:{name:'Google Maps',price:299,delivery:'Same day'},click_call:{name:'Click-to-Call',price:299,delivery:'Same day'},enquiry_form:{name:'Enquiry Form',price:999,delivery:'1–2 days'},email_notification:{name:'Email Notification',price:999,delivery:'1–2 days'},seo:{name:'Basic SEO',price:1499,delivery:'1–2 days'},mobile:{name:'Mobile Optimization',price:999,delivery:'1 day'},performance:{name:'Performance Optimization',price:999,delivery:'1–2 days'},api:{name:'Basic API Integration',price:1499,delivery:'2–3 days'},ai_faq:{name:'AI FAQ',price:1499,delivery:'1–2 days'},ai_chatbot:{name:'AI Chatbot',price:2999,delivery:'2–4 days'},ai_content:{name:'AI Content Setup',price:999,delivery:'1 day'},python:{name:'Simple Python Automation',price:1499,delivery:'2–3 days'},excel:{name:'Excel/CSV Automation',price:999,delivery:'1–2 days'},vercel:{name:'Vercel Deployment',price:699,delivery:'Same day'},hosting:{name:'Domain/Hosting Setup',price:699,delivery:'Same day–1 day'},revision:{name:'Extra Revision Round',price:499,delivery:'1 day'},maintenance:{name:'Monthly Maintenance',price:999,delivery:'Ongoing'},emergency_support:{name:'Emergency WhatsApp Support',price:150,delivery:'Immediate'}
};
export async function getCatalog(){
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return{SERVICES:FALLBACK_SERVICES,ADDONS:FALLBACK_ADDONS};
  try{
    const h={apikey:key,Authorization:`Bearer ${key}`};
    const [sr,ar]=await Promise.all([
      fetch(`${url}/rest/v1/services?select=slug,name,price,delivery,description,status&status=eq.published`,{headers:h}),
      fetch(`${url}/rest/v1/addons?select=slug,name,price,delivery,status&status=eq.published`,{headers:h})
    ]);
    if(!sr.ok||!ar.ok)throw new Error('Catalog read failed');
    const services=await sr.json(),addons=await ar.json();
    const sm=Object.fromEntries(services.map(x=>[x.slug,{name:x.name,price:Number(x.price),delivery:x.delivery,description:x.description}]));
    const am=Object.fromEntries(addons.map(x=>[x.slug,{name:x.name,price:Number(x.price),delivery:x.delivery}]));
    return{SERVICES:Object.keys(sm).length?sm:FALLBACK_SERVICES,ADDONS:Object.keys(am).length?am:FALLBACK_ADDONS};
  }catch(e){console.error('catalog',e);return{SERVICES:FALLBACK_SERVICES,ADDONS:FALLBACK_ADDONS};}
}
export async function calculate(serviceIds=[],addonIds=[]){
  const {SERVICES,ADDONS}=await getCatalog();
  const ids=[...new Set(Array.isArray(serviceIds)?serviceIds:[])].filter(id=>SERVICES[id]).slice(0,2);
  if(!ids.length)throw new Error('Please select at least one service.');
  const services=ids.map(id=>SERVICES[id]);
  const addons=[...new Set(Array.isArray(addonIds)?addonIds:[])].map(id=>ADDONS[id]).filter(Boolean);
  const subtotal=services.reduce((sum,s)=>sum+s.price,0)+addons.reduce((sum,a)=>sum+a.price,0);
  return{services,addons,subtotal,serviceIds:ids};
}
export function calculateCharges(subtotal,discountPercent){
  const gst=Math.round(subtotal*0.18*100)/100,gatewayFee=3,platformFee=1;
  const beforeDiscount=Math.round((subtotal+gst+gatewayFee+platformFee)*100)/100;
  const discount=Math.round(beforeDiscount*(discountPercent/100)*100)/100;
  const total=Math.max(1,Math.round((beforeDiscount-discount)*100)/100);
  return{gst,gatewayFee,platformFee,beforeDiscount,discount,total};
}
