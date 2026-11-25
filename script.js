document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.swatch').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true');
  document.getElementById('color-name').textContent=b.dataset.color;
  const img=document.getElementById('pot-color');
  if(img&&b.dataset.img&&!img.src.endsWith(b.dataset.img)){
    img.style.opacity='0';
    setTimeout(()=>{img.src=b.dataset.img;img.alt='Maceta BotanIA en color '+b.dataset.color.toLowerCase();img.style.opacity='1';},180);
  }
}));
['maceta-blanco.webp','maceta-terracota.webp'].forEach(src=>{const i=new Image();i.src=src;});
const f=document.querySelector('footer button');
f&&f.addEventListener('click',()=>{const i=document.getElementById('mail');
  if(i.checkValidity()&&i.value){f.textContent='¡Listo!';i.value='';}else{i.reportValidity();}});
(function(){
  const cfg = window.BOTANIA_APP || {};
  const ios = document.getElementById('btn-ios'), and = document.getElementById('btn-android');
  if (ios && cfg.ios) ios.href = cfg.ios;
  if (and && cfg.android) and.href = cfg.android;
  const box = document.getElementById('qr');
  if (box && window.qrcode) {
    const q = qrcode(0, 'M'); q.addData(location.origin + '/app'); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
})();
