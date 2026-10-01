"use strict";

/* ==========================================================================
 * Surf Bitmap Generator
 * Port: dev.slne.surf.bitmap.common.provider.BitmapProvider (surf-bitmap-provider)
 * Font: assets/surf/font (bitmaps.yml + shift.json), Texturen aus dem surf-Resourcepack
 * ========================================================================== */

const STORAGE_KEY = "surf-bitmap-generator:state";

/* ---------- surf-bitmap-provider (1:1 Port) ---------- */

const BITMAP_BACKGROUND = "ꑁ";

/* dev.slne.surf.bitmap.common.utils.Spacing */
const SPACING = [
  ["", -1], ["", -2], ["", -4], ["", -8], ["", -16],
  ["", -32], ["", -64], ["", -128], ["", -256], ["", -512],
  ["", 1], ["", 2], ["", 4], ["", 8], ["", 16],
  ["", 32], ["", 64], ["", 128], ["", 256], ["", 512],
];
const NEGATIVE_SPACE_ONE = "";
const NEGATIVE_SPACES = SPACING.filter(([, s]) => s < 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
const POSITIVE_SPACES = SPACING.filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);

function calculateGlyphSpacing(spacing) {
  if (spacing === 0) return "";
  const spaceList = spacing < 0 ? NEGATIVE_SPACES : POSITIVE_SPACES;
  let out = "";
  let remaining = spacing;
  for (const [char, space] of spaceList) {
    while ((spacing < 0 && remaining <= space) || (spacing > 0 && remaining >= space)) {
      out += char;
      remaining -= space;
    }
  }
  return out;
}

const charProviders = (entries) => new Map(entries.map(([k, code, width]) => [k, { char: String.fromCharCode(code), width }]));

/* AlphabetProvider, NumberProvider, UtilityProvider – Reihenfolge wie in BitmapProvider.providers */
const PROVIDERS = [
  { name: "AlphabetProvider", map: charProviders([..."abcdefghijklmnopqrstuvwxyz"].map((c, i) => [c, 0xA411 + i, 6])) },
  { name: "NumberProvider", map: charProviders([..."0123456789"].map((c, i) => [c, 0xA42F + i, 6])) },
  {
    name: "UtilityProvider",
    map: charProviders([
      ["+", 0xA42B, 6], ["_", 0xA439, 6], ["%", 0xA43A, 6], ["=", 0xA43B, 6], ["#", 0xA43C, 6], ["*", 0xA43D, 6],
      ["´", 0xA442, 3], ["&", 0xA443, 7], [")", 0xA444, 3], ["(", 0xA445, 3], ["^", 0xA446, 4], [":", 0xA447, 2],
      [",", 0xA449, 3], ["{", 0xA44A, 4], ["}", 0xA44B, 4], ["°", 0xA44C, 4], ["$", 0xA44D, 8], [".", 0xA454, 2],
      ["\"", 0xA455, 4], ["€", 0xA456, 9], ["!", 0xA457, 2], ["`", 0xA458, 3], [">", 0xA459, 4], ["-", 0xA42C, 6],
      ["<", 0xA45B, 4], ["|", 0xA45C, 2], ["?", 0xA45D, 5], ["§", 0xA45E, 8], [";", 0xA45F, 3], ["'", 0xA460, 2],
      ["]", 0xA461, 3], ["[", 0xA462, 3], ["~", 0xA463, 5], ["/", 0xA42D, 6], ["\\", 0xA42E, 6],
    ]),
  },
];

function findCharProvider(char) {
  for (const p of PROVIDERS) {
    const found = p.map.get(char);
    if (found) return { ...found, source: char, provider: p.name };
  }
  return { char, width: 0, source: char, provider: "UnknownProvider" };
}

function generateBackground(width) {
  let s = "";
  for (let i = 0; i < width; i++) {
    if (i > 0) s += NEGATIVE_SPACE_ONE;
    s += BITMAP_BACKGROUND;
  }
  return s;
}

const dropLast = (s, n) => s.slice(0, Math.max(0, s.length - n));

/**
 * BitmapProvider.translateToComponent
 * @param shadow ARGB (0 = ShadowColor.none())
 */
function translateToComponent(input, foreground, background, shadow = 0, affixAmount = 2) {
  // Kotlin iteriert über UTF-16-Chars, nicht über Codepoints
  const translated = input.toLowerCase().split("").map(findCharProvider);
  const backgroundString = dropLast(translated.map((t) => generateBackground(t.width)).join(NEGATIVE_SPACE_ONE), 2);
  const widthSum = translated.reduce((sum, t) => sum + t.width, 0);

  let prefix = "", suffix = "";
  for (let i = 0; i < affixAmount; i++) {
    prefix += BITMAP_BACKGROUND + NEGATIVE_SPACE_ONE;
    suffix += NEGATIVE_SPACE_ONE + BITMAP_BACKGROUND;
  }

  return comp("", {}, [
    comp(prefix + backgroundString + suffix, { color: background }),
    comp(calculateGlyphSpacing(-widthSum - affixAmount) + translated.map((t) => t.char).join(""), { color: foreground, shadow }),
    comp(calculateGlyphSpacing(affixAmount)),
  ]);
}

/* ---------- Komponenten-Modell (Adventure light) ---------- */

/** style: color, bold, italic, underlined, strikethrough, obfuscated, shadow (ARGB), font, gradient, rainbow */
function comp(text = "", style = {}, children = []) {
  return { text, style, children };
}

const hex6 = (n) => "#" + (n & 0xFFFFFF).toString(16).padStart(6, "0");
/** ARGB -> #RRGGBBAA (Adventure ShadowColor-Format) */
const hex8 = (argb) => hex6(argb) + ((argb >>> 24) & 0xFF).toString(16).padStart(2, "0");

function parseHex6(str) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(str ?? "").trim());
  return m ? parseInt(m[1], 16) : null;
}

/** #RRGGBBAA -> ARGB, wie ShadowColor.fromHexString */
function parseHex8(str) {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})$/i.exec(String(str ?? "").trim());
  return m ? ((parseInt(m[2], 16) << 24) | parseInt(m[1], 16)) >>> 0 : null;
}

const DECORATIONS = ["bold", "italic", "underlined", "strikethrough", "obfuscated"];

function escapeMiniMessage(text) {
  return text.replace(/\\/g, "\\\\").replace(/</g, "\\<");
}

function toMiniMessage(c) {
  let open = "", close = "";
  const s = c.style;
  if (s.color != null) { open += `<color:${hex6(s.color)}>`; close = "</color>" + close; }
  if (s.shadow === 0) { open += "<!shadow>"; close = "</!shadow>" + close; } // ShadowColor.none(), wie Adventure serialisiert
  else if (s.shadow != null) { open += `<shadow:${hex8(s.shadow)}>`; close = "</shadow>" + close; }
  for (const d of DECORATIONS) {
    if (s[d] === true) { open += `<${d}>`; close = `</${d}>` + close; }
    if (s[d] === false) { open += `<${d}:false>`; close = `</${d}>` + close; }
  }
  return open + escapeMiniMessage(c.text) + c.children.map(toMiniMessage).join("") + close;
}

function toJsonObject(c) {
  const o = { text: c.text };
  const s = c.style;
  if (s.color != null) o.color = hex6(s.color);
  if (s.shadow != null) o.shadow_color = s.shadow | 0; // ARGB als (signed) int
  for (const d of DECORATIONS) if (s[d] != null) o[d] = s[d];
  if (c.children.length) o.extra = c.children.map(toJsonObject);
  return o;
}

const escapeUnicode = (s) => s.replace(/[^\x20-\x7e\n]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));

/** Inhalt eines "…"-Strings (Kotlin/Java/YAML): Backslashes und Quotes escapen, Sonderzeichen als \uXXXX */
const quotedString = (s) => escapeUnicode(s.replace(/\\/g, "\\\\").replace(/"/g, "\\\""));

/* ---------- MiniMessage ---------- */

const NAMED_COLORS = {
  black: 0x000000, dark_blue: 0x0000AA, dark_green: 0x00AA00, dark_aqua: 0x00AAAA,
  dark_red: 0xAA0000, dark_purple: 0xAA00AA, gold: 0xFFAA00, gray: 0xAAAAAA,
  dark_gray: 0x555555, blue: 0x5555FF, green: 0x55FF55, aqua: 0x55FFFF,
  red: 0xFF5555, light_purple: 0xFF55FF, yellow: 0xFFFF55, white: 0xFFFFFF,
  grey: 0xAAAAAA, dark_grey: 0x555555,
};

const DECORATION_ALIASES = {
  bold: "bold", b: "bold",
  italic: "italic", i: "italic", em: "italic",
  underlined: "underlined", u: "underlined",
  strikethrough: "strikethrough", st: "strikethrough",
  obfuscated: "obfuscated", obf: "obfuscated",
};

const CONTAINER_NOOP = ["hover", "click", "insert", "insertion"];

const KEYBINDS = {
  "key.jump": "Space", "key.sneak": "Left Shift", "key.sprint": "Left Control", "key.inventory": "E",
  "key.drop": "Q", "key.chat": "T", "key.command": "/", "key.attack": "Left Button", "key.use": "Right Button",
  "key.forward": "W", "key.left": "A", "key.back": "S", "key.right": "D", "key.swapOffhand": "F",
};

function parseColor(str) {
  if (str == null) return null;
  const s = String(str).trim().toLowerCase();
  if (s in NAMED_COLORS) return NAMED_COLORS[s];
  return parseHex6(s.startsWith("#") ? s : "#invalid");
}

/** Liest einen Tag ab Position i ('<'). Gibt { parts, end } zurück oder null. */
function readTag(s, i) {
  const parts = [];
  let cur = "", quote = null;
  for (let j = i + 1; j < s.length; j++) {
    const ch = s[j];
    if (quote) {
      if (ch === "\\" && (s[j + 1] === quote || s[j + 1] === "\\")) { cur += s[++j]; continue; }
      if (ch === quote) { quote = null; continue; }
      cur += ch;
      continue;
    }
    if ((ch === "'" || ch === "\"") && parts.length > 0 && cur === "") { quote = ch; continue; }
    if (ch === ":") { parts.push(cur); cur = ""; continue; }
    if (ch === ">") { parts.push(cur); return { parts, end: j + 1 }; }
    if (ch === "<" || ch === "\n") return null;
    cur += ch;
  }
  return null;
}

function rgbLerp(a, b, t) {
  const ch = (shift) => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function hsvToRgb(h) {
  const i = Math.floor(h * 6), f = h * 6 - i, q = 1 - f;
  const [r, g, b] = [[1, f, 0], [q, 1, 0], [0, 1, f], [0, q, 1], [f, 0, 1], [1, 0, q]][((i % 6) + 6) % 6];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

function resolveTag(name, args, negated, resolvers) {
  if (Object.prototype.hasOwnProperty.call(resolvers, name)) {
    const node = resolvers[name](args);
    return node ? { type: "insert", node } : null;
  }
  if (name in NAMED_COLORS && !negated) return { type: "style", key: "color", style: { color: NAMED_COLORS[name] } };
  if (name.startsWith("#")) {
    const color = parseHex6(name);
    return color == null ? null : { type: "style", key: "color", style: { color } };
  }
  if (name in DECORATION_ALIASES) {
    const deco = DECORATION_ALIASES[name];
    const value = negated ? false : String(args[0] ?? "true").toLowerCase() !== "false";
    return { type: "style", key: deco, style: { [deco]: value } };
  }
  switch (name) {
    case "color": case "colour": case "c": {
      const color = parseColor(args[0]);
      return color == null ? null : { type: "style", key: "color", style: { color } };
    }
    case "reset": return { type: "reset" };
    case "br": case "newline": return { type: "insert", node: comp("\n") };
    case "gradient": {
      const colors = args.map(parseColor).filter((c) => c != null);
      const last = args.length ? parseFloat(args[args.length - 1]) : NaN;
      const phase = Number.isFinite(last) && parseColor(args[args.length - 1]) == null ? Math.max(-1, Math.min(1, last)) : 0;
      return { type: "style", key: "gradient", style: { gradient: { colors: colors.length >= 2 ? colors : [0xFFFFFF, 0x000000], phase } } };
    }
    case "rainbow": {
      let arg = String(args[0] ?? "");
      const reverse = arg.startsWith("!");
      if (reverse) arg = arg.slice(1);
      return { type: "style", key: "rainbow", style: { rainbow: { reverse, phase: parseInt(arg, 10) || 0 } } };
    }
    case "transition": {
      const colors = args.map(parseColor).filter((c) => c != null);
      const last = parseFloat(args[args.length - 1]);
      const phase = Number.isFinite(last) && parseColor(args[args.length - 1]) == null ? Math.max(-1, Math.min(1, last)) : 0;
      if (!colors.length) return null;
      const t = (phase < 0 ? 1 + phase : phase) * (colors.length - 1);
      const idx = Math.min(Math.floor(t), colors.length - 2);
      const color = colors.length === 1 ? colors[0] : rgbLerp(colors[idx], colors[idx + 1], t - idx);
      return { type: "style", key: "transition", style: { color } };
    }
    case "shadow": {
      if (negated) return { type: "style", key: "shadow", style: { shadow: 0 } };
      const full = parseHex8(args[0]);
      if (full != null) return { type: "style", key: "shadow", style: { shadow: full } };
      const color = parseColor(args[0]);
      if (color == null) return null;
      const alphaArg = parseFloat(args[1]);
      const alpha = Math.round((Number.isFinite(alphaArg) ? alphaArg : 0.25) * 255) & 255;
      return { type: "style", key: "shadow", style: { shadow: ((alpha << 24) | color) >>> 0 } };
    }
    case "font": return { type: "style", key: "font", style: { font: args.join(":") } };
    case "key": case "keybind": return { type: "insert", node: comp(KEYBINDS[args[0]] ?? args[0] ?? "") };
    case "lang": case "tr": case "translate": return { type: "insert", node: comp(args[0] ?? "") };
    case "lang_or": case "tr_or": case "translate_or": return { type: "insert", node: comp(args[1] ?? args[0] ?? "") };
    case "selector": case "sel": return { type: "insert", node: comp(args[0] ?? "") };
    case "score": return { type: "insert", node: comp("0") };
    case "nbt": case "data": return { type: "insert", node: comp("") };
  }
  if (CONTAINER_NOOP.includes(name)) return { type: "style", key: name, style: {} };
  return null;
}

/** Closing-Tags matchen über den kanonischen Namen (b -> bold, c -> color, #hex -> color, …) */
function canonicalTagKey(name) {
  if (name in DECORATION_ALIASES) return DECORATION_ALIASES[name];
  if (name in NAMED_COLORS || name.startsWith("#") || ["color", "colour", "c"].includes(name)) return "color";
  return name;
}

/**
 * Parst MiniMessage zu einer Komponente. resolvers: { tagName: (args) => component|null }
 * Unbekannte Tags bleiben – wie bei MiniMessage – als Text stehen.
 */
function parseMiniMessage(input, resolvers = {}) {
  const root = comp();
  const stack = [{ node: root, key: null }];
  let text = "";
  const top = () => stack[stack.length - 1].node;
  const flush = () => { if (text) { top().children.push(comp(text)); text = ""; } };

  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\\" && (input[i + 1] === "<" || input[i + 1] === "\\")) {
      text += input[i + 1];
      i += 2;
      continue;
    }
    if (ch === "<") {
      const tag = readTag(input, i);
      if (tag && handleTag(tag)) { i = tag.end; continue; }
    }
    text += ch;
    i++;
  }
  flush();
  return root;

  function handleTag({ parts }) {
    let first = parts[0];
    let args = parts.slice(1);
    const closing = first.startsWith("/");
    if (closing) first = first.slice(1);
    const negated = first.startsWith("!");
    if (negated) first = first.slice(1);
    let selfClosing = false;
    const lastIdx = args.length ? args.length - 1 : -1;
    if (lastIdx >= 0 ? args[lastIdx].endsWith("/") : first.endsWith("/")) {
      selfClosing = true;
      if (lastIdx >= 0) args[lastIdx] = args[lastIdx].slice(0, -1);
      else first = first.slice(0, -1);
    }
    const name = first.toLowerCase();
    if (!/^#?[a-z0-9_-]+$/.test(name)) return false;

    if (closing) {
      const key = canonicalTagKey(name);
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].key === key) {
          flush();
          stack.length = k;
          return true;
        }
      }
      // unpassender Closing-Tag: MiniMessage ignoriert ihn, sofern der Tag bekannt ist
      return resolveTag(name, args, negated, resolvers) != null;
    }

    const action = resolveTag(name, args, negated, resolvers);
    if (!action) return false;
    flush();
    if (action.type === "reset") {
      stack.length = 1;
    } else if (action.type === "insert") {
      top().children.push(action.node);
    } else {
      const node = comp("", action.style);
      top().children.push(node);
      if (!selfClosing) stack.push({ node, key: canonicalTagKey(name) === "color" ? "color" : action.key });
    }
    return true;
  }
}

/* ---------- Flatten: Komponente -> Zeilen aus { ch, style } ---------- */

function countChars(c) {
  return [...c.text].filter((ch) => ch !== "\n").length + c.children.reduce((n, k) => n + countChars(k), 0);
}

function gradientColorFn(colors, phase, total) {
  let cols = colors;
  let p = phase;
  if (p < 0) { cols = [...colors].reverse(); p = -p; }
  return (i) => {
    let t = total <= 1 ? 0 : i / (total - 1);
    if (p) t = (t + p) % 1;
    const pos = t * (cols.length - 1);
    const idx = Math.min(Math.floor(pos), cols.length - 2);
    return rgbLerp(cols[idx], cols[idx + 1], pos - idx);
  };
}

function flatten(root) {
  const lines = [[]];
  const walk = (c, inherited) => {
    const style = { ...inherited };
    for (const [k, v] of Object.entries(c.style)) {
      if (k === "gradient" || k === "rainbow") continue;
      style[k] = v;
    }
    if (c.style.color != null) style.colorFn = null;
    if (c.style.gradient || c.style.rainbow) {
      const total = countChars(c);
      let fn;
      if (c.style.gradient) fn = gradientColorFn(c.style.gradient.colors, c.style.gradient.phase, total);
      else {
        const { reverse, phase } = c.style.rainbow;
        fn = (i) => hsvToRgb(((reverse ? total - 1 - i : i) / Math.max(1, total) + phase / 10) % 1);
      }
      style.colorFn = { fn, index: 0 };
    }
    for (const ch of c.text) {
      if (ch === "\n") { lines.push([]); continue; }
      const color = style.colorFn ? style.colorFn.fn(style.colorFn.index++) : (style.color ?? 0xFFFFFF);
      lines[lines.length - 1].push({ ch, style: { ...style, color, colorFn: undefined } });
    }
    for (const child of c.children) walk(child, style);
  };
  walk(root, {});
  return lines;
}

/* ---------- Font-Engine (Minecraft-Glyph-Metriken) ---------- */

const GRID_CHARS = Array.from({ length: 8 }, (_, r) =>
  Array.from({ length: 6 }, (_, c) => String.fromCharCode(0xA411 + r * 6 + c)).join(""));

/* bitmaps.yml bzw. assets/surf/font/default.json */
const BITMAP_FONT = [
  { file: "bitmap.png", height: 7, ascent: 7, chars: GRID_CHARS },
  { file: "pixels/pixel_9.png", height: 9, ascent: 9, chars: ["ꑚ"] },
  { file: "@background", height: 7, ascent: 7, chars: [BITMAP_BACKGROUND] },
  ...[
    [0xA442, "acute_accent"], [0xA443, "ampersand"], [0xA444, "bracket_close"], [0xA445, "bracket_open"],
    [0xA446, "circumflex"], [0xA447, "colon"], [0xA449, "comma"], [0xA44A, "curly_bracket_close"],
    [0xA44B, "curly_bracket_open"], [0xA44C, "degree"], [0xA44D, "dollar"], [0xA454, "dot"],
    [0xA455, "double_quote"], [0xA457, "exclamation_mark"], [0xA458, "grave_accent"], [0xA459, "greater_than"],
    [0xA45B, "less_than"], [0xA45C, "pipe"], [0xA45D, "question_mark"], [0xA45E, "section"],
    [0xA45F, "semicolon"], [0xA460, "single_quote"], [0xA461, "square_bracket_close"],
    [0xA462, "square_bracket_open"], [0xA463, "tilde"],
  ].map(([code, file]) => ({ file: file + ".png", height: 7, ascent: 7, chars: [String.fromCharCode(code)] })),
  { file: "euro.png", height: 8, ascent: 8, chars: ["ꑖ"] }, // template: bitmap_template (height 8)
];

const BACKGROUND_TEXTURES = {
  "background.png": "background.png (Alpha 128)",
  "background254.png": "background254.png (Alpha 254)",
  "background_normal.png": "background_normal.png (Alpha 255)",
};

const MC_FONT = `"Minecraft Preview", "Minecraft Preview Extra", monospace`;
const RASTER_K = 8; // Canvas-Pixel pro Font-Einheit (1 Einheit = 0.5 MC-Pixel)

const engine = {
  images: {},             // file -> { w, h, data }
  bitmapGlyphs: new Map(),
  maskGlyphs: new Map(),
  spaces: new Map(Object.entries(window.SURF_SPACE_ADVANCES || {})),
  backgroundFile: "background.png",
  obfuscatePool: null,
};

const rasterCanvas = document.createElement("canvas");
const rasterCtx = rasterCanvas.getContext("2d", { willReadFrequently: true });

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      rasterCanvas.width = img.width;
      rasterCanvas.height = img.height;
      rasterCtx.clearRect(0, 0, img.width, img.height);
      rasterCtx.drawImage(img, 0, 0);
      resolve({ w: img.width, h: img.height, data: rasterCtx.getImageData(0, 0, img.width, img.height).data });
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function loadTextures() {
  const entries = Object.entries(window.SURF_TEXTURES || {});
  await Promise.all(entries.map(async ([file, src]) => { engine.images[file] = await loadImage(src); }));
  buildBitmapGlyphs();
}

/** Minecraft BitmapProvider: advance = (int)(0.5 + actualWidth * scale) + 1 */
function buildBitmapGlyphs() {
  engine.bitmapGlyphs.clear();
  engine.obfuscatePool = null;
  for (const def of BITMAP_FONT) {
    const img = engine.images[def.file === "@background" ? engine.backgroundFile : def.file];
    if (!img) continue;
    const cols = Math.max(...def.chars.map((r) => r.length));
    const cw = img.w / cols, ch = img.h / def.chars.length;
    const scale = def.height / ch;
    def.chars.forEach((row, r) => {
      [...row].forEach((char, c) => {
        if (char === "\u0000" || char === " ") return;
        const data = new Uint8ClampedArray(cw * ch * 4);
        let ink = 0;
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const src = ((r * ch + y) * img.w + (c * cw + x)) * 4;
            const dst = (y * cw + x) * 4;
            for (let k = 0; k < 4; k++) data[dst + k] = img.data[src + k];
            if (img.data[src + 3] !== 0) ink = Math.max(ink, x + 1);
          }
        }
        engine.bitmapGlyphs.set(char, {
          kind: "bitmap", w: cw, h: ch, f: scale, ascent: def.ascent, data,
          advance: Math.floor(0.5 + ink * scale) + 1, file: def.file,
        });
      });
    });
  }
}

/** Rastert ein Zeichen der Minecraft-Schrift auf das Halbpixel-Raster (18 Einheiten/em, 1 MC-Pixel = 2 Einheiten). */
function rasterizeChar(char) {
  const font = `${18 * RASTER_K}px ${MC_FONT}`;
  rasterCtx.font = font;
  const advUnits = rasterCtx.measureText(char).width / RASTER_K;
  const w = Math.max(1, Math.ceil(advUnits) + 2), h = 16;
  rasterCanvas.width = w * RASTER_K;
  rasterCanvas.height = h * RASTER_K;
  rasterCtx.font = font;
  rasterCtx.textBaseline = "alphabetic";
  rasterCtx.fillStyle = "#fff";
  rasterCtx.fillText(char, -RASTER_K, 14 * RASTER_K); // Tinte beginnt bei x = 1 Einheit, Baseline 7 px unter Oberkante
  const px = rasterCtx.getImageData(0, 0, w * RASTER_K, h * RASTER_K).data;
  const data = new Uint8ClampedArray(w * h * 4);
  let inked = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = px[((y * RASTER_K + RASTER_K / 2) * w * RASTER_K + x * RASTER_K + RASTER_K / 2) * 4 + 3];
      if (a >= 128) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 255;
        inked = true;
      }
    }
  }
  return { kind: "mask", w, h, f: 0.5, ascent: 7, data, advance: inked ? (advUnits - 1) / 2 : advUnits / 2 };
}

function getGlyph(char) {
  if (engine.spaces.has(char)) return { kind: "space", advance: engine.spaces.get(char) };
  const bitmap = engine.bitmapGlyphs.get(char);
  if (bitmap) return bitmap;
  let mask = engine.maskGlyphs.get(char);
  if (!mask) {
    mask = rasterizeChar(char);
    engine.maskGlyphs.set(char, mask);
  }
  return mask;
}

function obfuscatedChar(char, glyph) {
  if (glyph.kind === "space") return char;
  if (!engine.obfuscatePool) {
    const pool = new Map();
    const add = (c) => {
      const g = getGlyph(c);
      const key = g.kind + ":" + g.advance;
      if (!pool.has(key)) pool.set(key, []);
      pool.get(key).push(c);
    };
    for (let c = 33; c < 127; c++) add(String.fromCharCode(c));
    for (const c of engine.bitmapGlyphs.keys()) if (c !== BITMAP_BACKGROUND) add(c);
    engine.obfuscatePool = pool;
  }
  const list = engine.obfuscatePool.get(glyph.kind + ":" + glyph.advance);
  return list ? list[Math.floor(Math.random() * list.length)] : char;
}

/* ---------- Renderer ---------- */

/** Minecraft-Textschatten: Farbe / 4, gleiche Deckkraft */
const defaultShadow = (rgb) => ((0xFF << 24) | ((rgb & 0xFCFCFC) >> 2)) >>> 0;

function layoutLine(runs, shadowsEnabled) {
  const ops = [];
  let x = 0, obfuscated = false;
  for (const { ch, style } of runs) {
    let glyph = getGlyph(ch);
    if (style.obfuscated) {
      obfuscated = true;
      glyph = getGlyph(obfuscatedChar(ch, glyph));
    }
    const bold = !!style.bold;
    const advance = glyph.advance + (bold ? 1 : 0);
    const color = ((0xFF << 24) | style.color) >>> 0;
    let shadow = null;
    if (style.shadow != null) shadow = (style.shadow >>> 24) ? style.shadow : null;
    else if (shadowsEnabled) shadow = defaultShadow(style.color);

    if (glyph.kind !== "space") ops.push({ type: "glyph", glyph, x, bold, italic: !!style.italic, color, shadow });
    if (style.strikethrough) ops.push({ type: "rect", x: x - 1, y: 3.5, w: advance + 1, h: 1, color, shadow });
    if (style.underlined) ops.push({ type: "rect", x: x - 1, y: 8, w: advance + 1, h: 1, color, shadow });
    x += advance;
  }
  return { ops, width: x, obfuscated };
}

function blendPixel(d, i, r, g, b, a) {
  if (a <= 0) return;
  const da = d[i + 3] / 255;
  const oa = a + da * (1 - a);
  d[i] = (r * a + d[i] * da * (1 - a)) / oa;
  d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa;
  d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa;
  d[i + 3] = oa * 255;
}

const argbParts = (argb) => [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, ((argb >>> 24) & 255) / 255];

function fillRect(buf, R, x, y, w, h, argb) {
  const [r, g, b, a] = argbParts(argb);
  const x0 = Math.max(0, Math.round(x * R)), x1 = Math.min(buf.width, Math.round((x + w) * R));
  const y0 = Math.max(0, Math.round(y * R)), y1 = Math.min(buf.height, Math.round((y + h) * R));
  for (let Y = y0; Y < y1; Y++) for (let X = x0; X < x1; X++) blendPixel(buf.data, (Y * buf.width + X) * 4, r, g, b, a);
}

function drawGlyph(buf, R, glyph, ox, oy, argb, italic) {
  const [cr, cg, cb, ca] = argbParts(argb);
  const top = oy + 7 - glyph.ascent;
  const gw = glyph.w * glyph.f, gh = glyph.h * glyph.f;
  const y0 = Math.max(0, Math.floor(top * R)), y1 = Math.min(buf.height, Math.ceil((top + gh) * R));
  const x0 = Math.max(0, Math.floor((ox - 1.5) * R)), x1 = Math.min(buf.width, Math.ceil((ox + gw + 1.5) * R));
  const d = buf.data, t = glyph.data;
  for (let Y = y0; Y < y1; Y++) {
    const my = (Y + 0.5) / R;
    const v = my - top;
    if (v < 0 || v >= gh) continue;
    const ty = Math.floor(v / glyph.f);
    const shear = italic ? 1 - 0.25 * (my - oy) : 0;
    for (let X = x0; X < x1; X++) {
      const u = (X + 0.5) / R - ox - shear;
      if (u < 0 || u >= gw) continue;
      const ti = (ty * glyph.w + Math.floor(u / glyph.f)) * 4;
      const a = (t[ti + 3] / 255) * ca;
      if (a <= 0) continue;
      blendPixel(d, (Y * buf.width + X) * 4, (t[ti] * cr) / 255, (t[ti + 1] * cg) / 255, (t[ti + 2] * cb) / 255, a);
    }
  }
}

function drawOps(buf, R, ops, ox, oy, pass) {
  for (const op of ops) {
    const shadowPass = pass === "shadow";
    if (shadowPass && op.shadow == null) continue;
    const color = shadowPass ? op.shadow : op.color;
    const dx = shadowPass ? 1 : 0, dy = shadowPass ? 1 : 0;
    if (op.type === "rect") {
      fillRect(buf, R, ox + op.x + dx, oy + op.y + dy, op.w, op.h, color);
      continue;
    }
    drawGlyph(buf, R, op.glyph, ox + op.x + dx, oy + dy, color, op.italic);
    if (op.bold) drawGlyph(buf, R, op.glyph, ox + op.x + dx + 1, oy + dy, color, op.italic);
  }
}

/**
 * scene: { width, height, fills: [{x,y,w,h,argb}], lines: [{x, y, layout}] } in MC-Pixeln.
 * Zeichnet zuerst alle Schatten einer Zeile, dann die Glyphen (wie Minecraft).
 */
function renderScene(canvas, scene, scale) {
  const dpr = window.devicePixelRatio || 1;
  const R = Math.max(1, Math.round(scale * dpr));
  const W = Math.max(1, Math.ceil(scene.width * R)), H = Math.max(1, Math.ceil(scene.height * R));
  const buf = new ImageData(W, H);
  for (const f of scene.fills) fillRect(buf, R, f.x, f.y, f.w, f.h, f.argb);
  for (const line of scene.lines) {
    drawOps(buf, R, line.layout.ops, line.x, line.y, "shadow");
    drawOps(buf, R, line.layout.ops, line.x, line.y, "main");
  }
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${(W / R) * scale}px`;
  canvas.style.height = `${(H / R) * scale}px`;
  canvas.getContext("2d").putImageData(buf, 0, 0);
}

/* ---------- Szenen ---------- */

const CHAT_LINE_HEIGHT = 9;
const CHAT_BG = 0x7F000000; // textBackgroundOpacity 0.5

/** Freistehende Komponente (Bitmap-Vorschau) ohne Chat-Hintergrund */
function componentScene(component, shadowsEnabled, pad = 3) {
  const layouts = flatten(component).map((runs) => layoutLine(runs, shadowsEnabled));
  const width = Math.max(1, ...layouts.map((l) => l.width));
  return {
    width: width + pad * 2 + 1,
    height: layouts.length * CHAT_LINE_HEIGHT + pad * 2,
    fills: [],
    lines: layouts.map((layout, i) => ({ x: pad, y: pad + i * CHAT_LINE_HEIGHT, layout })),
    obfuscated: layouts.some((l) => l.obfuscated),
    layouts,
  };
}

/** Minecraft-Chat: fill(-4, top, width + 8, bottom), Text bei x = 0, y = top + 1 */
function chatScene(messages, chatWidth, shadowsEnabled) {
  const layouts = messages.flatMap((m) => flatten(m).map((runs) => layoutLine(runs, shadowsEnabled)));
  const content = Math.max(chatWidth, ...layouts.map((l) => l.width));
  const bgWidth = content + 12;
  return {
    width: bgWidth,
    height: layouts.length * CHAT_LINE_HEIGHT + 1,
    fills: layouts.map((_, i) => ({ x: 0, y: i * CHAT_LINE_HEIGHT, w: bgWidth, h: CHAT_LINE_HEIGHT, argb: CHAT_BG })),
    lines: layouts.map((layout, i) => ({ x: 4, y: i * CHAT_LINE_HEIGHT + 1, layout })),
    obfuscated: layouts.some((l) => l.obfuscated),
    layouts,
  };
}

/* ==========================================================================
 * UI
 * ========================================================================== */

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = el("textarea", { style: "position:fixed;opacity:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(msg);
}

const uid = () => Math.random().toString(36).slice(2, 10);

const slug = (s) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/* ---------- State ---------- */

function newBitmap(text = "", bg = "#000000", player = "Steve") {
  return { id: uid(), text, fg: "#FFFFFF", bg, shadowOn: false, shadow: "#000000", shadowAlpha: 255, affix: 2, player };
}

function defaultState() {
  const bitmaps = [
    newBitmap("Admin", "#EE3D51", "Notch"),
    newBitmap("Mod", "#6EA6D9", "jeb_"),
    newBitmap("Support", "#65D07A", "Dinnerbone"),
    newBitmap("Premium", "#FFA64D", "Steve"),
    newBitmap("Spieler", "#555555", "Alex"),
  ];
  return {
    bitmaps,
    selected: bitmaps[0].id,
    output: "minimessage",
    chat: {
      format: "<rank> <white><player></white> <dark_gray>»</dark_gray> <gray><message>",
      message: "Hallo zusammen!",
      autoRows: true,
      extra: "",
      width: 320,
    },
    render: { backgroundFile: "background.png", shadows: true },
  };
}

let state = loadState();
const scales = { preview: "auto", chat: "auto" };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const d = defaultState();
      return { ...d, ...s, chat: { ...d.chat, ...s.chat }, render: { ...d.render, ...s.render } };
    }
  } catch (_) { /* ignore */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
}

const selectedBitmap = () => state.bitmaps.find((b) => b.id === state.selected) ?? state.bitmaps[0];

function shadowArgb(b) {
  if (!b.shadowOn) return 0;
  const rgb = parseHex6(b.shadow) ?? 0;
  return (((Math.max(0, Math.min(255, b.shadowAlpha | 0))) << 24) | rgb) >>> 0;
}

/** Wie der Translate-Command: ungültige Farben fallen auf Weiß/Schwarz zurück */
function bitmapComponent(b) {
  return translateToComponent(
    b.text,
    parseHex6(b.fg) ?? 0xFFFFFF,
    parseHex6(b.bg) ?? 0x000000,
    shadowArgb(b),
    Math.max(0, parseInt(b.affix, 10) || 0),
  );
}

function bitmapKey(b) {
  return slug(b.text) || "bitmap";
}

function findBitmapRef(ref) {
  const r = String(ref).trim().toLowerCase();
  const idx = parseInt(r, 10);
  if (String(idx) === r && state.bitmaps[idx - 1]) return state.bitmaps[idx - 1];
  return state.bitmaps.find((b) => bitmapKey(b) === slug(r));
}

/* ---------- Analyse / Hinweise ---------- */

function analyzeBitmap(b) {
  const issues = [];
  const chars = b.text.toLowerCase().split("");
  if (!b.text) issues.push({ level: "warn", msg: "Kein Text eingegeben." });
  if (b.text !== b.text.toLowerCase()) issues.push({ level: "info", msg: "Großbuchstaben werden – wie im Provider – in Kleinbuchstaben umgewandelt." });

  const unknown = [...new Set(chars.filter((c) => findCharProvider(c).provider === "UnknownProvider"))];
  if (unknown.length) {
    const shown = unknown.map((c) => (c === " " ? "Leerzeichen" : `„${c}“`)).join(", ");
    issues.push({ level: "err", msg: `Nicht unterstützt: ${shown}. Wird vom UnknownProvider mit Breite 0 durchgereicht und mit der normalen Schrift gerendert – Hintergrund und Glyphen verschieben sich.` });
  }

  const mismatched = [...new Set(chars)].map(findCharProvider).filter((p) => {
    if (p.provider === "UnknownProvider") return false;
    const g = engine.bitmapGlyphs.get(p.char);
    return g && g.advance !== p.width;
  });
  if (mismatched.length) {
    const list = mismatched.map((p) => `„${p.source}“ (${engine.bitmapGlyphs.get(p.char).advance} statt ${p.width} px)`).join(", ");
    issues.push({ level: "warn", msg: `Glyph-Breite im Spiel weicht von der Provider-Breite ab: ${list}. Nachfolgende Glyphen laufen gegenüber dem Hintergrund auseinander.` });
  }

  if (parseHex6(b.fg) == null) issues.push({ level: "err", msg: "Ungültige Vordergrundfarbe – fällt auf Weiß zurück." });
  if (parseHex6(b.bg) == null) issues.push({ level: "err", msg: "Ungültige Hintergrundfarbe – fällt auf Schwarz zurück." });
  if (b.shadowOn && parseHex6(b.shadow) == null) issues.push({ level: "err", msg: "Ungültige Schattenfarbe – kein Schatten." });
  return issues;
}

/* ---------- Rendering: Bitmap-Liste ---------- */

function thumbCanvas(b) {
  const canvas = el("canvas", { class: "thumb" });
  renderScene(canvas, componentScene(bitmapComponent(b), state.render.shadows, 1), 2);
  return canvas;
}

function renderBitmapList() {
  const box = $("#bitmap-list");
  box.replaceChildren();
  state.bitmaps.forEach((b, i) => {
    const row = el("div", {
      class: "bitmap-row" + (b.id === state.selected ? " active" : ""),
      onclick: (e) => {
        if (e.target.closest("button")) return;
        state.selected = b.id;
        renderAll();
      },
    },
      el("span", { class: "line-no", text: i + 1 }),
      el("div", { class: "thumb-wrap" }, thumbCanvas(b)),
      el("div", { class: "bitmap-meta" },
        el("span", { class: "bitmap-name", text: b.text || "(leer)" }),
        el("span", { class: "mono muted", text: `<rank:${bitmapKey(b)}> · ${b.player || "–"}` }),
      ),
      el("div", { class: "line-tools" },
        el("button", {
          class: "btn subtle small", text: "Kopieren", title: "MiniMessage-String kopieren (ingame parsebar)",
          onclick: () => copyText(toMiniMessage(bitmapComponent(b)), `„${b.text}“ als MiniMessage kopiert`),
        }),
        el("button", { class: "icon-btn", title: "Nach oben", text: "↑", disabled: i === 0, onclick: () => moveBitmap(i, -1) }),
        el("button", { class: "icon-btn", title: "Nach unten", text: "↓", disabled: i === state.bitmaps.length - 1, onclick: () => moveBitmap(i, 1) }),
        el("button", { class: "icon-btn", title: "Duplizieren", text: "⧉", onclick: () => duplicateBitmap(i) }),
        el("button", { class: "icon-btn danger", title: "Entfernen", text: "✕", onclick: () => removeBitmap(i) }),
      ),
    );
    box.append(row);
  });
  $("#bitmap-count").textContent = `${state.bitmaps.length}`;
}

function moveBitmap(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= state.bitmaps.length) return;
  [state.bitmaps[i], state.bitmaps[j]] = [state.bitmaps[j], state.bitmaps[i]];
  renderAll();
}

function duplicateBitmap(i) {
  const copy = { ...state.bitmaps[i], id: uid() };
  state.bitmaps.splice(i + 1, 0, copy);
  state.selected = copy.id;
  renderAll();
}

function removeBitmap(i) {
  state.bitmaps.splice(i, 1);
  if (!state.bitmaps.length) state.bitmaps.push(newBitmap("Neu"));
  if (!state.bitmaps.some((b) => b.id === state.selected)) state.selected = state.bitmaps[Math.max(0, i - 1)].id;
  renderAll();
}

/* ---------- Editor ---------- */

function syncEditor() {
  const b = selectedBitmap();
  $("#bm-text").value = b.text;
  $("#bm-player").value = b.player;
  $("#bm-affix").value = b.affix;
  $("#bm-shadow-on").checked = b.shadowOn;
  $("#bm-shadow-alpha").value = b.shadowAlpha;
  for (const key of ["fg", "bg", "shadow"]) {
    $(`#bm-${key}`).value = b[key];
    const valid = parseHex6(b[key]);
    if (valid != null) $(`#bm-${key}-picker`).value = hex6(valid);
    $(`#bm-${key}`).classList.toggle("invalid", valid == null);
  }
  $("#shadow-fields").classList.toggle("disabled", !b.shadowOn);
}

function bindEditor() {
  const on = (sel, ev, fn) => $(sel).addEventListener(ev, fn);
  on("#bm-text", "input", (e) => { selectedBitmap().text = e.target.value; update(); });
  on("#bm-player", "input", (e) => { selectedBitmap().player = e.target.value; update(); });
  on("#bm-affix", "input", (e) => { selectedBitmap().affix = Math.max(0, Math.min(32, parseInt(e.target.value, 10) || 0)); update(); });
  on("#bm-shadow-on", "change", (e) => { selectedBitmap().shadowOn = e.target.checked; syncEditor(); update(); });
  on("#bm-shadow-alpha", "input", (e) => { selectedBitmap().shadowAlpha = Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0)); update(); });
  for (const key of ["fg", "bg", "shadow"]) {
    on(`#bm-${key}`, "input", (e) => {
      selectedBitmap()[key] = e.target.value.trim();
      const valid = parseHex6(e.target.value);
      e.target.classList.toggle("invalid", valid == null);
      if (valid != null) $(`#bm-${key}-picker`).value = hex6(valid);
      update();
    });
    on(`#bm-${key}-picker`, "input", (e) => {
      selectedBitmap()[key] = e.target.value.toUpperCase();
      $(`#bm-${key}`).value = selectedBitmap()[key];
      $(`#bm-${key}`).classList.remove("invalid");
      update();
    });
  }
  on("#bm-swap", "click", () => {
    const b = selectedBitmap();
    [b.fg, b.bg] = [b.bg, b.fg];
    syncEditor();
    update();
  });
  on("#add-bitmap", "click", () => {
    const b = newBitmap("Neu", "#555555");
    state.bitmaps.push(b);
    state.selected = b.id;
    renderAll();
    $("#bm-text").select();
  });
}

/* ---------- Zeichensatz ---------- */

function renderCharset() {
  const box = $("#charset");
  box.replaceChildren();
  for (const p of PROVIDERS) {
    for (const [source, cp] of p.map) {
      const glyph = engine.bitmapGlyphs.get(cp.char);
      const mismatch = glyph && glyph.advance !== cp.width;
      const canvas = el("canvas");
      renderScene(canvas, componentScene(translateToComponent(source, 0xFFFFFF, 0x3A3A41, 0, 1), false, 1), 2);
      const title = `${source}  →  U+${cp.char.charCodeAt(0).toString(16).toUpperCase()}\n${p.name} · Provider-Breite ${cp.width} px` +
        (glyph ? ` · Glyph-Advance ${glyph.advance} px` : "") + (mismatch ? "\nAbweichung – Hintergrund und Glyphen laufen auseinander" : "");
      box.append(el("button", {
        class: "glyph" + (mismatch ? " mismatch" : ""),
        title,
        onclick: () => {
          const input = $("#bm-text");
          const pos = input.selectionStart ?? input.value.length;
          input.setRangeText(source, pos, input.selectionEnd ?? pos, "end");
          selectedBitmap().text = input.value;
          input.focus();
          update();
        },
      }, canvas, el("span", { text: source })));
    }
  }
}

/* ---------- Ausgabe ---------- */

function outputText(b) {
  const c = bitmapComponent(b);
  switch (state.output) {
    case "escaped": return `"${quotedString(toMiniMessage(c))}"`;
    case "json": return escapeUnicode(JSON.stringify(toJsonObject(c)));
    case "tag": {
      const args = [`'${b.text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`, b.fg, b.bg];
      if (b.shadowOn || (parseInt(b.affix, 10) || 0) !== 2) args.push(b.shadowOn ? hex8(shadowArgb(b)) : "none");
      if ((parseInt(b.affix, 10) || 0) !== 2) args.push(String(b.affix));
      return `<bitmap:${args.join(":")}>\n<rank:${bitmapKey(b)}>`;
    }
    default: return toMiniMessage(c);
  }
}

const OUTPUT_HINTS = {
  minimessage: "Ingame parsebarer MiniMessage-String (wie der Klick auf die /translate-Ausgabe) – enthält die Font-Zeichen direkt. <shadow> braucht Adventure ≥ 4.18 / MC ≥ 1.21.4.",
  escaped: "Gleiche MiniMessage als String-Literal, Sonderzeichen als \\uXXXX – direkt in Kotlin/Java/YAML verwendbar.",
  json: "Text-Komponente als JSON (z. B. für /tellraw), shadow_color als ARGB-Int (ab 1.21.4).",
  tag: "Tags für die Chat-Vorschau: <bitmap:…> erzeugt eine Bitmap inline, <rank:key> verweist auf einen gespeicherten Eintrag.",
};

/* ---------- Chat ---------- */

function chatResolvers(entry) {
  const fallback = entry ?? selectedBitmap();
  return {
    rank: (args) => {
      if (!args.length) return bitmapComponent(fallback);
      const ref = findBitmapRef(args.join(":"));
      return ref ? bitmapComponent(ref) : null;
    },
    player: () => comp(fallback.player || "Steve"),
    message: () => comp(state.chat.message),
    bitmap: (args) => {
      if (!args.length) return null;
      const [text, fg, bg, shadow, affix] = args;
      const shadowValue = parseHex8(shadow) ?? (parseHex6(shadow) != null ? ((0xFF << 24) | parseHex6(shadow)) >>> 0 : 0);
      const affixValue = parseInt(affix, 10);
      return translateToComponent(text, parseHex6(fg) ?? 0xFFFFFF, parseHex6(bg) ?? 0x000000, shadowValue,
        Number.isFinite(affixValue) ? Math.max(0, affixValue) : 2);
    },
  };
}

/**
 * Ersetzt die Vorschau-Platzhalter (<rank>, <rank:key>, <bitmap:…>, <player>, <message>) textuell durch
 * MiniMessage – alles andere bleibt unverändert. Ergebnis kann ingame mit MiniMessage geparst werden.
 */
function resolveToMiniMessage(input, entry) {
  const fallback = entry ?? selectedBitmap();
  const replace = (name, args) => {
    switch (name) {
      case "rank": {
        const ref = args.length ? findBitmapRef(args.join(":")) : fallback;
        return ref ? toMiniMessage(bitmapComponent(ref)) : null;
      }
      case "bitmap": {
        const c = chatResolvers(entry).bitmap(args);
        return c ? toMiniMessage(c) : null;
      }
      case "player": return escapeMiniMessage(fallback.player || "Steve");
      case "message": return escapeMiniMessage(state.chat.message);
      default: return null;
    }
  };
  let out = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] === "\\" && (input[i + 1] === "<" || input[i + 1] === "\\")) {
      out += input.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (input[i] === "<") {
      const tag = readTag(input, i);
      if (tag && !tag.parts[0].startsWith("/")) {
        const replaced = replace(tag.parts[0].toLowerCase(), tag.parts.slice(1));
        if (replaced != null) {
          out += replaced;
          i = tag.end;
          continue;
        }
      }
      if (tag && /^\/(rank|bitmap|player|message)$/i.test(tag.parts[0])) { i = tag.end; continue; }
    }
    out += input[i++];
  }
  return out;
}

/** Quell-Zeilen der Chat-Vorschau: [{ label, source, entry }] */
function chatSources() {
  const sources = [];
  if (state.chat.autoRows) {
    for (const b of state.bitmaps) sources.push({ label: b.text || "(leer)", source: state.chat.format, entry: b });
  }
  for (const line of state.chat.extra.split("\n")) {
    if (line.trim()) sources.push({ label: "Zeile", source: line, entry: null });
  }
  return sources;
}

function renderChatLines() {
  const box = $("#chat-lines");
  const items = chatSources().map((s) => ({ ...s, mm: resolveToMiniMessage(s.source, s.entry) }));
  box.replaceChildren(...items.map((item, i) => el("div", { class: "line" },
    el("span", { class: "line-no", text: i + 1 }),
    el("code", { class: "mm-line", title: escapeUnicode(item.mm), text: item.mm }),
    el("div", { class: "line-tools" },
      el("button", { class: "btn subtle small", text: "Kopieren", onclick: () => copyText(item.mm, `Zeile ${i + 1} als MiniMessage kopiert`) }),
    ),
  )));
  $("#btn-copy-chat").hidden = !items.length;
  $("#btn-copy-chat").onclick = () => copyText(items.map((x) => x.mm).join("\n") + "\n", `${items.length} Zeilen als MiniMessage kopiert`);
}

function chatMessages() {
  const messages = [];
  if (state.chat.autoRows) {
    for (const b of state.bitmaps) messages.push(parseMiniMessage(state.chat.format, chatResolvers(b)));
  }
  for (const line of state.chat.extra.split("\n")) {
    if (line.trim()) messages.push(parseMiniMessage(line, chatResolvers(null)));
  }
  return messages;
}

/* ---------- GUI-Scale ---------- */

function pickScale(setting, stage, widthMc, max) {
  if (setting !== "auto") return Number(setting);
  const style = getComputedStyle(stage);
  const available = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return Math.max(1, Math.min(max, Math.floor(available / Math.max(1, widthMc))));
}

/* ---------- Main update ---------- */

let obfuscationTimer = null;

function renderPreviews() {
  const b = selectedBitmap();

  const preview = componentScene(bitmapComponent(b), state.render.shadows);
  const previewScale = pickScale(scales.preview, $("#preview-stage"), preview.width, 8);
  renderScene($("#preview-canvas"), preview, previewScale);
  const bitmapWidth = preview.layouts[0]?.width ?? 0;
  $("#preview-info").textContent = `GUI-Scale ${previewScale} · Breite ${bitmapWidth} px`;

  const messages = chatMessages();
  const chat = chatScene(messages, state.chat.width, state.render.shadows);
  const chatScale = pickScale(scales.chat, $("#chat-stage"), chat.width, 4);
  renderScene($("#chat-canvas"), chat, chatScale);
  $("#chat-canvas").hidden = !chat.layouts.length;
  $("#chat-empty").hidden = chat.layouts.length > 0;
  const tooWide = chat.layouts.map((l, i) => [i + 1, l.width]).filter(([, w]) => w > state.chat.width);
  $("#chat-info").textContent = `GUI-Scale ${chatScale} · ${chat.layouts.length} Zeile${chat.layouts.length === 1 ? "" : "n"}`;
  $("#chat-note").textContent = tooWide.length
    ? `Zeile ${tooWide.map(([i, w]) => `${i} (${w} px)`).join(", ")} breiter als der Chat (${state.chat.width} px) – Minecraft würde umbrechen.`
    : "";

  clearInterval(obfuscationTimer);
  obfuscationTimer = null;
  if (preview.obfuscated || chat.obfuscated) obfuscationTimer = setInterval(renderPreviews, 100);
}

function update() {
  const b = selectedBitmap();

  // Hinweise
  const issues = analyzeBitmap(b);
  const list = $("#issues");
  list.replaceChildren(...(issues.length
    ? issues.map((x) => el("li", { class: x.level, text: x.msg }))
    : [el("li", { class: "ok", text: "Alle Zeichen werden vom Provider unterstützt." })]));
  const errs = issues.filter((x) => x.level === "err").length;
  const warns = issues.filter((x) => x.level === "warn").length;
  const badge = $("#validation-badge");
  badge.className = "badge " + (errs ? "err" : warns ? "warn" : "ok");
  badge.textContent = errs ? `${errs} Fehler` : warns ? `${warns} Hinweis${warns > 1 ? "e" : ""}` : "OK";

  // Ausgabe
  $("#output").textContent = outputText(b);
  $("#output-hint").textContent = OUTPUT_HINTS[state.output];
  $("#output-tabs").querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", btn.dataset.out === state.output));
  $("#rank-key").textContent = `<rank:${bitmapKey(b)}>`;

  // Liste (Thumbnails) – nur die aktive Zeile neu zeichnen
  const idx = state.bitmaps.indexOf(b);
  const row = $("#bitmap-list").children[idx];
  if (row) {
    row.querySelector(".thumb-wrap").replaceChildren(thumbCanvas(b));
    row.querySelector(".bitmap-name").textContent = b.text || "(leer)";
    row.querySelector(".bitmap-meta .mono").textContent = `<rank:${bitmapKey(b)}> · ${b.player || "–"}`;
  }

  renderPreviews();
  renderChatLines();
  saveState();
}

function renderAll() {
  renderBitmapList();
  syncEditor();
  update();
}

/* ---------- Chat- und Render-Einstellungen ---------- */

function bindChat() {
  const format = $("#chat-format"), message = $("#chat-message"), extra = $("#chat-extra");
  format.value = state.chat.format;
  message.value = state.chat.message;
  extra.value = state.chat.extra;
  $("#chat-auto").checked = state.chat.autoRows;
  $("#chat-width").value = state.chat.width;
  $("#render-shadows").checked = state.render.shadows;

  format.addEventListener("input", () => { state.chat.format = format.value; update(); });
  message.addEventListener("input", () => { state.chat.message = message.value; update(); });
  extra.addEventListener("input", () => { state.chat.extra = extra.value; update(); });
  $("#chat-auto").addEventListener("change", (e) => {
    state.chat.autoRows = e.target.checked;
    $("#chat-format-fields").classList.toggle("disabled", !state.chat.autoRows);
    update();
  });
  $("#chat-format-fields").classList.toggle("disabled", !state.chat.autoRows);
  $("#chat-width").addEventListener("input", (e) => {
    state.chat.width = Math.max(40, Math.min(1000, parseInt(e.target.value, 10) || 320));
    update();
  });
  $("#render-shadows").addEventListener("change", (e) => {
    state.render.shadows = e.target.checked;
    renderAll();
  });

  const bgSelect = $("#render-bg");
  for (const [file, label] of Object.entries(BACKGROUND_TEXTURES)) bgSelect.append(el("option", { value: file, text: label }));
  bgSelect.value = state.render.backgroundFile;
  bgSelect.addEventListener("change", () => {
    state.render.backgroundFile = bgSelect.value;
    engine.backgroundFile = bgSelect.value;
    buildBitmapGlyphs();
    renderAll();
  });

  document.querySelectorAll("[data-insert]").forEach((btn) => btn.addEventListener("click", () => {
    const target = state.chat.autoRows ? format : extra;
    const pos = target.selectionStart ?? target.value.length;
    target.setRangeText(btn.dataset.insert, pos, target.selectionEnd ?? pos, "end");
    target.dispatchEvent(new Event("input"));
    target.focus();
  }));
}

function bindScale(groupSel, key) {
  $(groupSel).addEventListener("click", (e) => {
    const value = e.target.dataset?.scale;
    if (!value) return;
    scales[key] = value;
    $(groupSel).querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", btn === e.target));
    renderPreviews();
  });
}

/* ---------- Buttons / Import / Export ---------- */

function bindButtons() {
  $("#output-tabs").addEventListener("click", (e) => {
    const out = e.target.dataset?.out;
    if (!out) return;
    state.output = out;
    update();
  });
  $("#btn-copy").addEventListener("click", () => copyText($("#output").textContent, "In die Zwischenablage kopiert"));
  $("#btn-copy-all").addEventListener("click", () => {
    const lines = state.bitmaps.map((b) => `${bitmapKey(b)}: "${quotedString(toMiniMessage(bitmapComponent(b)))}"`);
    copyText(lines.join("\n") + "\n", `${state.bitmaps.length} Bitmaps als YAML kopiert`);
  });

  bindScale("#preview-scale", "preview");
  bindScale("#chat-scale", "chat");
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === lastWidth) return;
    lastWidth = entry.contentRect.width;
    renderPreviews();
  }).observe($("#chat-stage"));

  $("#btn-reset").addEventListener("click", () => {
    if (!confirm("Alle Bitmaps und Einstellungen verwerfen?")) return;
    state = defaultState();
    engine.backgroundFile = state.render.backgroundFile;
    buildBitmapGlyphs();
    bindChatValues();
    renderAll();
    toast("Zurückgesetzt");
  });

  $("#btn-export").addEventListener("click", () => {
    const data = {
      bitmaps: state.bitmaps.map(({ id, ...b }) => ({ ...b, minimessage: toMiniMessage(bitmapComponent(b)) })),
      chat: state.chat,
    };
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "surf-bitmaps.json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("surf-bitmaps.json heruntergeladen");
  });

  const fileInput = $("#file-import");
  $("#btn-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.bitmaps) || !data.bitmaps.length) throw new Error("Keine Bitmaps gefunden");
      state.bitmaps = data.bitmaps.map((b) => ({ ...newBitmap(), ...b, id: uid() }));
      state.selected = state.bitmaps[0].id;
      if (data.chat) state.chat = { ...state.chat, ...data.chat };
      bindChatValues();
      renderAll();
      toast(`${state.bitmaps.length} Bitmaps importiert`);
    } catch (err) {
      alert("Konnte Datei nicht lesen: " + err.message);
    }
  });
}

function bindChatValues() {
  $("#chat-format").value = state.chat.format;
  $("#chat-message").value = state.chat.message;
  $("#chat-extra").value = state.chat.extra;
  $("#chat-auto").checked = state.chat.autoRows;
  $("#chat-width").value = state.chat.width;
  $("#render-shadows").checked = state.render.shadows;
  $("#render-bg").value = state.render.backgroundFile;
  $("#chat-format-fields").classList.toggle("disabled", !state.chat.autoRows);
}

/* ---------- Init ---------- */

async function init() {
  engine.backgroundFile = state.render.backgroundFile in BACKGROUND_TEXTURES ? state.render.backgroundFile : "background.png";
  await loadTextures();
  try {
    await Promise.all([
      document.fonts.load(`${18 * RASTER_K}px "Minecraft Preview"`),
      document.fonts.load(`${18 * RASTER_K}px "Minecraft Preview Extra"`, "ᴀ"),
    ]);
  } catch (_) { /* Fallback-Schrift */ }

  bindEditor();
  bindChat();
  bindButtons();
  renderCharset();
  renderAll();
}

init();
