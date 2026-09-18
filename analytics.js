/* First-party, cookieless event collection. No visitor IDs, IPs or raw query strings. */
'use strict';
(async () => {
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  let config;
  try { config = await (await fetch('/site-config.json')).json(); } catch { return; }
  if (!config.analytics?.enabled) return;
  const catalog = await fetch('/products.json').then(r=>r.json()).catch(()=>({products:[]}));
  const query = new URLSearchParams(location.search);
  const label = v => typeof v === 'string' && /^[a-zA-Z0-9 _.:/-]{1,100}$/.test(v) ? v : null;
  const attribution = Object.fromEntries(['utm_source','utm_medium','utm_campaign','campaign_id'].map(k=>[k,label(query.get(k))]));
  let referrer = null;
  try { referrer = new URL(document.referrer).hostname; } catch {}
  const base = {...attribution, campaign: attribution.utm_campaign, traffic_source:attribution.utm_source || referrer || 'direct', landing_page:location.pathname, is_test:query.get('factory_test')==='1'};
  const send = (event_type, id=null, channel=null) => {
    const p = catalog.products.find(p=>(p.product_id || p.id)===id || p.id===id);
    const data = {...base,event_id:crypto.randomUUID(),event_type,channel,product_id:p?.product_id || id,product_family_id:p?.product_family_id || null,opportunity_id:p?.opportunity_id || null,product_type:p?.productType || null};
    fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true}).catch(()=>{});
  };
  send('page_view');
  if (['pinterest','instagram','facebook','tiktok','youtube'].some(s=>base.traffic_source?.includes(s))) send('social_referral');
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[data-outbound]'); if(!a)return;
    const type={amazon:'outbound_amazon',etsy:'outbound_etsy',digital:'digital_click'}[a.dataset.outbound];
    if(type)send(type,a.dataset.productId,a.dataset.outbound);
  });
  const seen=new Set();
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    const id=entry.target.dataset.productId;
    if(entry.isIntersecting && !seen.has(id)){seen.add(id);send('product_view',id);}
  }),{threshold:.5});
  const watch=()=>document.querySelectorAll('.product-card[data-product-id]').forEach(card=>observer.observe(card));
  const grid=document.getElementById('product-grid');if(grid)new MutationObserver(watch).observe(grid,{childList:true});watch();
})();
