const $=(id)=>document.getElementById(id);
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money=(n)=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
window.SRIJAN={$,esc,money};

document.addEventListener('DOMContentLoaded',()=>{
  const menu=$('menu'),mobile=$('mobile');
  menu?.addEventListener('click',()=>mobile?.classList.toggle('open'));
  const page=location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===page));
  document.querySelectorAll('[data-year]').forEach(x=>x.textContent=new Date().getFullYear());
});

export function toast(message,type='success'){
  let t=$('toast'); if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}
  t.textContent=message;t.className=`toast show ${type}`;clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.className='toast',4200);
}
