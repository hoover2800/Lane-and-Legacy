import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

test('signup endpoint fails closed while release flag is off',async()=>{
  const response=await worker.fetch(new Request('https://laneandlegacy.com/api/signup',{method:'POST',headers:{Origin:'https://laneandlegacy.com','Content-Type':'application/json'},body:'{}'}),{});
  assert.equal(response.status,503);
});

test('freebie remains available if aggregate analytics fails',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('pdf bytes',{status:200,headers:{'Content-Type':'application/pdf'}})},ANALYTICS_DB:{prepare:()=>{throw Error('db down');}}};
  const response=await worker.fetch(new Request('https://laneandlegacy.com/freebies/first-layer-checklist.pdf'),env);
  assert.equal(response.status,200);
  assert.equal(await response.text(),'pdf bytes');
});

test('gated signup records consent, creates one contact, applies both tags, and returns no PII',async()=>{
  const original=globalThis.fetch;
  const tags=[];const calls=[];let created=false;let stored=false;
  globalThis.fetch=async(url,options={})=>{
    const path=String(url);
    calls.push({path,method:options.method||'GET'});
    if(path.includes('siteverify'))return Response.json({success:true,hostname:'laneandlegacy.com'});
    if(path.includes('/api/contacts?'))return Response.json({items:/[?&](unsubscribed|bounced|needsConfirmation)=true/.test(path)?[]:(created?[{id:11,tags:[...tags]}]:[]),hasMore:false});
    if(path.endsWith('/api/contacts')&&options.method==='POST'){created=true;return Response.json({id:11,tags:[]},{status:201});}
    if(path.endsWith('/api/contacts/11/tags')){tags.push(JSON.parse(options.body).tagId);return Response.json({},{status:201});}
    if(path.endsWith('/api/contacts/11'))return Response.json({id:11,tags:[...tags]});
    throw Error('unexpected provider call');
  };
  try{
    const env={EMAIL_SIGNUP_ENABLED:'true',SYSTEME_API_KEY:'test-only',SIGNUP_HASH_SECRET:'test-only-secret',TURNSTILE_SECRET:'test-only',LEADS_DB:{prepare:()=>({bind:()=>({run:async()=>{stored=true;}})})}};
    const request=new Request('https://laneandlegacy.com/api/signup',{method:'POST',headers:{Origin:'https://laneandlegacy.com','Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com',consent:true,category:'hobbies',freebie:'first-layer-checklist',source:'website',turnstile:'test-token'})});
    const response=await worker.fetch(request,env);
    assert.equal(response.status,202);
    assert.deepEqual(await response.json(),{status:'accepted'});
    assert.equal(stored,true);
    assert.deepEqual(tags,[2185264,2185591]);
    assert.equal(calls.filter(c=>c.path.endsWith('/api/contacts')&&c.method==='POST').length,1);
  }finally{globalThis.fetch=original;}
});
