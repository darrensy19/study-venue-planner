// Dependency-free DOM stub for tests/js/app.test.js — no jsdom, no Playwright,
// package.json stays zero-dependency (CLAUDE.md, "Testing"). Bounded to what
// app.js's own render code actually touches: element creation, attributes,
// className/textContent, appendChild/replaceChildren, and addEventListener /
// dispatchEvent for the one interactive path (the controls form's submit
// handler). It does not attempt CSS/layout, real browser form validity,
// focus/IME, or the accessibility tree — those are out of scope by design.

export class StubElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.className = "";
    this._text = "";
    this._hasText = false;
    this.children = [];
    this.parentNode = null;
    this._attributes = {};
    this._listeners = {};
    // Plain properties some call sites set directly rather than through
    // setAttribute (mirrors real DOM: .selected / .checked reflect current
    // state, not the initial attribute).
    this.selected = undefined;
    this.checked = undefined;
  }

  get textContent() {
    if (this._hasText) return this._text;
    return this.children.map((c) => c.textContent ?? "").join("");
  }

  set textContent(value) {
    this._text = value;
    this._hasText = true;
    this.children = [];
  }

  setAttribute(name, value) {
    this._attributes[name] = String(value);
  }

  getAttribute(name) {
    return this._attributes[name] ?? null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes) {
    this.children = [];
    for (const node of nodes) this.appendChild(node);
  }

  addEventListener(type, handler) {
    (this._listeners[type] ??= []).push(handler);
  }

  dispatchEvent(event) {
    for (const handler of this._listeners[event.type] ?? []) handler(event);
    return true;
  }

  /** Depth-first search by `name` attribute — covers the label-wrapped
   * inputs/selects renderControls() produces. Test-only; not a DOM API. */
  findByName(name) {
    if (this.getAttribute("name") === name) return this;
    for (const child of this.children) {
      const found = child.findByName(name);
      if (found) return found;
    }
    return null;
  }
}

export class StubDocument {
  constructor() {
    this._byId = new Map();
  }

  createElement(tag) {
    return new StubElement(tag);
  }

  getElementById(id) {
    return this._byId.get(id) ?? null;
  }

  /** Test-only registration hook — not a real DOM API. */
  registerById(id, element) {
    this._byId.set(id, element);
  }
}

/** Minimal FormData stand-in, reading current values straight from the stub
 * element tree built by app.js's own el() calls — real Node FormData doesn't
 * populate itself from a non-DOM form element, so app.js's unmodified
 * `new FormData(form)` call needs this shim bound to `globalThis.FormData`
 * before a submit is dispatched in tests. */
export class StubFormData {
  constructor(form) {
    this._form = form;
  }

  get(name) {
    const field = this._form.findByName(name);
    if (!field) return null;
    if (field.tagName === "SELECT") {
      const selected = field.children.find((option) => option.selected);
      return selected ? selected.getAttribute("value") : null;
    }
    if (field.getAttribute("type") === "checkbox") {
      return field.checked ? "on" : null;
    }
    return field.getAttribute("value");
  }
}
