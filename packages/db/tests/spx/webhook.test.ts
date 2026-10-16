import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { extractUpdates, spxToTarget, stepsTo } from "../../src/spx/webhook.ts";

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
