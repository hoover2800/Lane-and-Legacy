// Extends the existing lane-and-legacy Worker. No replacement Worker.
import {signup} from './signup.mjs';
export const types = new Set(['page_view','product_view','outbound_amazon','outbound_etsy','digital_click','social_referral','signup_form_view','signup_start','signup_success','lead_magnet_download','email_cta_click']);
export function cleanEvent(input) {
  if (!input || !types.has(input.event_type) || !/^[a-zA-Z0-9-]{8,80}$/.test(input.event_id || '')) throw new Error('invalid event');
  const event = {event_id:input.event_id,event_type:input.event_type,is_test:input.is_test===true,observed_at:new Date().toISOString()};
  for(const k of ['product_id','product_family_id','opportunity_id','product_type','campaign_id','campaign','traffic_source','utm_source','utm_medium','utm_campaign','channel','freebie_id','segment_id']) {
    const v=input[k];event[k]=typeof v==='string' && /^[a-zA-Z0-9 _.:/-]{1,100}$/.test(v)?v:null;
  }
  event.landing_page=typeof input.landing_page==='string' && /^\/[a-zA-Z0-9/_-]*$/.test(input.landing_page)?input.landing_page.slice(0,256):'/';
  return event;
}
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};

async function systeme(env,path,{method='GET',body}={}) {
  const response=await fetch(`https://api.systeme.io/api${path}`,{
    method,headers:{'X-API-Key':env.SYSTEME_API_KEY,'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw new Error(`Systeme API ${response.status}`);
  return response.status===204?{}:response.json();
}

function signupProvider(env) {
  const lookup=async email=>{
    const page=await systeme(env,`/contacts?email=${encodeURIComponent(email)}&limit=10`);
    if(!Array.isArray(page.items)||page.items.length>1)throw new Error('ambiguous contact lookup');
    const contact=page.items[0];
    if(!contact)return null;
    const base=`/contacts?email=${encodeURIComponent(email)}&limit=10`;
    const [unsubscribed,bounced,needsConfirmation]=await Promise.all(['unsubscribed','bounced','needsConfirmation'].map(flag=>systeme(env,`${base}&${flag}=true`)));
    if([unsubscribed,bounced,needsConfirmation].some(result=>!Array.isArray(result.items)||result.items.length>1))throw new Error('suppression lookup unavailable');
    return {...contact,unsubscribed:contact.unsubscribed===true||unsubscribed.items.length===1,bounced:contact.bounced===true||bounced.items.length===1,needsConfirmation:contact.needsConfirmation===true||needsConfirmation.items.length===1};
  };
  return {
    lookup,
    create:async email=>{
      try{return await systeme(env,'/contacts',{method:'POST',body:{email}});}
      catch(error){if(String(error.message)!=='Systeme API 422')throw error;const existing=await lookup(email);if(!existing)throw error;return existing;}
    },
    readContact:id=>systeme(env,`/contacts/${encodeURIComponent(id)}`),
    addTag:(id,tagId)=>systeme(env,`/contacts/${encodeURIComponent(id)}/tags`,{method:'POST',body:{tagId}}),
    record:async({email,source,freebie,segment})=>{
      const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SIGNUP_HASH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(email));
      const hash=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
      await env.LEADS_DB.prepare('INSERT INTO email_signups(email_hash,source,freebie,segment,consent_at) VALUES(?,?,?,?,?) ON CONFLICT(email_hash,freebie) DO NOTHING')
        .bind(hash,source,freebie,segment,new Date().toISOString()).run();
    }
  };
}

async function handleSignup(request,env) {
  if(env.EMAIL_SIGNUP_ENABLED!=='true')return Response.json({status:'unavailable'},{status:503,headers});
  if(!env.SYSTEME_API_KEY||!env.SIGNUP_HASH_SECRET||!env.LEADS_DB||!env.TURNSTILE_SECRET)return Response.json({status:'unavailable'},{status:503,headers});
  if(request.headers.get('Origin')!==(env.ALLOWED_ORIGIN||'https://laneandlegacy.com'))return Response.json({status:'forbidden'},{status:403,headers});
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return Response.json({status:'invalid_request'},{status:415,headers});
  if(Number(request.headers.get('Content-Length')||0)>2048)return Response.json({status:'invalid_request'},{status:413,headers});
  let input;
  try{const raw=await request.text();if(raw.length>2048)throw Error('large');input=JSON.parse(raw);}catch{return Response.json({status:'invalid_request'},{status:400,headers});}
  const token=typeof input.turnstile==='string'?input.turnstile:'';
  if(!token)return Response.json({status:'invalid_request'},{status:400,headers});
  try {
    const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token}),signal:AbortSignal.timeout(8000)});
    const verdict=await check.json();
    if(!check.ok||verdict.success!==true||verdict.hostname!=='laneandlegacy.com')return Response.json({status:'invalid_request'},{status:400,headers});
    const result=await signup(input,signupProvider(env));
    return Response.json({status:result.code},{status:result.status,headers});
  } catch {return Response.json({status:'retry_later'},{status:503,headers});}
}

export default {
 async fetch(request, env) {
  const url=new URL(request.url);
  if(url.hostname==='www.laneandlegacy.com') {url.hostname='laneandlegacy.com';url.protocol='https:';return Response.redirect(url.toString(),301);}
  if(url.pathname==='/api/signup') {
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    return handleSignup(request,env);
  }
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
  if(url.pathname==='/freebies/first-layer-checklist.pdf') {
    const asset=await env.ASSETS.fetch(request);
    if(asset.ok&&env.ANALYTICS_DB) {
      const event=cleanEvent({event_id:crypto.randomUUID(),event_type:'lead_magnet_download',freebie_id:'first-layer-checklist',segment_id:'makers_hobbies',landing_page:url.pathname});
      try {await env.ANALYTICS_DB.prepare('INSERT OR IGNORE INTO events(event_id,observed_at,event_type,product_id,campaign_id,is_test,record_json) VALUES(?,?,?,?,?,?,?)').bind(event.event_id,event.observed_at,event.event_type,null,null,0,JSON.stringify(event)).run();} catch {}
    }
    return asset;
  }
  return env.ASSETS.fetch(request);
 }
};
