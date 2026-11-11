import { JSDOM } from "jsdom";

export function installDom(html = "<!doctype html><body></body>") {
  const dom = new JSDOM(html);
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  return {
    window,
    document: window.document,
    teardown() {
      window.close();
      delete globalThis.window;
      delete globalThis.document;
    },
  };
}

export function pointer(window, type, init = {}) {
  const { pointerId = 1, pointerType = "mouse", isPrimary = true, ...rest } = init;
  if (typeof window.PointerEvent === "function") {
    return new window.PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType, isPrimary, ...rest });
  }
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, ...rest });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    isPrimary: { value: isPrimary },
  });
  return event;
}
