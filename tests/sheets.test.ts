import assert from "node:assert/strict";
import { test } from "node:test";
import { checkWriteAccess, readRecipes, writeRecipes } from "../src/googleSheets.ts";

const headers = ["id", "title", "category", "time_minutes", "ingredients", "instructions", "created_at", "updated_at"];

test("viewer reads an initialized Sheet and is recognized as read-only", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    { sheets: [{ properties: { title: "Recipes" } }] },
    { values: [headers] },
    { values: [["one", "Pasta", "Dinner", "25", '["Pasta"]', '["Cook"]', "", ""]] },
    { values: [headers] },
    { error: { message: "Permission denied" } },
  ];
  let count = 0;
  globalThis.fetch = async (_url, init) => {
    const body = responses[count++];
    if (init?.method === "PUT") {
      assert.deepEqual(JSON.parse(String(init.body)).values, [headers]);
      return Response.json(body, { status: 403 });
    }
    return Response.json(body);
  };
  try {
    const recipes = await readRecipes("example", "Recipes", "test-token");
    assert.equal(recipes[0].title, "Pasta");
    assert.equal(await checkWriteAccess("example", "Recipes", "test-token"), false);
    assert.equal(count, 5);
  } finally { globalThis.fetch = originalFetch; }
});

test("unrelated columns are refused before any writes", async () => {
  const originalFetch = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.method, undefined);
    return Response.json(count++ === 0 ? { sheets: [{ properties: { title: "Recipes" } }] } : { values: [["unrelated data"]] });
  };
  try {
    await assert.rejects(readRecipes("example", "Recipes", "test-token"), /different columns/);
    assert.equal(count, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("failed save sends one update and does not clear the Sheet first", async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url).includes(":clear"), false);
    if (init?.method === "PUT") {
      writes++;
      const payload = JSON.parse(String(init.body));
      assert.equal(payload.values[0][1], "New recipe");
      assert.deepEqual(payload.values[1], Array(8).fill(""));
      return Response.json({ error: { message: "Save failed" } }, { status: 503 });
    }
    if (String(url).includes("?fields=")) return Response.json({ sheets: [{ properties: { title: "Recipes" } }] });
    if (decodeURIComponent(String(url)).includes("A1:H1")) return Response.json({ values: [headers] });
    return Response.json({ values: [["old-one"], ["old-two"]] });
  };
  try {
    await assert.rejects(writeRecipes("example", "Recipes", "test-token", [{
      id: "new", title: "New recipe", category: "Dinner", timeMinutes: 10,
      ingredients: ["Salt"], instructions: ["Cook"], createdAt: "", updatedAt: "",
    }]), /Save failed/);
    assert.equal(writes, 1);
  } finally { globalThis.fetch = originalFetch; }
});
