const KEY_SCROLLS = {
  j: () => window.scrollBy({ top: 70, behavior: "smooth" }),
  k: () => window.scrollBy({ top: -70, behavior: "smooth" }),
  h: () => window.scrollBy({ left: -70, behavior: "smooth" }),
  l: () => window.scrollBy({ left: 70, behavior: "smooth" }),
  d: () => window.scrollBy({ top: Math.floor(window.innerHeight / 2), behavior: "smooth" }),
  u: () => window.scrollBy({ top: -Math.floor(window.innerHeight / 2), behavior: "smooth" }),
  G: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }),
};

let core = null;
let pendingG = false;
let mode = "normal";

let hintState = null;
let hintInput = "";

let paletteInput = null;
let paletteMatches = [];

bootstrap().catch((error) => {
  console.error("[vimium-rs] Failed to bootstrap content script:", error);
});

async function bootstrap() {
  core = await loadWasmCore();
  core.set_mode("normal");
  document.addEventListener("keydown", onKeyDown, true);
}

async function loadWasmCore() {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.getURL) {
    throw new Error("chrome.runtime.getURL unavailable in this execution context");
  }

  const wasmModule = await import(runtime.getURL("wasm/vimium_rs_wasm.js"));
  await wasmModule.default(runtime.getURL("wasm/vimium_rs_wasm_bg.wasm"));
  return new wasmModule.VimiumCore();
}

function onKeyDown(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (mode === "palette") {
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    } else if (event.key === "Enter" && paletteMatches.length > 0) {
      event.preventDefault();
      activateMatchedElement(paletteMatches[0].index);
      closePalette();
    }
    return;
  }

  if (mode === "hints") {
    handleHintModeInput(event);
    return;
  }

  if (isTypingTarget(event.target) && event.key !== "Escape") {
    core.set_mode("insert");
    return;
  }
  core.set_mode("normal");

  if (event.shiftKey && event.key === "J") {
    event.preventDefault();
    sendRuntimeMessage({ type: "NEXT_TAB" });
    return;
  }
  if (event.shiftKey && event.key === "K") {
    event.preventDefault();
    sendRuntimeMessage({ type: "PREV_TAB" });
    return;
  }

  if (event.key === "g") {
    event.preventDefault();
    if (pendingG) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      pendingG = false;
    } else {
      pendingG = true;
      setTimeout(() => {
        pendingG = false;
      }, 400);
    }
    return;
  }
  pendingG = false;

  if (event.key === "f") {
    event.preventDefault();
    openHintMode();
    return;
  }

  if (event.key === "/" || event.key === "?") {
    event.preventDefault();
    openPalette();
    return;
  }

  const handler = KEY_SCROLLS[event.key];
  if (handler) {
    event.preventDefault();
    handler();
  }
}

function handleHintModeInput(event) {
  if (!hintState) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeHintMode();
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    hintInput = hintInput.slice(0, -1);
    updateVisibleHints();
    return;
  }

  if (/^[a-z]$/i.test(event.key)) {
    event.preventDefault();
    hintInput += event.key.toLowerCase();
    updateVisibleHints();
  }
}

function openHintMode() {
  const clickable = collectClickableElements();
  if (clickable.length === 0) return;

  hintInput = "";
  core.set_mode("hints");
  mode = "hints";

  const hints = core.generate_hints(clickable.length);
  hintState = {
    clickable,
    hints,
    overlays: [],
  };

  hints.forEach((entry) => {
    const element = clickable[entry.index];
    const rect = element.getBoundingClientRect();
    const marker = document.createElement("span");
    marker.className = "vimium-rs-hint";
    marker.textContent = entry.label;
    marker.style.position = "absolute";
    marker.style.left = `${window.scrollX + rect.left}px`;
    marker.style.top = `${window.scrollY + rect.top}px`;
    marker.style.background = "#ffeb3b";
    marker.style.color = "#000";
    marker.style.font = "700 11px/1 monospace";
    marker.style.padding = "2px 4px";
    marker.style.border = "1px solid #111";
    marker.style.borderRadius = "3px";
    marker.style.zIndex = "2147483647";
    document.body.appendChild(marker);
    hintState.overlays.push(marker);
  });
}

function updateVisibleHints() {
  if (!hintState) return;
  const filtered = core.filter_hints(hintInput);
  const visibleIndexes = new Set(filtered.map((entry) => entry.index));

  hintState.overlays.forEach((overlay, index) => {
    overlay.style.display = visibleIndexes.has(index) ? "block" : "none";
  });

  const resolved = core.resolve_hint(hintInput);
  if (resolved >= 0) {
    activateMatchedElement(resolved);
    closeHintMode();
  }
}

function closeHintMode() {
  hintState?.overlays.forEach((overlay) => overlay.remove());
  hintState = null;
  hintInput = "";
  mode = "normal";
  core.set_mode("normal");
}

function openPalette() {
  core.set_mode("palette");
  mode = "palette";

  const wrapper = document.createElement("div");
  wrapper.id = "vimium-rs-palette";
  wrapper.style.position = "fixed";
  wrapper.style.left = "50%";
  wrapper.style.top = "16px";
  wrapper.style.transform = "translateX(-50%)";
  wrapper.style.zIndex = "2147483647";
  wrapper.style.background = "#111";
  wrapper.style.padding = "8px";
  wrapper.style.borderRadius = "6px";
  wrapper.style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";

  paletteInput = document.createElement("input");
  paletteInput.type = "text";
  paletteInput.placeholder = "Regex click...";
  paletteInput.style.width = "340px";
  paletteInput.style.padding = "6px 8px";
  paletteInput.style.font = "14px/1.3 monospace";
  paletteInput.style.color = "#fff";
  paletteInput.style.background = "#222";
  paletteInput.style.border = "1px solid #555";

  paletteInput.addEventListener("input", () => {
    refreshPaletteMatches(paletteInput.value);
  });

  wrapper.appendChild(paletteInput);
  document.body.appendChild(wrapper);
  paletteInput.focus();
}

function closePalette() {
  document.getElementById("vimium-rs-palette")?.remove();
  clearHighlighting();
  paletteInput = null;
  paletteMatches = [];
  mode = "normal";
  core.set_mode("normal");
}

function refreshPaletteMatches(pattern) {
  clearHighlighting();
  if (!pattern.trim()) {
    paletteMatches = [];
    return;
  }

  const clickable = collectClickableElements();
  const texts = clickable.map(readVisibleText);
  try {
    paletteMatches = core.match_regex(pattern, texts);
  } catch {
    paletteMatches = [];
    return;
  }

  paletteMatches.forEach((match) => {
    const element = clickable[match.index];
    if (element) {
      element.dataset.vimiumRsOutline = element.style.outline;
      element.style.outline = "2px solid #ff9800";
    }
  });
}

function clearHighlighting() {
  document.querySelectorAll("[data-vimium-rs-outline]").forEach((node) => {
    node.style.outline = node.dataset.vimiumRsOutline || "";
    delete node.dataset.vimiumRsOutline;
  });
}

function collectClickableElements() {
  return Array.from(
    document.querySelectorAll("a, button, input, select, textarea, [role='button'], [onclick], [tabindex]")
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && isElementVisible(element);
  });
}

function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
}

function readVisibleText(element) {
  return (
    element.innerText?.trim() ||
    element.textContent?.trim() ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    ""
  );
}

function activateMatchedElement(index) {
  const clickable = hintState?.clickable || collectClickableElements();
  const element = clickable[index];
  if (!element) return;
  element.focus({ preventScroll: false });
  element.click();
}

function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  return (
    target.isContentEditable ||
    target.matches("input, textarea, select, [contenteditable='true']")
  );
}

function sendRuntimeMessage(message) {
  const runtime = globalThis.chrome?.runtime;
  if (runtime?.sendMessage) {
    runtime.sendMessage(message).catch(() => undefined);
  }
}
