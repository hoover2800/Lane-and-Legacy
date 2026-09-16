
async function loadProducts(){
  const target=document.getElementById('product-grid');
  try{
    const r=await fetch('products.json',{cache:'no-store'});
    const data=await r.json();
    const products=(data.featuredProducts||[]).filter(p=>p.featured);
    target.innerHTML=products.map(p=>`
      <article class="card">
        <div class="art">${p.image ? `<img src="${encodeURI(p.image)}" alt="${escapeHTML(p.name)} cover" loading="lazy">` : escapeHTML(p.name)}</div>
        <div class="card-body">
          <div class="tag">${escapeHTML(p.category||'Lane & Legacy')}</div>
          <h3>${escapeHTML(p.name)}</h3>
          <p>${escapeHTML(p.description||'')}</p>
          <div class="card-actions">
            <a class="etsy" href="${safeURL(p.etsy_url)}" ${p.etsy_url==='#'?'':'target="_blank" rel="noopener"'}>Digital / Etsy</a>
            <a class="amazon" href="${safeURL(p.amazon_url)}" ${p.amazon_url==='#'?'':'target="_blank" rel="noopener"'}>Print / Amazon</a>
          </div>
        </div>
      </article>`).join('');
  }catch(e){target.innerHTML='<p>Products are being updated. Please check back soon.</p>'}
}
function escapeHTML(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeURL(v){if(!v||v==='#')return '#';try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}}
loadProducts();
