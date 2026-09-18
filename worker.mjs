// Extends the existing lane-and-legacy Worker. No replacement Worker.
export const types = new Set(['page_view','product_view','outbound_amazon','outbound_etsy','digital_click','social_referral']);
export function cleanEvent(input) {
  if (!input || !types.has(input.event_type) || !/^[a-zA-Z0-9-]{8,80}$/.test(input.event_id || '')) throw new Error('invalid event');
  const event = {event_id:input.event_id,event_type:input.event_type,is_test:input.is_test===true,observed_at:new Date().toISOString()};
  for(const k of ['product_id','product_family_id','opportunity_id','product_type','campaign_id','campaign','traffic_source','utm_source','utm_medium','utm_campaign','channel']) {
    const v=input[k];event[k]=typeof v==='string' && /^[a-zA-Z0-9 _.:/-]{1,100}$/.test(v)?v:null;
  }
  event.landing_page=typeof input.landing_page==='string' && /^\/[a-zA-Z0-9/_-]*$/.test(input.landing_page)?input.landing_page.slice(0,256):'/';
  return event;
}
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
export default {
 async fetch(request, env) {
  const url=new URL(request.url);
  if(url.hostname==='www.laneandlegacy.com') {url.hostname='laneandlegacy.com';url.protocol='https:';return Response.redirect(url.toString(),301);}
  if(url.pathname==='/api/events') {
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    if(request.headers.get('Origin')!==(env.ALLOWED_ORIGIN || 'https://laneandlegacy.com'))return new Response('Forbidden',{status:403});
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return new Response('Unsupported type',{status:415});
    if(Number(request.headers.get('Content-Length')||0)>4096)return new Response('Too large',{status:413});
    if(!env.ANALYTICS_DB)return Response.json({status:'unavailable'},{status:503,headers});
    let event;
    try {const body=await request.text();if(body.length>4096)return new Response('Too large',{status:413});event=cleanEvent(JSON.parse(body));}catch{return new Response('Invalid event',{status:400});}
    try {
      await env.ANALYTICS_DB.prepare('INSERT OR IGNORE INTO events(event_id,observed_at,event_type,product_id,campaign_id,is_test,record_json) VALUES(?,?,?,?,?,?,?)').bind(event.event_id,event.observed_at,event.event_type,event.product_id,event.campaign_id,event.is_test?1:0,JSON.stringify(event)).run();
      return Response.json({accepted:true,event_id:event.event_id},{status:202,headers});
    }catch{return Response.json({status:'unavailable'},{status:503,headers});}
  }
  if(url.pathname==='/api/health')return Response.json({collector:env.ANALYTICS_DB?'configured':'unconfigured',version:'2026-09-18-v1'},{headers});
  return env.ASSETS.fetch(request);
 }
};
