import test from 'node:test';import assert from 'node:assert/strict';import worker,{cleanEvent} from '../worker.mjs';
test('sanitizes events, rejects invented conversions',()=>{
 const e=cleanEvent({event_id:'test-12345',event_type:'page_view',ip:'secret',email:'secret',landing_page:'/?email=secret'});
 assert.equal(e.landing_page,'/');assert.equal(e.ip,undefined);assert.equal(e.email,undefined);
 assert.throws(()=>cleanEvent({event_id:'test-12345',event_type:'conversion'}));
});
test('www redirect preserves full path and campaign query',async()=>{
 const r=await worker.fetch(new Request('https://www.laneandlegacy.com/tools?utm_source=pin'),{});
 assert.equal(r.status,301);assert.equal(r.headers.get('Location'),'https://laneandlegacy.com/tools?utm_source=pin');
});
test('fails closed without collector and refuses foreign origin',async()=>{
 const r=new Request('https://laneandlegacy.com/api/events',{method:'POST',headers:{Origin:'https://laneandlegacy.com','Content-Type':'application/json'},body:'{}'});
 assert.equal((await worker.fetch(r,{})).status,503);
 assert.equal((await worker.fetch(new Request('https://laneandlegacy.com/api/events',{method:'POST'}),{})).status,403);
});
test('acknowledges only persisted event; storage failure is not PASS',async()=>{
 let rows=[];const request=()=>new Request('https://laneandlegacy.com/api/events',{method:'POST',headers:{Origin:'https://laneandlegacy.com','Content-Type':'application/json'},body:JSON.stringify({event_id:'test-12345',event_type:'outbound_etsy',is_test:true})});
 const env={ANALYTICS_DB:{prepare:()=>({bind:(...v)=>({run:async()=>rows.push(v)})})}};
 assert.equal((await worker.fetch(request(),env)).status,202);assert.equal(rows[0][5],1);
 env.ANALYTICS_DB.prepare=()=>{throw Error('offline')};assert.equal((await worker.fetch(request(),env)).status,503);
});
