import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signup,validateSignup,signupTagIds} from './signup.mjs';

const input={email:'  TEST@example.com ',consent:true,freebie:'first-layer-checklist',category:'hobbies',source:'website'};

test('rejects invalid consent and resource before provider calls',async()=>{
  assert.equal(validateSignup({...input,consent:false}).error,'consent_required');
  assert.equal(validateSignup({...input,freebie:'other'}).error,'resource_unavailable');
  assert.equal(validateSignup({...input,email:'bad'}).error,'invalid_email');
});

test('suppressed contact is never tagged or recorded',async()=>{
  let touched=false;
  const result=await signup(input,{lookup:async()=>({id:7,unsubscribed:true}),create:async()=>{touched=true;},addTag:async()=>{touched=true;},readContact:async()=>{touched=true;},record:async()=>{touched=true;}});
  assert.deepEqual(result,{status:202,code:'accepted'});
  assert.equal(touched,false);
});

test('duplicate signup never reapplies delivery tag',async()=>{
  let applied=0;
  const contact={id:7,tags:[signupTagIds.segment,signupTagIds.request]};
  const result=await signup(input,{lookup:async()=>contact,create:async()=>{throw Error('duplicate create');},addTag:async()=>{applied++;},readContact:async()=>contact,record:async()=>{}});
  assert.equal(result.status,202);
  assert.equal(applied,0);
});

test('new contact requires both tags to read back',async()=>{
  const tags=[];
  const provider={lookup:async()=>null,create:async()=>({id:9,tags:[]}),addTag:async(_id,tag)=>{tags.push(tag);},readContact:async()=>({id:9,tags:[...tags]}),record:async()=>{}};
  const result=await signup(input,provider);
  assert.equal(result.status,202);
  assert.deepEqual(tags,[signupTagIds.segment,signupTagIds.request]);
});

test('tagging failure prevents success',async()=>{
  const provider={lookup:async()=>({id:9,tags:[]}),create:async()=>{},addTag:async()=>{},readContact:async()=>({id:9,tags:[]}),record:async()=>{}};
  await assert.rejects(signup(input,provider),/tag readback failed/);
});

test('consent storage failure stops contact creation and tagging',async()=>{
  let mutated=false;
  const provider={lookup:async()=>null,create:async()=>{mutated=true;},addTag:async()=>{mutated=true;},readContact:async()=>{mutated=true;},record:async()=>{throw Error('storage unavailable');}};
  await assert.rejects(signup(input,provider),/storage unavailable/);
  assert.equal(mutated,false);
});
