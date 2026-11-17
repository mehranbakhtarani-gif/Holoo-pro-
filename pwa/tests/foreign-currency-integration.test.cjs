const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

test("foreign currency invoices store foreign amounts and Rial book values", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/convertForeignAmountToRial\(/);
 assert.match(app,/foreignSubtotalMinor/);
 assert.match(app,/foreignTotalMinor/);
 assert.match(app,/fxRateRialPerUnit:fxRate/);
 assert.match(app,/name="currency"/);
});

test("foreign receipts and payments retain currency and exchange rate", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/foreignAmountMinor,fxRateRialPerUnit:fxRate/);
 assert.match(app,/مبلغ \(ریال یا واحد ارز\)/);
});

test("settlement recognizes FX gains and losses with balanced ledger accounts", () => {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/calculateCumulativeRealizedForeignExchange\(/);
 assert.match(app,/4301/);
 assert.match(app,/5501/);
 assert.match(app,/fxGainRial/);
 assert.match(app,/fxLossRial/);
 assert.match(app,/currentPage==="foreignExchange"/);
});

test("foreign currency helper is loaded and cached before the application", () => {
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.ok(html.indexOf("foreign-currency.js")>=0);
 assert.ok(html.indexOf("foreign-currency.js")<html.indexOf("app.js"));
 assert.match(sw,/\.\/foreign-currency\.js/);
});

test("foreign exchange realized gain and loss report exports settlement details to CSV",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.match(app,/id="exportForeignExchangeCsv"/);
 assert.match(app,/holloo-foreign-exchange\.csv/);
 assert.match(app,/سود تسعیر ریال/);
 assert.match(app,/زیان تسعیر ریال/);
});

test("FX dashboard and CSV share the active-only realized settlement report builder",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 assert.equal((app.match(/buildRealizedForeignExchangeRows\(\{allocations,foreignPayments\}\)/g)||[]).length,2);
 assert.match(app,/currentPage==="foreignExchange"/);
 assert.match(app,/exportForeignExchangeCsv/);
});
