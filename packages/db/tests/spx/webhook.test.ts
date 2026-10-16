import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { extractUpdates, isCustomerRefusal, spxConfirms, spxToTarget, stepsTo } from "../../src/spx/webhook.ts";

describe("spxToTarget", () => {
  it("maps the documented 4.1 codes", () => {
    assert.equal(spxToTarget(2001), "shipped");
    assert.equal(spxToTarget(2006), "shipped");
    assert.equal(spxToTarget(4001), "delivered");
    for (const c of [5001, 5002, 5003, 6001, 6002, 6003, 7001]) assert.equal(spxToTarget(c), "delivery_failed");
  });
  it("ignores non-moving and unknown codes", () => {
    assert.equal(spxToTarget(1001), null);
    assert.equal(spxToTarget(3001), null);
    assert.equal(spxToTarget(9999), null);
  });
});

describe("isCustomerRefusal", () => {
  it("counts only returns (6001–6003); SPX-side failures are not the customer's", () => {
    for (const c of [6001, 6002, 6003]) assert.equal(isCustomerRefusal(c), true);
    for (const c of [5001, 5002, 5003, 7001, 4001, 2001]) assert.equal(isCustomerRefusal(c), false);
  });
});

describe("spxConfirms (manual Đã giao / Giao thất bại on an SPX order)", () => {
  it("allows Đã giao only when SPX says delivered", () => {
    assert.equal(spxConfirms("delivered", 4001), true);
    for (const c of [1001, 2001, 2006, 3001, 6001]) assert.equal(spxConfirms("delivered", c), false);
  });
  it("allows Giao thất bại only when SPX says returning / returned", () => {
    for (const c of [6001, 6002, 6003]) assert.equal(spxConfirms("delivery_failed", c), true);
    for (const c of [2001, 2006, 3001, 4001, 5003, 7001]) assert.equal(spxConfirms("delivery_failed", c), false);
  });
});

describe("stepsTo", () => {
  it("walks forward one step at a time", () => {
    assert.deepEqual(stepsTo("pending", "shipped"), ["confirmed", "shipped"]);
    assert.deepEqual(stepsTo("confirmed", "delivered"), ["shipped", "delivered"]);
    assert.deepEqual(stepsTo("shipped", "delivery_failed"), ["delivery_failed"]);
  });
  it("is a noop at, past, or outside the path", () => {
    assert.deepEqual(stepsTo("shipped", "shipped"), []);
    assert.deepEqual(stepsTo("delivered", "shipped"), []);
    assert.deepEqual(stepsTo("cancelled", "delivered"), []);
    assert.deepEqual(stepsTo("delivery_failed", "delivery_failed"), []);
  });
});

describe("extractUpdates", () => {
  it("reads a single object", () => {
    assert.deepEqual(extractUpdates({ tracking_no: "SPXVN1", order_status: 2001 }), [{ trackingNo: "SPXVN1", statusCode: 2001 }]);
  });
  it("reads batches and camelCase", () => {
    assert.deepEqual(extractUpdates({ orders: [{ trackingNo: "A", statusCode: "4001" }, { trackingNo: "B", order_status: 6001 }] }), [
      { trackingNo: "A", statusCode: 4001 },
      { trackingNo: "B", statusCode: 6001 },
    ]);
  });
  it("drops garbage without throwing", () => {
    assert.deepEqual(extractUpdates(null), []);
    assert.deepEqual(extractUpdates({ orders: [{ nope: 1 }, "x", { tracking_no: "", order_status: 2001 }] }), []);
  });
});
