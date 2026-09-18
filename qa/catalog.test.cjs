const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { selectProducts, safeURL, safeImage, productCard, outboundAttributes } = require('../app.js');
const products = JSON.parse(fs.readFileSync(path.join(root, 'products.json'))).products;
const config = JSON.parse(fs.readFileSync(path.join(root, 'site-config.json')));

test('featured products exclude inactive records, sort by priority, and cap at four without mutating data', () => {
  const items = [
    { id:'hidden',title:'Hidden',active:false,featured:true,featuredPriority:0 },
    ...Array.from({length:6},(_,i)=>({id:String(i),title:`Product ${i}`,image:'cover.png',active:true,featured:i!==5,featuredPriority:6-i}))
  ];
  const before = JSON.stringify(items);
  assert.deepEqual(selectProducts(items).map(p=>p.id),['4','3','2','1']);
  assert.equal(JSON.stringify(items),before);
  assert.equal(selectProducts(items,{featured:false}).length,6);
});
test('category, search, and type filters combine and support genuine empty states', () => {
  assert.equal(selectProducts(products,{featured:false,category:'education',query:'TEACHER'}).length,1);
  assert.equal(selectProducts(products,{featured:false,category:'education',query:'travel'}).length,0);
  assert.equal(selectProducts(products,{featured:false,category:'wellness'}).length,0);
  assert.equal(selectProducts(products,{featured:false,kind:'journal'})[0].id,'story-rich-travel-journal');
  assert.equal(selectProducts(products,{featured:false,kind:'digital'}).length,0);
});
test('placeholder and unsafe outbound URLs are never rendered as links', () => {
  for (const url of ['#',null,'','javascript:alert(1)','http://example.com','https://user:secret@example.com']) assert.equal(safeURL(url),null);
  assert.equal(safeURL('https://www.etsy.com/shop/LaneandLegacy'),config.shops.etsy);
  assert.equal(outboundAttributes('#',{platform:'etsy',placement:'test'}),'');
});
test('product titles are escaped, images are local, and missing destinations are clearly unavailable', () => {
  const card = productCard({...products[0],amazonUrl:null,title:'<script>alert(1)</script>',image:'javascript:alert(1)'});
  assert.ok(!card.includes('<script>'));
  assert.ok(!card.includes('href="#"'));
  assert.ok(card.includes('aria-disabled="true"'));
  assert.equal(safeImage('../secret.png'),null);
  assert.equal(safeImage('https://remote.example/cover.png'),null);
  assert.equal(safeImage('3d print cover.avif'),'3d%20print%20cover.avif');
});
test('catalog IDs/slugs are unique and all configured assets exist', () => {
  assert.equal(new Set(products.map(p=>p.id)).size,products.length);
  assert.equal(new Set(products.map(p=>p.slug)).size,products.length);
  for (const product of products) {
    assert.ok(product.title && product.shortDescription && product.category);
    assert.ok(fs.existsSync(path.join(root,product.image)), product.image);
    for (const key of ['amazonUrl','etsyUrl']) if (product[key]) assert.ok(safeURL(product[key]));
  }
});
test('only verified repository links are connected, with inert metadata for future tracking', () => {
  assert.equal(config.social.youtube,'https://www.youtube.com/@laneandlegacypublishing');
  assert.equal(products.filter(p=>p.amazonUrl).length,3);
  assert.equal(products.filter(p=>p.etsyUrl).length,0);
  assert.equal(config.shops.amazon,null);
  assert.equal(outboundAttributes(config.shops.amazon,{platform:'amazon',placement:'hero'}),'');
  const attrs = outboundAttributes(products.find(p=>p.id==='3d-print-project-lab').amazonUrl,{platform:'amazon',placement:'product-card'});
  assert.ok(attrs.includes('data-placement="product-card"'));
  assert.ok(!attrs.includes('utm_'));
  assert.ok(attrs.includes('noopener noreferrer'));
});


test('scheduled rotation is stable within a period, deterministic across visitors, and changes at the boundary', () => {
  const items = Array.from({length:6},(_,i)=>({id:String(i),title:`Item ${i}`,active:true,featured:true,featuredPriority:i,image:'cover.png'}));
  const selection={mode:'scheduled',periodDays:7,epoch:'2026-09-18'};
  const pick=day=>selectProducts(items,{selection,now:Date.parse(day)}).map(p=>p.id);
  assert.deepEqual(pick('2026-09-18T00:00:00Z'),pick('2026-09-24T23:59:59Z'));
  assert.deepEqual(pick('2026-09-25T00:00:00Z'),['1','2','3','4']);
  assert.deepEqual(pick('2026-09-18T00:00:00Z'),['0','1','2','3']);
});
test('featured selection falls back without inactive or missing-art cards and supports performance ranks', () => {
  const items=[{id:'a',title:'A',active:true,featured:true,image:null},
    {id:'b',title:'B',active:false,featured:true,image:'cover.png'},
    {id:'c',title:'C',active:true,featured:false,image:'cover.png'},
    {id:'d',title:'D',active:true,featured:false,image:'cover.png'}];
  assert.deepEqual(selectProducts(items).map(p=>p.id),['c','d']);
  assert.deepEqual(selectProducts(items,{selection:{mode:'performance',performanceRankedIds:['d','c']}}).map(p=>p.id),['d','c']);
});
test('optional attribution uses configured values only and preserves destination parameters', () => {
  const base='https://www.etsy.com/listing/123?existing=yes';
  const metadata={platform:'etsy',placement:'featured-products',productId:'home',campaign:'launch'};
  assert.ok(!outboundAttributes(base,metadata).includes('utm_source'));
  const link=outboundAttributes(base,{...metadata,tracking:{enabled:true,source:'lane-website',platforms:['etsy']}});
  assert.ok(link.includes('utm_source=lane-website'));
  assert.ok(link.includes('utm_campaign=launch'));
  assert.ok(link.includes('existing=yes'));
  assert.ok(!link.includes('tag='));
});
test('pending publication never creates an Amazon link', () => {
  const travel=products.find(p=>p.id==='story-rich-travel-journal');
  assert.equal(travel.amazonUrl,null);
  const card=productCard(travel);
  assert.ok(card.includes('Awaiting Amazon publication'));
  assert.ok(!card.includes('href='));
});
