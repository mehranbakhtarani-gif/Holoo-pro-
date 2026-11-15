const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculateImportShipmentCost } = require("../import-cost.js");
const root = path.resolve(__dirname, "..");

test("calculates converted goods cost, landed cost and cost per kg", () => {
  const result = calculateImportShipmentCost({
    currency: "USD", fx: 50000, goods: 1000, weight: 25000,
    freight: 1000000, customs: 400000, other: 100000
  });
  assert.deepEqual(result, {
    goodsRial: 50000000, totalCost: 51500000, unitCost: 2060
  });
});

test("rejects unsupported currencies and invalid base values", () => {
  assert.throws(() => calculateImportShipmentCost({currency:"IRR",fx:1,goods:1,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:0,goods:1,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:1,goods:0,weight:1}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:1,goods:1,weight:0}));
});

test("rejects negative, fractional or overflowing ancillary costs", () => {
  assert.throws(() => calculateImportShipmentCost({currency:"CNY",fx:1,goods:1,weight:1,freight:-1}));
  assert.throws(() => calculateImportShipmentCost({currency:"EUR",fx:1,goods:1,weight:1,customs:1.5}));
  assert.throws(() => calculateImportShipmentCost({currency:"USD",fx:Number.MAX_SAFE_INTEGER,goods:2,weight:1}));
});

test("PWA loads the helper before app code and precaches it", () => {
  const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
  const sw = fs.readFileSync(path.join(root,"sw.js"),"utf8");
  assert.ok(html.indexOf("import-cost.js") >= 0);
  assert.ok(html.indexOf("import-cost.js") < html.indexOf("app.js"));
  assert.match(sw, /\.\/import-cost\.js/);
  assert.match(fs.readFileSync(path.join(root,"app.js"),"utf8"), /calculateImportShipmentCost/);
});
