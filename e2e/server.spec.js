import { test, expect } from "@playwright/test";

// The static server must not let a browser keep a stale main.js beside a newer index.html.
for (const path of ["/", "/index.html", "/src/main.js", "/styles.css"]) {
  test(`GET ${path} is sent with Cache-Control: no-cache`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toBe("no-cache");
  });
}
