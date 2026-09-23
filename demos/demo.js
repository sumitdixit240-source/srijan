document.querySelectorAll("[data-year]").forEach(x=>x.textContent=new Date().getFullYear());
document.querySelectorAll("form[data-demo]").forEach(f=>f.addEventListener("submit",e=>{e.preventDefault();const b=f.querySelector("button");const old=b.textContent;b.textContent="Request received ✓";b.disabled=true;setTimeout(()=>{b.textContent=old;b.disabled=false;},2500)}));
