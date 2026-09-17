
async function loadProducts(){
  const target=document.getElementById('product-grid');
  try{
    const r=await fetch('products.json',{cache:'no-store'});
    const data=await r.json();
    const etsyShop=document.getElementById('etsy-shop');
    if(etsyShop && data.etsyShopUrl) etsyShop.href=data.etsyShopUrl;
    const facebookLink=document.getElementById('facebook-link');
if(facebookLink && data.facebookUrl) facebookLink.href=data.facebookUrl;
const pinterestLink=document.getElementById('pinterest-link');
if(pinterestLink && data.pinterestUrl) pinterestLink.href=data.pinterestUrl;
    const instagramLink=document.getElementById('instagram-link');
if(instagramLink && data.instagramUrl) instagramLink.href=data.instagramUrl;
const tiktokLink=document.getElementById('tiktok-link');
if(tiktokLink && data.tiktokUrl) tiktokLink.href=data.tiktokUrl;
    const products=(data.featuredProducts||[]).filter(p=>p.featured);
    target.innerHTML=products.map(p=>`
      <article class="card">
        <div class="art">${p.image ? `<img src="${encodeURI(p.image)}" alt="${escapeHTML(p.name)} cover" loading="lazy">` : escapeHTML(p.name)}</div>
        <div class="card-body">
          <div class="tag">${escapeHTML(p.category||'Lane & Legacy')}</div>
          <h3>${escapeHTML(p.name)}</h3>
          <p>${escapeHTML(p.description||'')}</p>
          <div class="card-actions">
            ${p.etsy_url && p.etsy_url !== '#' ? `<a class="etsy" href="${safeURL(p.etsy_url)}" target="_blank" rel="noopener">Digital / Etsy</a>` : ''}
            ${p.amazon_url && p.amazon_url !== '#' ? `<a class="amazon" href="${safeURL(p.amazon_url)}" target="_blank" rel="noopener">Print / Amazon</a>` : ''}
          </div>
        </div>
      </article>`).join('');
  }catch(e){target.innerHTML='<p>Products are being updated. Please check back soon.</p>'}
}
function escapeHTML(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeURL(v){if(!v||v==='#')return '#';try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}}
loadProducts();
// Mobile navigation
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('header .links');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}
