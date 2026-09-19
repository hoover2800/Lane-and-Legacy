const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext();
 await context.route('**/api/events',r=>r.fulfill({status:204}));
 const page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  await page.goto('http://127.0.0.1:4186/?factory_test=1',{waitUntil:'domcontentloaded'});await page.waitForSelector('.product-card');
  assert.equal(await page.locator('.product-card').count(),3);
  assert.equal(await page.locator('.product-card a.amazon .fa-cart-shopping').count(),3);
  assert.equal(await page.locator('#amazon-shop').getAttribute('aria-disabled'),'true');
  await page.locator('#view-all').click();assert.equal(await page.locator('#products-heading').innerText(),'All Products');
  assert.equal(await page.locator('.product-card').count(),3);
  const categories=['home','education','wellness','finance','travel','work','hobbies','more'],expected=[1,1,0,0,0,0,1,0];
  for(let i=0;i<8;i++){
   await page.locator(`#category-list [data-category="${categories[i]}"]`).click();
   assert.equal(await page.locator('.product-card').count(),expected[i]);
  }
  await page.locator('#reset-filters').click();await page.locator('#products').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#product-grid img')).every(i=>i.complete));
  const inspection=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:Array.from(document.images).filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),amazonButtons:Array.from(document.querySelectorAll('.product-card a.amazon')).map(a=>a.textContent.trim())}));
  assert.equal(inspection.overflow,false);assert.deepEqual(inspection.brokenImages,[]);assert.ok(inspection.amazonButtons.every(x=>x==='BUY NOW'));
  await page.screenshot({path:`qa/screenshots/catalog-${width}.png`,fullPage:true});
  results.push({width,status:'PASS',...inspection,categories:8});
 }
 const base=JSON.parse(fs.readFileSync('products.json')).products.find(p=>p.active);
 const fixture={products:Array.from({length:9},(_,i)=>({...base,id:'fixture-'+i,slug:'fixture-'+i,product_id:'fixture-'+i,title:'Test fixture '+i,category:'wellness',featuredPriority:i}))};
 await context.route('**/products.json',r=>r.fulfill({json:fixture}));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.product-card');assert.equal(await page.locator('.product-card').count(),4);
 await page.locator('#view-all').click();assert.equal(await page.locator('.product-card').count(),9);
 await page.locator('#category-list [data-category="wellness"]').click();assert.equal(await page.locator('.product-card').count(),9);
 assert.deepEqual(errors,[]);
 fs.writeFileSync('qa/catalog-browser-results.json',JSON.stringify({status:'PASS',results,futureFixture:{featured:4,fullCatalog:9,wellness:9},errors,externalLinkEvidence:'Saved September 19 browser QA; no new marketplace requests'},null,2)+'\n');
 await browser.close();console.log('PASS: 4 viewports, 8 filters, CTAs, future 9-product fixture, no overflow/broken images/page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
