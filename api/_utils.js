export const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export function originAllowed(request){
  const configured=process.env.APP_ORIGIN;
  if(!configured)return true; // Vercel preview/local environments can be enabled until APP_ORIGIN is set in production.
  const origin=request.headers.get('origin');
  return !origin || origin===configured;
}
export async function readJson(request,maxBytes=120000){
  const len=Number(request.headers.get('content-length')||0);if(len&&len>maxBytes)throw new Error('Request is too large.');
  const text=await request.text();if(text.length>maxBytes)throw new Error('Request is too large.');return JSON.parse(text||'{}');
}
export const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function clean(value,max=1000){return String(value??'').trim().slice(0,max)}
export function methodGuard(request,method='POST'){if(request.method!==method)return false;return true}
export function corsHeaders(request){return process.env.APP_ORIGIN?{'Access-Control-Allow-Origin':process.env.APP_ORIGIN,'Vary':'Origin'}:{}}
