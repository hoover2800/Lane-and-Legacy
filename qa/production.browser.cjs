const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const origin=process.env.QA_ORIGIN||'https://laneandlegacy.com';
 const live=origin.startsWith('https:');
 const out=process.env.QA_OUTPUT||'qa';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext(); const page=await context.newPage();
 const errors=[],failures=[],events=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url().startsWith(origin)&&r.status()>=400)failures.push({url:r.url(),status:r.status()});if(r.url().endsWith('/api/events'))events.push({status:r.status(),body:r.request().postDataJSON()});});
 if(!live)await context.route('**/api/events',r=>r.fulfill({status:202,json:{ok:true}}));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  const response=await page.goto(origin+'/?factory_test=1',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
  await page.waitForSelector('.product-card');
  assert.equal(await page.locator('.product-card').count(),3);
  const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');assert.equal(canonical,'https://laneandlegacy.com/');
  assert.equal(await page.locator('#newsletter-form button').isDisabled(),true);
  await page.locator('#view-all').click();assert.equal(await page.locator('.product-card').count(),3);
  for(const [category,count] of Object.entries({home:1,education:1,wellness:0,finance:0,travel:0,work:0,hobbies:1,more:0})){
   await page.locator(`#category-list [data-category="${category}"]`).click();assert.equal(await page.locator('.product-card').count(),count);
  }
  await page.locator('#reset-filters').click();
  await page.locator('#product-search').fill('teacher');assert.equal(await page.locator('.product-card').count(),1);
  await page.locator('#product-search').fill('zz-no-match');assert.equal(await page.locator('.product-card').count(),0);
  await page.locator('#product-search').fill('');assert.equal(await page.locator('.product-card').count(),3);
  await page.locator('#products').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#product-grid img')).every(i=>i.complete));
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),links:[...document.querySelectorAll('.product-card a')].map(a=>a.href),insecure:[...document.querySelectorAll('[src]')].map(a=>a.src).filter(u=>u.startsWith('http:')&&!u.includes('127.0.0.1'))}));
  assert.equal(state.overflow,false);assert.deepEqual(state.broken,[]);assert.deepEqual(state.insecure,[]);
  assert.equal(state.links.length,3);for(const link of state.links)assert.equal(new URL(link).hostname,'www.amazon.com');
  assert.equal(await page.locator('#amazon-shop').getAttribute('aria-disabled'),'true');
  await page.screenshot({path:`${out}/production-${width}.png`,fullPage:true});
  results.push({width,status:'PASS',canonical,...state,tls:await response.securityDetails()});
 }
 const catalog=await context.request.get(origin+'/products.json');assert.equal(catalog.status(),200);const bytes=await catalog.body();assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync('products.json')).digest('hex'));
 const data=JSON.parse(bytes);assert.equal(data.products.filter(p=>p.active).length,3);assert.equal(data.products.filter(p=>!p.active).length,4);assert.ok(data.products.every(p=>!p.etsyUrl));
 for(const image of new Set(data.products.map(p=>p.image))){const r=await context.request.get(origin+'/'+encodeURI(image));assert.equal(r.status(),200);assert.equal(crypto.createHash('sha256').update(await r.body()).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex'));}
 let redirects=[];
 if(live){for(const url of ['https://www.laneandlegacy.com/?factory_test=1','http://laneandlegacy.com/?factory_test=1']){const r=await context.request.get(url,{maxRedirects:0});assert.ok([301,302,307,308].includes(r.status()));assert.equal(r.headers().location,'https://laneandlegacy.com/?factory_test=1');redirects.push({url,status:r.status(),location:r.headers().location});}}
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 assert.ok(events.some(e=>e.status===202&&e.body.event_type==='page_view'));assert.ok(events.every(e=>e.status===202&&e.body.is_test===true));
 fs.writeFileSync(`${out}/production-browser-results.json`,JSON.stringify({status:'PASS',origin,results,redirects,errors,failures,analytics:{acceptedEvents:events.length,testMarked:true},catalogSha256:crypto.createHash('sha256').update(bytes).digest('hex'),marketplaceLinks:'Exact saved verified destinations; no purchases or marketplace writes'},null,2)+'\n');
 await browser.close();console.log('PASS production browser QA');
})().catch(e=>{console.error(e);process.exit(1)});
