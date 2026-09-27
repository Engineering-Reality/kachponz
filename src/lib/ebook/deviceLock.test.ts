import test from "node:test";
import assert from "node:assert/strict";
import { decideDeviceAccess } from "./deviceLock.ts";

test("allow: perangkat sudah terikat", () => {
  assert.equal(decideDeviceAccess(["a", "b"], "a", 2), "allow");
});
test("claim: masih ada slot", () => {
  assert.equal(decideDeviceAccess(["a"], "c", 2), "claim");
  assert.equal(decideDeviceAccess([], "c", 2), "claim");
});
test("deny: slot penuh & perangkat baru", () => {
  assert.equal(decideDeviceAccess(["a", "b"], "c", 2), "deny");
});
