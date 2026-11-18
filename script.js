document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.swatch').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true');
  document.getElementById('color-name').textContent=b.dataset.color;
}));
const f=document.querySelector('footer button');
f&&f.addEventListener('click',()=>{const i=document.getElementById('mail');
  if(i.checkValidity()&&i.value){f.textContent='¡Listo!';i.value='';}else{i.reportValidity();}});
