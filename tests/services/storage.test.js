import { test } from "node:test";
import assert from "node:assert/strict";
import { getStorage } from "../../src/services/storage.js";

test("getStorage returns localStorage, or null when reading it throws", () => {
  const storage = {};
  assert.equal(getStorage({ localStorage: storage }), storage);
  assert.equal(getStorage({ get localStorage() { throw new Error("blocked"); } }), null);
  assert.equal(getStorage({}), null);
});
