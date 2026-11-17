const test=require("node:test");
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {chromium}=require("playwright");

let server,browser,context,page;
const origin="http://127.0.0.1:4179";

async function downloadText(download){
 const stream=await download.createReadStream();
 const chunks=[];
 for await(const chunk of stream)chunks.push(chunk);
 return Buffer.concat(chunks).toString("utf8");
}

test("PWA phase 1 browser audit: dashboard, inventory, parties, actions and responsive layout",async t=>{
 server=spawn("python3",["-m","http.server","4179","--directory","pwa"],{stdio:"ignore"});
 let ready=false;
 for(let i=0;i<60;i++){
  try{const response=await fetch(origin);if(response.ok){ready=true;break}}catch(_){}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,"PWA static server did not start");
 browser=await chromium.launch({headless:true});
 context=await browser.newContext({acceptDownloads:true,serviceWorkers:"block",viewport:{width:1440,height:900}});
 page=await context.newPage();
 const pageErrors=[];
 page.on("pageerror",error=>pageErrors.push(error.message));
 page.on("dialog",dialog=>dialog.accept());
 await page.goto(origin,{waitUntil:"networkidle"});
 await page.waitForFunction(()=>window.__HOLLOO_READY__===true,{timeout:20000});

 await t.test("dashboard loads with no runtime error and primary navigation is wired",async()=>{
  assert.match(await page.locator("h1").first().textContent(),/داشبورد/);
  assert.equal(await page.locator("#sidebar [data-page]").count(),25);
  assert.equal(await page.locator("#sidebar .nav.active").getAttribute("data-page"),"home");
  assert.equal(await page.locator("#loadDemoData").count(),1);
  assert.equal(await page.locator(".quick-grid [data-page]").count(),4);
 });

 await t.test("desktop and mobile layout do not clip the main workspace",async()=>{
  const desktop=await page.evaluate(()=>({sidebar:getComputedStyle(document.querySelector("#sidebar")).display,mainWidth:document.querySelector("#main").clientWidth,mainScroll:document.querySelector("#main").scrollWidth,viewport:innerWidth}));
  assert.notEqual(desktop.sidebar,"none");
  assert.ok(desktop.mainScroll<=desktop.mainWidth+2,"desktop main content overflows horizontally");
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  const mobile=await page.evaluate(()=>({sidebar:getComputedStyle(document.querySelector("#sidebar")).display,mobileNav:getComputedStyle(document.querySelector("#mobileNav")).display,mainWidth:document.querySelector("#main").clientWidth,mainScroll:document.querySelector("#main").scrollWidth,viewport:innerWidth}));
  assert.equal(mobile.sidebar,"none");
  assert.notEqual(mobile.mobileNav,"none");
  assert.ok(mobile.mainScroll<=mobile.mainWidth+2,"mobile main content overflows horizontally");
  await page.setViewportSize({width:1440,height:900});
 });

 await t.test("inventory create, alias barcode search, duplicate prevention and CSV export work",async()=>{
  await page.locator('#sidebar [data-page="inventory"]').click();
  await page.waitForFunction(()=>document.querySelector("h1")?.textContent.includes("کالا"));
  await page.locator("#addBtn").click();
  await page.locator('#entryForm [name="sku"]').fill("QA-YARN-001");
  await page.locator('#entryForm [name="barcode"]').fill("MAIN-001");
  await page.locator('#entryForm [name="barcodes"]').fill("ALT-001, ALT-002");
  await page.locator('#entryForm [name="name"]').fill("نخ آزمایشی ممیزی");
  await page.locator('#entryForm [name="group1"]').fill("آزمایشی");
  await page.locator('#entryForm [name="yarn"]').fill("FDY");
  await page.locator('#entryForm [name="color"]').fill("سفید");
  await page.locator('#entryForm [name="denier"]').fill("150");
  await page.locator('#entryForm [name="minStock"]').fill("10");
  await page.locator('#entryForm [name="maxStock"]').fill("100");
  await page.locator('#entryForm [name="price1"]').fill("120000");
  await page.locator('#entryForm button[type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector("#modal").hidden);
  await page.waitForFunction(()=>document.querySelector("#toast")?.textContent.includes("ذخیره اطلاعات"));
  await page.waitForFunction(()=>document.querySelector("#main")?.textContent.includes("نخ آزمایشی ممیزی"));
  await page.locator("#search").fill("ALT-002");
  await page.waitForFunction(()=>document.querySelector("#main")?.textContent.includes("نخ آزمایشی ممیزی"));
  assert.match(await page.locator("#main").textContent(),/ALT-002|نخ آزمایشی ممیزی/);

  await page.locator("#search").fill("");
  await page.locator("#addBtn").click();
  await page.locator('#entryForm [name="sku"]').fill("QA-YARN-002");
  await page.locator('#entryForm [name="barcode"]').fill("ALT-002");
  await page.locator('#entryForm [name="name"]').fill("کالای بارکد تکراری");
  await page.locator('#entryForm [name="denier"]').fill("75");
  await page.locator('#entryForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector("#toast")?.textContent.includes("بارکدها"));
  assert.equal(await page.locator("#modal").isVisible(),true);
  await page.locator("#cancelModal").click();

  const downloadPromise=page.waitForEvent("download");
  await page.locator("#exportInventoryCsv").click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/^inventory-.*\.csv$/);
  const csv=await downloadText(download);
  assert.ok(csv.includes("ALT-001")&&csv.includes("ALT-002"),"inventory CSV omitted alias barcodes");
 });

 await t.test("party create, search, statement print and CSV actions work",async()=>{
  await page.locator('#sidebar [data-page="parties"]').click();
  await page.waitForFunction(()=>document.querySelector("h1")?.textContent.includes("اشخاص"));
  await page.locator("#addBtn").click();
  await page.locator('#entryForm [name="name"]').fill("مشتری آزمایشی ممیزی");
  await page.locator('#entryForm [name="kind"]').selectOption({label:"مشتری"});
  await page.locator('#entryForm [name="group"]').fill("عمده");
  await page.locator('#entryForm [name="region"]').fill("تهران");
  await page.locator('#entryForm [name="phone"]').fill("02100000000");
  await page.locator('#entryForm [name="creditLimit"]').fill("5000000");
  await page.locator('#entryForm [name="creditDays"]').fill("30");
  await page.locator('#entryForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector("#toast")?.textContent.includes("ذخیره اطلاعات"));
  await page.waitForFunction(()=>document.querySelector("#main")?.textContent.includes("مشتری آزمایشی ممیزی"));
  await page.locator("#search").fill("تهران");
  await page.waitForFunction(()=>document.querySelector("#main")?.textContent.includes("مشتری آزمایشی ممیزی"));
  const details=page.locator("#main details").first();
  await details.locator("summary").click();
  assert.equal(await details.locator(".party-statement-print").count(),1);
  assert.equal(await details.locator(".party-statement-csv").count(),1);
  const popupPromise=page.waitForEvent("popup");
  await details.locator(".party-statement-print").click();
  const popup=await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  assert.match(await popup.title(),/صورتحساب/);
  await popup.close();
  const csvPromise=page.waitForEvent("download");
  await details.locator(".party-statement-csv").click();
  const csvDownload=await csvPromise;
  const statement=await downloadText(csvDownload);
  assert.ok(statement.includes("مشتری آزمایشی ممیزی"));
 });

 await t.test("unit toggle and backup download preserve saved inventory and parties",async()=>{
  await page.locator("#unitBtn").click();
  assert.equal((await page.locator("#unitBtn").textContent()).trim(),"ریال");
  await page.locator("#unitBtn").click();
  assert.equal((await page.locator("#unitBtn").textContent()).trim(),"تومان");
  const backupPromise=page.waitForEvent("download");
  await page.locator("#exportBtn").click();
  const backupDownload=await backupPromise;
  assert.match(backupDownload.suggestedFilename(),/holloo-backup-.*\.json/);
  const backup=JSON.parse(await downloadText(backupDownload));
  assert.equal(backup.app,"HOLLOO PRO+ PWA");
  assert.ok(backup.records.products.some(x=>x.sku==="QA-YARN-001"&&x.barcodes.includes("ALT-002")));
  assert.ok(backup.records.parties.some(x=>x.name==="مشتری آزمایشی ممیزی"));
 });

 assert.deepEqual(pageErrors,[],"browser runtime errors were raised");
 await context.close();
 await browser.close();
 server.kill();
});
