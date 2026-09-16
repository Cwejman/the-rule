// surface.ts — the surface: one page that reads knowledge written under the code.
//
// # 1. What it is and how it is run
//
// One file serves two moments of a repository. Run against a path in a working
// tree it serves the page live and tells it when a file changes; run once with
// a flag it writes the page with the body inside, and that is all a pipeline
// does on each commit. The file is laid by the gradient, as a brief is: what it
// is and how it runs, then how the body is assembled, then how it is drawn,
// with the details beneath each. Its sections carry numbered headings in
// comments, so it is read by depth like anything else under the code.
//
//   bun surface.ts <path>                  serve live, http://localhost:4141
//   bun surface.ts <path> --port 8080      serve on another port
//   bun surface.ts <path> --build [out]    write the page, default ./surface.html
//   bun surface.ts <path> --check          trace only, print the warnings
//
// <path> is a stamped README.md, a folder holding one, or a single stamped file.
// The surface never reads above it: the root is the body.
//
// Two parts of this file are handed to the browser as well: the substrate the
// two sides share (2.1) and the drawing (3). The server slices them out of this
// very file and strips the types, so nothing is declared twice.
//
// For taste, the code follows the sister project's principles: simple and
// coherent, declarative over imperative, data over logic, pure functions with
// their side effects kept apart, flat data with one source of truth.

import { readFileSync, existsSync, statSync, writeFileSync, watch, openSync, readSync, closeSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, relative, join, sep, basename } from "node:path";
import { marked } from "marked";

const PORT = 4141;

/** The length of visible text past which the practice asks that a brief's face be read again. */
const FACE_FLAG = 400;

// ## 1.1 The run

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (f: string) => args.indexOf(f);
  const root = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--port" && args[i - 1] !== "--build");
  if (!root) {
    console.error("usage: bun surface.ts <path> [--port N | --build [out.html] | --check]");
    process.exit(2);
  }
  if (flag("--check") >= 0) {
    const body = await trace(root);
    console.log(`${body.briefs.length} briefs traced from ${body.root}`);
    body.warnings.forEach((w) => console.log("  " + w));
    const borrows = body.briefs.filter((b) => b.borrow !== undefined);
    if (borrows.length) console.log(`${borrows.length} borrow${borrows.length === 1 ? "" : "s"}:\n${borrows.map((b) => `  ${b.file} ${b.number} "${b.title}" borrows ${b.borrow || "the root"}`).join("\n")}`);
    const sets = body.briefs.filter((b) => b.set);
    if (sets.length) console.log(`${sets.length} level${sets.length === 1 ? "" : "s"} of letters: ${sets.map((b) => `${b.file} ${b.number || "·"}`).join(", ")}`);
    // faces past the practice's flag are listed apart from the warnings, since each is read and may be left with a reason
    const long = body.briefs.flatMap((b) => {
      const face = textOf(b.body.filter((t) => t.type !== "space").slice(0, 1)).length;
      return face > FACE_FLAG ? [`${b.file} ${b.number || "·"} "${b.title}": a face of ${face}`] : [];
    });
    if (long.length) console.log(`${long.length} face${long.length === 1 ? "" : "s"} past ${FACE_FLAG} characters, to be read:\n${long.map((l) => "  " + l).join("\n")}`);
    return;
  }
  if (flag("--build") >= 0) {
    const next = args[flag("--build") + 1];
    return build(root, next && !next.startsWith("--") && next !== root ? next : "surface.html");
  }
  const p = flag("--port") >= 0 ? Number(args[flag("--port") + 1]) : PORT;
  return serve(root, p);
}

// ## 1.2 The page
//
// The page is one HTML document: the style, the body when published, and the
// script. The script is this file's own sections 2.1 and 3, transpiled.

async function clientScript(): Promise<string> {
  const src = await Bun.file(import.meta.path).text();
  const between = (from: string, to: string) => {
    const a = src.search(new RegExp(`^// ${from} `, "m"));
    const b = src.search(new RegExp(`^// ${to} `, "m"));
    if (a < 0 || b < 0 || b < a) throw new Error(`cannot slice ${from} to ${to} out of this file`);
    return src.slice(a, b);
  };
  const ts = `${between("## 2\\.1", "## 2\\.2")}\n${between("# 3\\.", "## 3\\.16")}`;
  const js = new Bun.Transpiler({ loader: "ts", target: "browser" }).transformSync(ts);
  if (js.includes("</script")) throw new Error("the client script would close its own tag");
  return js;
}

/** The page, with the body inside it when one is given. */
function page(body: Body | null, script: string): string {
  const title = body?.title || "The surface";
  const data = body ? `<script type="application/json" id="substrate">${JSON.stringify(body).replace(/</g, "\\u003c")}</script>\n` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700&family=Source+Sans+3:ital,wght@0,300..700;1,300..700&family=Source+Code+Pro:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${data}<script>${script}</script>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ## 1.3 Live
//
// One process answers four requests: the page, the body as JSON, a stream that
// says when a file under the root changed, and the images the body holds. The
// body is assembled again whole on any change, which a body this size allows.

async function serve(rootArg: string, port: number): Promise<void> {
  const rootDir = dirname(rootFileOf(rootArg));
  const script = await clientScript();
  // the page a process serves, named, so a page left open across a restart with new code knows to load it
  const version = `version ${Bun.hash(script).toString(36)}`;
  const listeners = new Set<(s: string) => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // a change to the markdown or to an image the body may hold is a change to the body
  watch(rootDir, { recursive: true }, (_event, name) => {
    if (name && !/\.md$/i.test(String(name)) && !imageType(String(name))) return;
    clearTimeout(timer);
    timer = setTimeout(() => listeners.forEach((send) => send("change")), 120);
  });

  const changes = () => {
    let send: (s: string) => void;
    const stream = new ReadableStream({
      start(controller) {
        send = (s) => controller.enqueue(`data: ${s}\n\n`);
        listeners.add(send);
        controller.enqueue(": open\n\n");
        send(version);
      },
      cancel() {
        listeners.delete(send);
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  };

  // an image is served only when the last trace reached it, so nothing else under the root is handed out
  let held = new Set<string>();
  const retrace = async (): Promise<Body> => {
    const b = await trace(rootArg);
    b.warnings.forEach((w) => console.warn("  " + w));
    held = new Set(assetsOf(b));
    return b;
  };
  const body = async () => Response.json(await retrace());
  const asset = (path: string) => {
    const file = decodeURIComponent(path.slice("/asset/".length));
    return held.has(file) ? new Response(Bun.file(join(rootDir, file)), { headers: { "cache-control": "no-cache" } }) : new Response("not an image the body holds", { status: 404 });
  };

  await retrace();
  const routes: Record<string, () => Response | Promise<Response>> = { "/body": body, "/changes": changes };
  Bun.serve({
    port,
    idleTimeout: 0, // the change stream stays open as long as the page does
    fetch: (req) => {
      const path = new URL(req.url).pathname;
      if (path.startsWith("/asset/")) return asset(path);
      return (routes[path] ?? (() => new Response(page(null, script), { headers: { "content-type": "text/html; charset=utf-8" } })))();
    },
  });
  console.log(`the surface reads ${rootDir}\n  http://localhost:${port}/`);
}

// ## 1.4 Published
//
// The same process runs once and writes the page with the body inside it, in a
// script tag that holds data rather than code. Every `<` in the JSON is written
// as \u003c, so a brief containing the closing tag cannot end it early. Images
// other than sketches are written beside the page.

async function build(rootArg: string, out: string): Promise<void> {
  const body = await trace(rootArg);
  body.warnings.forEach((w) => console.warn("  " + w));
  // a sketch is already inside, as markup; every other image the body holds as a file is written beside the page at the
  // path it has in the body, and its address carries a hash of its bytes, so a changed image is fetched again. A remote
  // image stays remote, since it may change after the build
  const rootDir = dirname(rootFileOf(rootArg));
  const outDir = dirname(resolve(out));
  const images = body.briefs.flatMap((b) => b.body).filter((t) => t.type === "image" && t.asset && !t.svg);
  const written = new Set<string>();
  images.forEach((t) => {
    const from = join(rootDir, t.asset!);
    const to = join(outDir, t.asset!);
    if (!written.has(to) && resolve(from) !== resolve(to)) (mkdirSync(dirname(to), { recursive: true }), copyFileSync(from, to));
    written.add(to);
    t.src = `${t.asset!.split("/").map(encodeURIComponent).join("/")}?v=${Bun.hash(readFileSync(from)).toString(36)}`;
  });
  writeFileSync(out, page(body, await clientScript()));
  console.log(`${body.briefs.length} briefs from ${body.root} → ${out}${written.size ? `, ${written.size} image${written.size === 1 ? "" : "s"} written beside it` : ""}`);
}

// # 2. How the body is assembled
//
// A program should receive structure, never recover it. This section reads the
// stamped files once, traces the body from the root by its mounts, gives every
// brief its address, and rewrites every link to the address it reaches. The
// page is handed the result and never sees markdown.

// ## 2.1 The substrate both sides stand on
//
// The body is a flat list of briefs in reading order, each carrying its
// address, its title, the file it came from and its prose as parsed tokens.
// Everything else follows from those, so these are the only types there are,
// and the few functions beneath them follow from the types alone. This part
// imports nothing and touches no file, since the browser receives it verbatim.

/** A parsed markdown token, structurally: what marked produces, and what the trace adds to a link. */
type Tok = {
  type: string;
  text?: string;
  tokens?: Tok[];
  items?: Tok[];
  header?: Tok[];
  rows?: Tok[][];
  align?: (string | null)[];
  ordered?: boolean;
  start?: number | string;
  loose?: boolean;
  depth?: number;
  href?: string;
  title?: string | null;
  lang?: string;
  /** set by the trace on a link that stays in the body: the address it reaches */
  to?: string;
  /** set by the trace on a link that leaves it: the web, a file outside the body, or a brief not yet written */
  out?: "web" | "outside" | "owed";
  /** set by the trace on an image it reached: where the page loads it from */
  src?: string;
  /** set by the trace on an image that is a file in the body: its path from the root's directory */
  asset?: string;
  /** set by the trace on an image whose size it could read: its own size, in pixels */
  width?: number;
  height?: number;
  /** set by the cut on an image block: the text written beneath it in its paragraph */
  caption?: Tok[];
  /** set by the cut on an image block whose text beneath follows a plain line break rather than a backslash */
  soft?: boolean;
  /** set by the trace on a sketch: its markup, cleaned of anything that could run, to be set into the page */
  svg?: string;
};

/** One brief: its place, its face and its own prose. */
type Brief = {
  /** the titles on the way down from the root, slugged and joined by slashes; the root's is "" */
  address: string;
  /** the heading without its number */
  title: string;
  /** the number derived from its place, "3.2"; "" for the root */
  number: string;
  /** the number the heading carries as written, "" if none */
  written: string;
  /** the file it came from, relative to the root's directory */
  file: string;
  /** the file's stamp: brief, record, directive */
  kind: string;
  /** its own prose, links rewritten; the mount paragraph removed */
  body: Tok[];
  /** whether a level stands beneath it, by subsections or by a mount */
  door: boolean;
  /** set by the trace when the brief's level is a set of letters: no brief of it stands on another */
  set?: boolean;
  /** set by the trace when the brief's lone link names a level already placed elsewhere: the address of its home */
  borrow?: string;
};

/** The body: every brief in reading order, and what the trace had to say. */
type Body = {
  title: string;
  root: string;
  briefs: Brief[];
  warnings: string[];
  traced: string;
};

/** GitHub's anchor for a heading, which is also how an address segment is written. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");

/** The text a reader sees in a run of tokens: no syntax, no link targets, and of an image only the text beneath it, since an image is not text. */
const textOf = (toks: Tok[] = []): string =>
  toks
    .map((t) =>
      t.type === "image"
        ? textOf(t.caption)
        : t.type === "space" || t.type === "hr"
        ? ""
        : t.type === "table"
          ? textOf(t.header) + (t.rows ?? []).map((r) => textOf(r)).join("")
          : t.tokens
            ? textOf(t.tokens)
            : t.items
              ? textOf(t.items)
              : (t.text ?? ""),
    )
    .join("");

/**
 * The heading's number as written and its title without it. A segment is digits for a step, or letters for a brief of a
 * set, 4.a; a lone letter counts only with its period, a., so a heading that begins with a word is never read as one.
 */
const splitHeading = (text: string): { written: string; title: string } => {
  const m = /^(\d+(?:\.(?:\d+|[a-z]{1,2}))*\.?|[a-z]{1,2}\.)\s+(.*)$/.exec(text.trim());
  return m ? { written: m[1].replace(/\.$/, ""), title: m[2].trim() } : { written: "", title: text.trim() };
};

/** The letter of a place in a set: a to z, then aa, as columns are lettered. */
const letterOf = (i: number): string => (i >= 26 ? letterOf(Math.floor(i / 26) - 1) : "") + String.fromCharCode(97 + (i % 26));

/** Whether a written number's last segment is a letter. */
const isLettered = (written: string): boolean => /[a-z]+$/.test(written);

/** The address one level up; the root's parent is the root. */
const parentOf = (address: string): string => address.slice(0, Math.max(0, address.lastIndexOf("/")));

/** The depth of an address: the root is 0. */
const depthOf = (address: string): number => (address === "" ? 0 : address.split("/").length);

/** The addresses on the way to an address, the root first. */
const prefixesOf = (address: string): string[] =>
  address === "" ? [""] : ["", ...address.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"))];

/** The blocks of a brief's prose: every token that is not spacing. */
const blocksOf = (b: Brief): Tok[] => b.body.filter((t) => t.type !== "space");

/** Every token of a kind in a run, however deep. */
const tokensIn = (type: string, toks: Tok[] = []): Tok[] =>
  toks.flatMap((t) => [
    ...(t.type === type ? [t] : []),
    ...tokensIn(type, t.tokens),
    ...tokensIn(type, t.caption),
    ...tokensIn(type, t.items),
    ...tokensIn(type, Array.isArray(t.header) ? t.header : []),
    ...(t.rows ?? []).flatMap((r) => tokensIn(type, r)),
  ]);

/** Every link token in a run, however deep. */
const linksIn = (toks: Tok[] = []): Tok[] => tokensIn("link", toks);

/** A paragraph's inline tokens without the blank text between them. */
const bare = (t: Tok | undefined): Tok[] => (t?.tokens ?? []).filter((x) => !(x.type === "text" && (x.text ?? "").trim() === ""));

/** Whether a link's target is a web address: only the schemes a page may safely follow. */
const isWeb = (href: string): boolean => /^(https?:|mailto:)/i.test(href);

// ## 2.2 A file says it is under the code

/** Frontmatter as key: value lines between two rules, and the markdown after it. */
function stamped(src: string): { front: Record<string, string>; rest: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return null;
  const front = Object.fromEntries(
    m[1].split(/\r?\n/).flatMap((line) => {
      const kv = /^([\w-]+):\s*(.*)$/.exec(line);
      return kv ? [[kv[1], kv[2].trim()]] : [];
    }),
  );
  return front["under"] === "the code" ? { front, rest: src.slice(m[0].length) } : null;
}

/** A path as handed: a folder means its entry file. */
const entryOf = (abs: string): string => (existsSync(abs) && statSync(abs).isDirectory() ? join(abs, "README.md") : abs);
const rootFileOf = (arg: string): string => entryOf(resolve(arg));

/** The tokens without their raw source, which the page never reads and which doubles the body. */
const lean = (toks: Tok[]): Tok[] => JSON.parse(JSON.stringify(toks, (k, v) => (k === "raw" ? undefined : v)));

// ## 2.3 A file is cut by its headings
//
// Before anything is traced, a file is cut into what the practice says it
// holds: a title, the prose before the first section, and the sections nested
// by heading depth. The cut is pure: it reads tokens and returns structure.

type Section = { depth: number; heading: string; body: Tok[]; children: Section[] };
type Cut = { title: string | null; lead: Tok[]; sections: Section[]; strays: string[] };

function cut(toks: Tok[]): Cut {
  const out: Cut = { title: null, lead: [], sections: [], strays: [] };
  const open: Section[] = []; // the chain of sections a token falls under, shallowest first
  toks.forEach((t) => {
    const isHeading = t.type === "heading";
    if (isHeading && t.depth === 1 && out.title === null) return void (out.title = textOf(t.tokens));
    if (isHeading && t.depth! >= 2) {
      const s: Section = { depth: t.depth!, heading: textOf(t.tokens), body: [], children: [] };
      open.length = open.findLastIndex((o) => o.depth < s.depth) + 1;
      (open.length ? open[open.length - 1].children : out.sections).push(s);
      return void open.push(s);
    }
    if (isHeading) out.strays.push(textOf(t.tokens));
    (open.length ? open[open.length - 1].body : out.lead).push(t);
  });
  return out;
}

/**
 * An image block: a paragraph that opens with an image, and holds nothing else or the text beneath it on the next line,
 * stands as the image with that text as its caption, so the page is handed a block of its own kind rather than a
 * paragraph to look inside. The text beneath follows a backslash, which every renderer breaks the line on; a plain line
 * break is taken too and marked, since a document renderer runs the text on beside a narrow image. An image anywhere
 * else stays where it is written.
 */
const imageBlocks = (toks: Tok[]): Tok[] =>
  toks.map((t) => {
    const inline = t.tokens ?? [];
    const blank = (x: Tok) => x.type === "text" && (x.text ?? "").trim() === "";
    const at = inline.findIndex((x) => !blank(x));
    if (t.type !== "paragraph" || inline[at]?.type !== "image") return t;
    const after = inline.slice(at + 1);
    if (after.every(blank)) return inline[at];
    const hard = after[0].type === "br";
    const soft = after[0].type === "text" && /^[ \t]*\n/.test(after[0].text ?? "");
    // text on the image's own line is running text, which the practice forbids, and the paragraph stays as written
    if (!hard && !soft) return t;
    const lead = hard ? [] : [{ ...after[0], text: (after[0].text ?? "").replace(/^\s+/, "") }].filter((x) => x.text !== "");
    const caption = [...lead, ...after.slice(1)];
    return { ...inline[at], ...(caption.length ? { caption } : {}), ...(soft ? { soft: true } : {}) };
  });

/** A mount: a paragraph that is nothing but one link, standing last in a brief. */
function mountOf(body: Tok[]): Tok | null {
  const last = body.findLast((t) => t.type !== "space");
  const inline = bare(last);
  const link = last?.type === "paragraph" && inline.length === 1 && inline[0].type === "link" ? inline[0] : null;
  return link && link.href && !/^[a-z]+:/i.test(link.href) ? link : null;
}

/** A body with its mount paragraph taken off. */
const withoutMount = (body: Tok[]): Tok[] => body.slice(0, body.findLastIndex((t) => t.type !== "space"));

// ## 2.4 It is traced from a root, by its mounts
//
// From the root the trace follows the mounts: every brief that ends with a
// lone link names a file or a folder's entry, and a stamped file named that
// way is read, cut and traced in turn, until nothing new is reached. So the
// body is whatever the root connects, and nothing is scanned. What the trace
// gathers on the way, the briefs, the warnings and the table of addresses,
// lives in this one function; everything it calls is pure.

async function trace(rootArg: string): Promise<Body> {
  const rootFile = rootFileOf(rootArg);
  const rootDir = dirname(rootFile);
  const briefs: Brief[] = [];
  const warnings: string[] = [];
  const table = new Map<string, string>(); // "abs" or "abs#anchor" → address
  const seen = new Set<string>();
  const addresses = new Set<string>();
  const links: { tok: Tok; file: string }[] = [];
  const images: { tok: Tok; file: string }[] = [];
  const rel = (abs: string) => relative(rootDir, abs) || "README.md";
  const within = (abs: string) => abs === rootDir || abs.startsWith(rootDir + sep);
  const warn = (s: string) => void warnings.push(s);

  /** Reads and cuts a stamped file, or says why it cannot. */
  const read = (abs: string): { kind: string; cut: Cut } | { fault: string } => {
    if (seen.has(abs)) return { fault: "mounted twice; the second mount is skipped" };
    seen.add(abs);
    if (!existsSync(abs) || statSync(abs).isDirectory()) return { fault: "missing; the mount is skipped" };
    const st = stamped(readFileSync(abs, "utf8"));
    return st ? { kind: st.front["kind"] ?? "brief", cut: cut(imageBlocks(lean(marked.lexer(st.rest) as unknown as Tok[]))) } : { fault: "not under the code; the mount is skipped" };
  };

  /** A free address for a title under a parent: the slug, suffixed when a sibling already took it. */
  const addressFor = (parent: string, title: string): string => {
    const base = parent ? `${parent}/${slug(title)}` : slug(title);
    const free = [base, ...Array.from({ length: 99 }, (_, k) => `${base}-${k + 2}`)].find((a) => !addresses.has(a))!;
    addresses.add(free);
    return free;
  };

  /**
   * Gathers a brief's prose for the rewriting after the trace, and says where it breaks the practice's rules for
   * images: a face is prose, so a brief never opens with an image, and an image stands as a block of its own.
   */
  const gather = (body: Tok[], abs: string, file: string, title: string): void => {
    links.push(...linksIn(body).map((tok) => ({ tok, file: abs })));
    images.push(...body.filter((t) => t.type === "image").map((tok) => ({ tok, file: abs })));
    if (body.find((t) => t.type !== "space")?.type === "image") warn(`${file}: "${title}" opens with an image; a face is prose`);
    if (tokensIn("image", body.filter((t) => t.type !== "image")).length) warn(`${file}: "${title}" holds an image inside running text; an image opens a paragraph of its own, so only its alt text is drawn`);
    if (body.some((t) => t.type === "image" && t.soft)) warn(`${file}: "${title}" has text beneath an image after a plain line break; end the image's line with a backslash, or a document renderer runs the text on beside the image`);
  };

  /** Traces one file's sections under `owner`, in reading order, following each mount as it is met. */
  const traceLevel = (sections: Section[], owner: Brief, abs: string, file: string, kind: string): void => {
    // a level is a set when its headings carry letters; a level that mixes letters and numbers is read by its first
    const heads = sections.map((s) => splitHeading(s.heading));
    const marked = heads.filter((h) => h.written);
    const set = marked.length > 0 && isLettered(marked[0].written);
    if (marked.some((h) => isLettered(h.written) !== set)) warn(`${file}: the level under "${owner.title || "the title"}" mixes letters and numbers; read as ${set ? "a set" : "a sequence"}`);
    if (set) owner.set = true;
    sections.forEach((s, i) => {
      const { written, title } = heads[i];
      // Numbers restart in every file, as the practice writes them: a mounted level counts from one.
      const place = set ? letterOf(i) : `${i + 1}`;
      const number = owner.number && owner.file === file ? `${owner.number}.${place}` : place;
      const address = addressFor(owner.address, title);
      if (!address.endsWith(slug(title))) warn(`${file}: another brief titled "${title}" in the same level; this one is addressed ${address}`);
      if (written && written !== number) warn(`${file}: "${title}" is numbered ${written} and stands at ${number}`);
      const brief: Brief = { address, title, number, written, file, kind, body: s.body, door: s.children.length > 0 };
      briefs.push(brief);
      table.set(`${abs}#${slug(s.heading)}`, address);
      gather(s.body, abs, file, title);
      traceLevel(s.children, brief, abs, file, kind);
      traceMount(brief, s.children.length > 0, abs, file);
    });
  };

  /**
   * Follows a brief's mount, if it has one and may: the paragraph leaves the body and the file becomes the level. A lone
   * link to a file already placed, or to a heading in one, borrows that level instead: the first place the reading met
   * it is its home, and the borrowing brief only points there.
   */
  const traceMount = (brief: Brief, hasSubsections: boolean, abs: string, file: string): void => {
    const m = mountOf(brief.body);
    if (!m) return;
    if (hasSubsections) return warn(`${file}: "${brief.title}" mounts ${m.href} and has subsections of its own; the mount is skipped`);
    const hash = m.href!.indexOf("#");
    const path = hash < 0 ? m.href! : m.href!.slice(0, hash);
    const anchor = hash < 0 ? "" : m.href!.slice(hash + 1);
    const target = entryOf(path ? resolve(dirname(abs), path) : abs);
    if (!within(target)) return warn(`${file}: "${brief.title}" mounts ${m.href}, which lies above the root; the mount is skipped`);
    const home = table.get(anchor ? `${target}#${anchor}` : target);
    if (home !== undefined) {
      if (home === brief.address) return warn(`${file}: "${brief.title}" borrows itself; the link is skipped`);
      brief.body = withoutMount(brief.body);
      brief.borrow = home;
      brief.door = true;
      return;
    }
    if (anchor) return warn(`${file}: "${brief.title}" borrows ${m.href}, which the reading has not met; the link is skipped`);
    brief.body = withoutMount(brief.body);
    const r = read(target);
    if ("fault" in r) return warn(`${rel(target)}: ${r.fault}`);
    const tfile = rel(target);
    if (r.cut.title === null) warn(`${tfile}: no title`);
    else if (r.cut.title !== brief.title) warn(`${tfile}: titled "${r.cut.title}", mounted by "${brief.title}"`);
    if (r.cut.lead.some((t) => t.type !== "space")) warn(`${tfile}: prose before its first section; a mounted file holds only its parts, so it is dropped`);
    r.cut.strays.forEach((s) => warn(`${tfile}: a second title "${s}"; read as prose`));
    if (r.cut.sections.length === 0) return warn(`${tfile}: mounted by "${brief.title}" and has no section; a level with nothing in it`);
    table.set(target, brief.address);
    if (r.cut.title !== null) table.set(`${target}#${slug(r.cut.title)}`, brief.address);
    brief.door = true;
    traceLevel(r.cut.sections, brief, target, tfile, r.kind);
  };

  // The root: its title and opening are its own brief, and its sections are the first level.
  const r = read(rootFile);
  if ("fault" in r || r.cut.title === null) {
    const why = "fault" in r ? r.fault : "no title";
    return { title: "", root: rel(rootFile), briefs: [], warnings: [`${rel(rootFile)}: ${why}; nothing traced`], traced: new Date().toISOString() };
  }
  const root: Brief = { address: "", title: r.cut.title, number: "", written: "", file: rel(rootFile), kind: r.kind, body: r.cut.lead, door: r.cut.sections.length > 0 };
  briefs.push(root);
  addresses.add("");
  table.set(rootFile, "");
  table.set(`${rootFile}#${slug(root.title)}`, "");
  r.cut.strays.forEach((s) => warn(`${root.file}: a second title "${s}"; read as prose`));
  gather(root.body, rootFile, root.file, root.title);
  traceLevel(r.cut.sections, root, rootFile, root.file, r.kind);
  traceMount(root, r.cut.sections.length > 0, rootFile, root.file);

  // ## 2.5 Links are rewritten to addresses
  //
  // The table maps each file, and each heading in it, to the address it holds:
  // a file alone is the brief that mounts it, since the file is that brief's
  // level. Every link is now rewritten through that table. A web address is
  // left as it is, and a link to a file the trace never reached is marked as
  // leaving the body.
  const resolveLink = (href: string, file: string): Partial<Tok> => {
    if (href === "") return { out: "owed" };
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      if (!isWeb(href)) warn(`${rel(file)}: a link with the scheme ${href.split(":")[0]}: is not followed`);
      return { out: isWeb(href) ? "web" : "outside" };
    }
    const hash = href.indexOf("#");
    const p = hash < 0 ? href : href.slice(0, hash);
    const anchor = hash < 0 ? "" : href.slice(hash + 1);
    const abs = entryOf(p ? resolve(dirname(file), p) : file);
    const exact = table.get(anchor ? `${abs}#${anchor}` : abs);
    if (exact !== undefined) return { to: exact, href: `#/${exact}` };
    if (anchor && table.has(abs)) {
      warn(`${rel(file)}: a link to ${p || "this file"}#${anchor} names no heading there; it lands on the file`);
      return { to: table.get(abs), href: `#/${table.get(abs)}` };
    }
    return { out: "outside", href: (within(abs) ? relative(rootDir, abs) : "above the root") + (anchor ? `#${anchor}` : "") };
  };
  links.forEach(({ tok, file }) => Object.assign(tok, resolveLink(tok.href ?? "", file)));

  // ## 2.6 Images are measured
  //
  // Every image is given where the page loads it from and, where it can be read,
  // its own size, so the page lays an image at its size before it has loaded. A
  // file in the body is read for its header and served by its path. A remote
  // image is asked for its first bytes, and a size that cannot be had is left to
  // the page, which measures it when it loads. A file that is missing, or is not
  // an image, leaves only its alt text.
  const resolveImage = async (tok: Tok, file: string): Promise<Partial<Tok>> => {
    const href = tok.href ?? "";
    const said = `${rel(file)}: the image ${href || "with no source"}`;
    if (/^https?:/i.test(href)) {
      const size = await remoteSize(href);
      if (!size) warn(`${said} could not be measured; the page measures it when it loads`);
      return { src: href, ...size };
    }
    const abs = href && !/^[a-z][a-z0-9+.-]*:/i.test(href) ? resolve(dirname(file), decoded(href)) : "";
    const fault = !abs || !within(abs) || !existsSync(abs) || statSync(abs).isDirectory() ? "is not a file in the body" : !imageType(abs) ? "is not an image the surface draws" : "";
    if (fault) {
      warn(`${said} ${fault}; its alt text stands`);
      return {};
    }
    // the practice keeps an image in a .img folder beside the file that shows it, or beside a folder above it that
    // covers every file showing it
    const home = dirname(dirname(abs));
    if (basename(dirname(abs)) !== ".img" || !(dirname(file) === home || dirname(file).startsWith(home + sep))) warn(`${said} does not stand in a .img folder beside the file or above it`);
    const size = imageSize(head(abs));
    if (!size) warn(`${said} does not say its size; the page measures it when it loads`);
    const asset = relative(rootDir, abs).split(sep).join("/");
    // a sketch is set into the page rather than shown as an image, so the page's own palette and type reach it
    const svg = imageType(abs) === "image/svg+xml" && isSketch(head(abs)) ? cleanSketch(readFileSync(abs, "utf8")) : undefined;
    return { asset, src: `/asset/${asset.split("/").map(encodeURIComponent).join("/")}?v=${Math.round(statSync(abs).mtimeMs)}`, ...size, ...(svg ? { svg } : {}) };
  };
  await Promise.all(images.map(async ({ tok, file }) => Object.assign(tok, await resolveImage(tok, file))));

  return { title: root.title, root: root.file, briefs, warnings, traced: new Date().toISOString() };
}

// ## 2.7 What an image says of its size
//
// An image's size is in its first bytes, and reading it there is a few lines per
// format, so no library is brought in. These are pure but for reading a file's
// head and asking a remote image for its own.

type Size = { width: number; height: number };

/** The image formats the page draws, by extension, with the type each is served and carried as. */
const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif" };
const imageType = (path: string): string | undefined => IMAGE_TYPES[/\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? ""];

const decoded = (href: string): string => {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
};

/** How far into an image its size is looked for. */
const HEAD = 512 * 1024;

/** The first bytes of a file, which is where an image says its size. */
function head(abs: string): Uint8Array {
  const fd = openSync(abs, "r");
  try {
    const bytes = new Uint8Array(Math.min(HEAD, statSync(abs).size));
    readSync(fd, bytes, 0, bytes.length, 0);
    return bytes;
  } finally {
    closeSync(fd);
  }
}

/** Remote sizes, kept a few minutes, since a remote image may change and a live trace runs on every save. */
const remoteSizes = new Map<string, { at: number; size: Promise<Size | null> }>();

/** A remote image's size, read from as few of its first bytes as it takes; null when it cannot be had. */
function remoteSize(url: string): Promise<Size | null> {
  const kept = remoteSizes.get(url);
  if (kept && Date.now() - kept.at < 5 * 60_000) return kept.size;
  const size = (async (): Promise<Size | null> => {
    try {
      const res = await fetch(url, { headers: { range: `bytes=0-${HEAD - 1}` }, signal: AbortSignal.timeout(5000) });
      if (!res.ok || !res.body) return null;
      const reader = res.body.getReader();
      let bytes = new Uint8Array(0);
      for (;;) {
        const { done, value } = await reader.read();
        if (value) {
          const next = new Uint8Array(bytes.length + value.length);
          next.set(bytes);
          next.set(value, bytes.length);
          bytes = next;
        }
        const found = imageSize(bytes);
        if (found || done || bytes.length >= HEAD) {
          reader.cancel().catch(() => {});
          return found;
        }
      }
    } catch {
      return null;
    }
  })();
  remoteSizes.set(url, { at: Date.now(), size });
  return size;
}

/** An image's size as its own header gives it: PNG, GIF, WebP, JPEG turned as its EXIF says, or SVG; null otherwise. */
function imageSize(b: Uint8Array): Size | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const has = (n: number) => b.length >= n;
  const ascii = (at: number, s: string) => has(at + s.length) && Array.from(s).every((c, i) => b[at + i] === c.charCodeAt(0));
  const size = (width: number, height: number): Size | null => (width > 0 && height > 0 ? { width, height } : null);
  if (ascii(1, "PNG") && has(24)) return size(dv.getUint32(16), dv.getUint32(20));
  if (ascii(0, "GIF8") && has(10)) return size(dv.getUint16(6, true), dv.getUint16(8, true));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) {
    if (ascii(12, "VP8 ") && has(30)) return size(dv.getUint16(26, true) & 0x3fff, dv.getUint16(28, true) & 0x3fff);
    if (ascii(12, "VP8L") && has(25)) return size(1 + (((b[22] & 0x3f) << 8) | b[21]), 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)));
    if (ascii(12, "VP8X") && has(30)) return size(1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16)));
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    // segments follow one another to the frame header; an EXIF orientation of 5 to 8 turns the image a quarter
    let turned = false;
    for (let i = 2; has(i + 9) && b[i] === 0xff; ) {
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      const len = dv.getUint16(i + 2);
      if (marker === 0xe1 && ascii(i + 4, "Exif")) {
        const t = i + 10;
        const le = ascii(t, "II");
        const ifd = has(t + 8) ? t + dv.getUint32(t + 4, le) : -1;
        const count = ifd > 0 && has(ifd + 2) ? dv.getUint16(ifd, le) : 0;
        for (let e = 0; e < count && has(ifd + 2 + 12 * (e + 1)); e++) {
          const at = ifd + 2 + 12 * e;
          if (dv.getUint16(at, le) === 0x0112) turned = dv.getUint16(at + 8, le) >= 5;
        }
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const [w, h] = [dv.getUint16(i + 7), dv.getUint16(i + 5)];
        return turned ? size(h, w) : size(w, h);
      }
      i += 2 + len;
    }
    return null;
  }
  const svg = /<svg\b[^>]*>/i.exec(new TextDecoder().decode(b.subarray(0, 8192)))?.[0];
  if (!svg) return null;
  const attr = (name: string) => Number(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, "i").exec(svg)?.[1] ?? NaN);
  const box = /\sviewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i.exec(svg);
  return attr("width") > 0 && attr("height") > 0 ? size(attr("width"), attr("height")) : box ? size(Number(box[1]), Number(box[2])) : null;
}

/** Whether an SVG is a sketch: its root carries the class, which is what the sketching skill writes. */
const isSketch = (b: Uint8Array): boolean => /<svg\b[^>]*\sclass\s*=\s*["'][^"']*\bsketch\b/i.test(new TextDecoder().decode(b.subarray(0, 8192)));

/** The elements a sketch may hold when it is set into the page: drawing, text and their definitions, and nothing that runs or reaches out. */
export const SKETCH_ELEMENTS = new Set("svg g defs style title desc rect circle ellipse line polyline polygon path text tspan marker lineargradient radialgradient stop clippath mask pattern use symbol".split(" "));

/**
 * A sketch's markup, cleaned for the page: only the elements above, no event attributes, no reference that leaves the
 * file, and no style that fetches. A sketch is written by a session, but its markup is set into the page, so it is
 * cleaned as though it were not.
 */
function cleanSketch(src: string): string {
  const at = src.search(/<svg\b/i);
  const external = /url\(\s*(?!["']?#)[^)]*\)|@import[^;]*;?/gi;
  return new HTMLRewriter()
    .on("*", {
      element(el) {
        if (!SKETCH_ELEMENTS.has(el.tagName)) return void el.remove();
        for (const [name, value] of el.attributes) {
          if (/^on/i.test(name) || (/href$/i.test(name) && !value.startsWith("#"))) el.removeAttribute(name);
          else if (name === "style" && value.replace(external, "none") !== value) el.setAttribute(name, value.replace(external, "none"));
        }
      },
    })
    .on("style", {
      text(t) {
        const kept = t.text.replace(external, "");
        if (kept !== t.text) t.replace(kept, { html: false });
      },
    })
    .transform(at < 0 ? "" : src.slice(at).replace(/<!--[\s\S]*?-->/g, ""));
}

/** Every image the body holds as a file, by its path from the root's directory. */
const assetsOf = (body: Body): string[] => body.briefs.flatMap((b) => b.body.flatMap((t) => (t.type === "image" && t.asset ? [t.asset] : [])));

// # 3. How it is drawn
//
// The page draws from a small shared state and nothing else: the body and its
// index, the address in focus, the address the pointer rests on, the scope, the
// grade of every brief in the lane, and the settings. Five areas stand in a row, a wing,
// a gutter, the lane, a gutter, a wing. The lane is prose; the rest is widgets,
// plain functions in one table, chosen per area from a strip of icons at its
// foot, and a closed area takes no room, leaving its icons where it would open. Everything drawn that
// names a brief carries its address, which is what keeps every widget in step.
// The pure functions come first, the ones that touch the document after them.

// ## 3.1 What the page holds

type Index = {
  by: Map<string, Brief>;
  children: Map<string, Brief[]>;
  own: Map<string, number>;
  branch: Map<string, number>;
  backlinks: Map<string, Set<string>>;
  depth: number;
};

/** A brief in the lane stands at its face or whole; a brief not in the lane has no grade. */
type Grade = "face" | "whole";

type AreaName = "wingL" | "gutterL" | "middle" | "gutterR" | "wingR";
/** The panes the middle can hold, in the order they stand: the canvas at the left, the lane at the right. */
const PANES = ["canvas", "lane"] as const;
type PaneName = (typeof PANES)[number];
/** The least width the canvas stands in beside the lane; narrower, it gives way. */
const CANVAS_MIN = 360;
type Theme = "light" | "dark" | "system";
const THEMES: Theme[] = ["light", "dark", "system"];
/** The three faces a heading or the prose can be set in. */
type Face = "serif" | "sans" | "mono";
const FACES: Face[] = ["serif", "sans", "mono"];
/**
 * Each face by the family it names, its x-height as measured in the browser, and a lift. A face is sized to the
 * serif's x-height, so all three read at one size; the sans is lifted a step past that, since its letters are
 * narrower and lighter than the serif's and read smaller at the same x-height.
 */
const FACE: Record<Face, { family: string; x: number; lift: number }> = {
  serif: { family: "var(--serif)", x: 0.452, lift: 1 },
  sans: { family: "var(--sans)", x: 0.486, lift: 1.04 },
  mono: { family: "var(--mono)", x: 0.486, lift: 1 },
};
/** How much a face is scaled against the serif. */
const sizeOf = (f: Face): number => (FACE.serif.x / FACE[f].x) * FACE[f].lift;
type Settings = {
  zoom: number;
  ratio: number;
  measure: number;
  gap: number;
  /** the step every brief but the highlighted one is dimmed by */
  dim: number;
  /** the run of the fade at the top and the bottom of the lane, in hundredths of its height */
  fade: number;
  /** the spacing of the prose's lines, as a multiple of the serif's size */
  leading: number;
  /** the most width the canvas takes beside or without the lane, so a wide screen keeps its space */
  canvas: number;
  /** where the reading line stands: always at the middle, or easing onto the opening and the last brief at the ends */
  line: "middle" | "ends";
  /** what a brief weighs in the figures that weigh: the cost of its text alone, or the experience of it, its images counted as the room they take */
  weight: "cost" | "experience";
  /** what the ahead answers for: only a brief that hides something, or every highlighted brief with anything beneath it */
  ahead: "hidden" | "always";
  flick: number;
  /** light, dark, or whichever the system is set to */
  theme: Theme;
  /** the face of the headings, and of the prose */
  headings: Face;
  prose: Face;
  /** the widgets each area holds, in order: a wing up to two, top then bottom; a gutter one; none is closed; the middle its panes, never none */
  areas: Record<AreaName, string[]>;
};

const DEFAULTS: Settings = {
  zoom: 1,
  ratio: 1.25,
  measure: 600,
  gap: 24,
  dim: 0.4,
  fade: 8,
  leading: 1.6,
  canvas: 720,
  line: "ends",
  weight: "cost",
  ahead: "hidden",
  flick: 1,
  theme: "system",
  headings: "serif",
  prose: "serif",
  areas: { wingL: ["shape"], gutterL: [], middle: ["lane"], gutterR: ["links"], wingR: ["ahead"] },
};

const state = {
  body: null as Body | null,
  index: null as Index | null,
  /** the brief under the reading line; its address is the page's address */
  focus: "",
  pointed: null as string | null,
  /** every brief in the lane and its grade; a brief absent here is not drawn */
  grades: new Map<string, Grade>(),
  settings: { ...DEFAULTS, areas: { ...DEFAULTS.areas } } as Settings,
  /** set while a drag is in progress, so pointing does not fight it */
  scrubbing: false,
  /** the focus a keyed move is scrolling to; held until the scroll settles, so the marks do not follow every brief passed */
  holding: null as string | null,
  /** the brief whose holon the lane shows: "" for the whole body */
  scope: "",
  /** how the reader came here: every move they made, oldest first, each with the lane as it stood before it */
  trail: [] as Hop[],
};

/** Characters to a line of the lane at the default measure, which is the unit the figures size prose in. */
const LINE_CHARS = 72;

/** How many of the lane's lines an image stands as at a measure and a line height: its own width, never past the measure, and its own shape; an image of unknown size is taken as wide as the measure and nine sixteenths as tall. */
const imageLines = (t: Tok, measure: number, leading: number): number => {
  const w = t.width ?? 16;
  const h = t.height ?? 9;
  return ((t.width ? Math.min(w, measure) : measure) * (h / w)) / leading;
};

/** What a brief's own prose weighs: its text, and with the weight set to experience its images too, as the text that would fill their room at the default measure. */
const weightOf = (b: Brief): number =>
  textOf(b.body).length +
  (state.settings.weight === "experience" ? b.body.reduce((n, t) => n + (t.type === "image" ? imageLines(t, DEFAULTS.measure, 17 * DEFAULTS.leading) * LINE_CHARS : 0), 0) : 0);

/** Everything derived from the body and the weight, computed again when either changes. */
function indexBody(body: Body): Index {
  const by = new Map(body.briefs.map((b) => [b.address, b]));
  const own = new Map(body.briefs.map((b) => [b.address, weightOf(b)]));
  const children = Map.groupBy(
    body.briefs.filter((b) => b.address !== ""),
    (b) => parentOf(b.address),
  );
  const branch = new Map<string, number>();
  const branchOf = (a: string): number => {
    if (!branch.has(a)) branch.set(a, own.get(a)! + (children.get(a) ?? []).reduce((s, k) => s + branchOf(k.address), 0));
    return branch.get(a)!;
  };
  body.briefs.forEach((b) => branchOf(b.address));
  const pointers = body.briefs.flatMap((b) => [
    ...linksIn(b.body).flatMap((l) => (l.to !== undefined && l.to !== b.address ? [{ to: l.to, from: b.address }] : [])),
    ...(b.borrow !== undefined ? [{ to: b.borrow, from: b.address }] : []),
  ]);
  const backlinks = new Map(Array.from(Map.groupBy(pointers, (p) => p.to), ([to, ps]) => [to, new Set(ps.map((p) => p.from))]));
  const depth = Math.max(0, ...body.briefs.map((b) => depthOf(b.address)));
  return { by, children, own, branch, backlinks, depth };
}

const level = (a: string): Brief[] => state.index?.children.get(a) ?? [];
const brief = (a: string): Brief | undefined => state.index?.by.get(a);
const gradeOf = (a: string): Grade | null => state.grades.get(a) ?? null;
const inLane = (a: string): boolean => state.grades.has(a);

/** The briefs in the lane, in reading order: a brief, then its level, then the next. */
const laneOrder = (parent = ""): Brief[] => level(parent).flatMap((b) => (inLane(b.address) ? [b, ...(gradeOf(b.address) === "whole" ? laneOrder(b.address) : [])] : []));

/** The nearest address that resolves, for a link or a hash that no longer does. */
const nearest = (a: string): string => prefixesOf(a).findLast((p) => brief(p)) ?? "";

/** The nearest ancestor of an address that stands in the lane. */
const nearestInLane = (a: string): string => prefixesOf(a).findLast((p) => inLane(p)) ?? "";

/** How many briefs stand beneath an address, at any depth. */
const beneathCount = (a: string): number => level(a).reduce((s, k) => s + 1 + beneathCount(k.address), 0);

/** The level a brief unfolds onto: its own, or the one it borrows. */
const levelOf = (b: Brief): Brief[] => level(b.borrow ?? b.address);
/** How many briefs a brief unfolds onto, its own or borrowed. */
const beneathOf = (b: Brief): number => beneathCount(b.borrow ?? b.address);
/** Whether a brief unfolds at all: paragraphs past its face, or a level, its own or borrowed. */
const unfolds = (b: Brief): boolean => blocksOf(b).length > 1 || levelOf(b).length > 0;

const fmt = (n: number) => n.toLocaleString("en-US");
/** The number a heading shows in the lane: counted from the scope, as the canvas counts, since a reader stands in the substrate and not in a file. */
const shownNumber = (b: Brief): string => scopedNumber(b);
const trim = (s: string, n: number): string => (n <= 0 ? "" : s.length <= n ? s : n < 4 ? "" : s.slice(0, n - 1).trimEnd() + "…");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where each of a row of widths starts, laid end to end with a gap between. */
const offsets = (widths: number[], gap: number): number[] => widths.map((_, i) => widths.slice(0, i).reduce((x, w) => x + w + gap, 0));

/** Shares of a span by weight, with the small ones lifted to a floor and the large ones yielding the difference. */
function spread(weights: number[], span: number, floor: number): number[] {
  const total = weights.reduce((x, y) => x + y, 0);
  const raw = weights.map((w) => (w / total) * span);
  const owed = raw.reduce((s, x) => s + (x < floor ? floor - x : 0), 0);
  const large = raw.reduce((s, x) => s + (x < floor ? 0 : x), 0);
  return raw.map((x) => (x < floor ? floor : large > 0 ? x - (owed * x) / large : x));
}

/**
 * The hue of a branch: every brief carries the hue of the root-level brief it stands under, so colour says
 * where in the body a thing sits and nothing else. Hues step by the golden angle, so neighbours differ.
 */
const hueOf = (address: string): number => {
  const i = level("").findIndex((b) => b.address === address.split("/")[0]);
  return i < 0 ? 0 : Math.round((30 + i * 137.508) % 360);
};
const hued = (address: string): string => `style="--h:${hueOf(address)}"`;

// ### 3.1.1 The actions
//
// Every act a key fires is one entry in one table: the keys that fire it, what
// it is called, the sentence that helps, the other ways to the same thing, and
// the doing. The keys are wired from it, the badges are drawn from it, and the
// tooltip reads its help from there, so an action is named in one place. Adding
// one is adding an entry, as a widget is.
//
// An action acts on an address: the badge drawn beside a brief passes that
// brief, and a key passes nothing, so the action reads the focus, which is the
// brief the reading line stands on and the one every key acts on.

/** A chord: the key, whether shift is held with it, and whether it acts on being held rather than on the press. */
type Chord = { key: string; shift?: boolean; hold?: boolean };

type Action = {
  /** what it is called on a badge, for the brief it is drawn beside; a word, lower case */
  label: (a?: string) => string;
  /** the chords that fire it */
  keys: Chord[];
  /** what it does, in a sentence, for the tooltip; it takes the address so it can say which way the act goes */
  help: (a?: string) => string;
  /** the other ways to the same thing, named on the tooltip */
  also?: string;
  /** what the same key with shift does, named where the plain badge stands */
  shifted?: string;
  /** the glyph a tight badge draws in place of the label */
  glyph?: string;
  /** whether it can be taken at all; a badge that cannot is not drawn */
  can: (a?: string) => boolean;
  run: (a?: string) => void;
};

/** The address an action acts on: the one a badge passes, or the focus, which is what a key acts on. */
const acts = (a?: string): string => a ?? state.focus;

const ACTIONS: Record<string, Action> = {
  unfold: {
    label: (a) => (gradeOf(acts(a)) === "whole" ? "fold" : "unfold"),
    keys: [{ key: " " }],
    help: (a) =>
      gradeOf(acts(a)) === "whole"
        ? "Folds the brief back to its face; the same key unfolds it again."
        : "Unfolds the brief: the paragraphs its face hides, and the level beneath it.",
    also: "The line itself, the chevron in the tree, and the room right of a brief's blocks in the shape.",
    shifted: "Shift folds the brief above instead, which takes you up to it.",
    can: (a) => !!brief(acts(a)) && unfolds(brief(acts(a))!),
    run: (a) => cycle(acts(a)),
  },
  foldUp: {
    label: () => "fold above",
    keys: [{ key: " ", shift: true }],
    help: () => "Folds the brief above the one in focus, its parent, which takes you up to it.",
    can: () => state.focus !== state.scope && !!brief(parentOf(state.focus)),
    run: () => cycle(parentOf(state.focus)),
  },
  unfoldAll: {
    label: () => "unfold the scope",
    keys: [{ key: " ", hold: true }],
    help: () => "Unfolds every brief in the scope, held a moment.",
    also: "The depth strip, scrubbed to its end.",
    can: () => scopeDepth() > 0,
    run: () => unfoldAll(),
  },
  foldAll: {
    label: () => "fold the scope",
    keys: [{ key: " ", shift: true, hold: true }],
    help: () => "Folds every brief in the scope to its face, held a moment.",
    also: "The depth strip, scrubbed back to its start.",
    can: () => scopeDepth() > 0,
    run: () => foldAll(),
  },
  open: {
    label: () => "open",
    keys: [{ key: "Enter" }],
    help: () => "Opens the brief as the whole of the lane: its heading becomes the opening and everything above it leaves.",
    shifted: "Shift widens the scope by a level instead.",
    can: (a) => level(acts(a)).length > 0,
    run: (a) => scopeTo(acts(a)),
  },
  widen: {
    label: () => "widen",
    keys: [{ key: "Enter", shift: true }],
    help: () => "Widens the scope to the level above, so what stood around this brief comes back.",
    also: "The names in the way down, the grey ticks in the shape, and pulling past the top of the lane.",
    can: () => state.scope !== "",
    run: () => popUp(),
  },
  deeper: {
    label: () => "a level more",
    keys: [{ key: "ArrowRight", shift: true }],
    help: () => "Unfolds every brief of the scope one level further, and folds what lies beyond it.",
    also: "Pressing or scrubbing the depth strip.",
    glyph: "deeper",
    can: () => unfoldedDepth() < scopeDepth(),
    run: () => unfoldTo(Math.min(scopeDepth(), unfoldedDepth() + 1)),
  },
  shallower: {
    label: () => "a level less",
    keys: [{ key: "ArrowLeft", shift: true }],
    help: () => "Folds the scope back a level, so one level less stands unfolded.",
    also: "Pressing or scrubbing the depth strip.",
    glyph: "shallower",
    can: () => unfoldedDepth() > 0,
    run: () => unfoldTo(Math.max(0, unfoldedDepth() - 1)),
  },
  next: {
    label: () => "next",
    keys: [{ key: "ArrowDown" }],
    help: () => "Moves the reading on to the next brief in the lane, folding nothing.",
    can: () => true,
    run: () => step(1),
  },
  previous: {
    label: () => "previous",
    keys: [{ key: "ArrowUp" }],
    help: () => "Moves the reading back to the brief before this one in the lane, folding nothing.",
    can: () => true,
    run: () => step(-1),
  },
  above: {
    label: () => "above",
    keys: [{ key: "ArrowLeft" }],
    help: () => "Moves the reading up to the brief this one stands beneath, folding nothing.",
    can: () => state.focus !== state.scope,
    run: () => up(),
  },
  beneath: {
    label: () => "beneath",
    keys: [{ key: "ArrowRight" }],
    help: () => "Moves the reading into the first brief beneath this one, when it stands in the lane.",
    can: () => level(state.focus).length > 0,
    run: () => down(),
  },
  undo: {
    label: () => "undo",
    keys: [{ key: "Escape" }],
    help: () => "Lays the lane back as it stood before the last change you made: a fold, a going, a change of scope.",
    also: "A cell of the trail, which goes back to before that move.",
    shifted: "Shift makes the change again.",
    can: () => true,
    run: () => undo(),
  },
  redo: {
    label: () => "redo",
    keys: [{ key: "Escape", shift: true }],
    help: () => "Makes the change escape undid again.",
    can: () => true,
    run: () => redo(),
  },
};

const same = (x: Chord, y: Chord): boolean => x.key === y.key && !!x.shift === !!y.shift && !!x.hold === !!y.hold;

/** The action a chord fires, if any. */
const actionFor = (c: Chord): Action | undefined => Object.values(ACTIONS).find((x) => x.keys.some((k) => same(k, c)));

// ### 3.1.2 The badge: a key and what it does
//
// An action stands on the page as a badge: the key drawn as a cap, and what it
// does beside it, in a word or, where the room is tight, as a glyph. It stands
// where the action's object stands, so a reader meets the few acts that are at
// hand rather than a bar of every act there is, and the tooltip tells the rest.
//
// The keys are drawn rather than set in type, since a shift, a return and an
// arrow taken from three faces sit at three heights and no two are the same
// weight. Each is one path in a box of sixteen, so a row of caps reads level.

const KEY: Record<string, { glyph: string; name: string }> = {
  " ": { glyph: `<path d="M3.6 6.4v3.1h8.8V6.4"/>`, name: "space" },
  Shift: { glyph: `<path d="M8 3.5 3.6 7.9h2.2v4.5h4.4V7.9h2.2z"/>`, name: "shift" },
  Enter: { glyph: `<path d="M12.3 4.4v4.2H4.9M7.2 6.4 4.9 8.6l2.3 2.3"/>`, name: "return" },
  Escape: { glyph: `<path d="M11.4 11.4 5.7 5.7M5.7 9.8V5.7h4.1"/>`, name: "escape" },
  ArrowUp: { glyph: `<path d="M8 12.2V4.3M5 7.3 8 4.3l3 3"/>`, name: "up" },
  ArrowDown: { glyph: `<path d="M8 3.8v7.9M5 8.7l3 3 3-3"/>`, name: "down" },
  ArrowLeft: { glyph: `<path d="M12.2 8H4.3M7.3 11 4.3 8l3-3"/>`, name: "left" },
  ArrowRight: { glyph: `<path d="M3.8 8h7.9M8.7 11l3-3-3-3"/>`, name: "right" },
};

/** The glyph a tight badge draws in place of its label, drawn in the same box as a key. */
const GLYPH: Record<string, string> = {
  deeper: `<path d="M4.5 4.9h7M5.6 8.4 8 10.8l2.4-2.4"/>`,
  shallower: `<path d="M4.5 11.1h7M5.6 7.6 8 5.2l2.4 2.4"/>`,
};

const cap = (glyph: string): string => `<span class="cap"><svg viewBox="0 0 16 16">${glyph}</svg></span>`;

/** A chord as caps: shift first, then the key, so a row of caps reads as it is pressed. */
const capsOf = (c: Chord): string => (c.shift ? cap(KEY.Shift.glyph) : "") + cap(KEY[c.key]?.glyph ?? "");

/** A chord in words, for the tooltip: "shift and space, held". */
const chordName = (c: Chord): string => (c.shift ? `shift and ${KEY[c.key]?.name}` : (KEY[c.key]?.name ?? c.key)) + (c.hold ? ", held" : "");

/**
 * One badge: the chord as caps and the action beside it, worded, or as a glyph where the room is tight. It carries the
 * address it acts on, so a press acts on the brief it stands beside rather than on the brief in focus.
 */
function badgeHtml(id: string, a?: string, tight = false): string {
  const act = ACTIONS[id];
  if (!act || !act.can(a)) return "";
  const said = tight && act.glyph ? cap(GLYPH[act.glyph] ?? "") : `<span class="label">${esc(act.label(a))}</span>`;
  return `<span class="badge${tight ? " tight" : ""}" data-act="${esc(id)}"${a === undefined ? "" : ` data-a="${esc(a)}"`}><span class="keys">${capsOf(act.keys[0])}</span>${said}</span>`;
}

// ## 3.2 Prose is drawn from tokens
//
// Each kind of token has one renderer, and the two tables are the whole of the
// markdown the page knows: the block kinds and the inline kinds.

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inline = (toks: Tok[] = []): string => toks.map((t) => (INLINE[t.type] ?? INLINE.text)(t)).join("");
const blocks = (toks: Tok[] = []): string => toks.map((t) => (BLOCK[t.type] ?? BLOCK.other)(t)).join("");

const INLINE: Record<string, (t: Tok) => string> = {
  text: (t) => (t.tokens ? inline(t.tokens) : esc(t.text ?? "")),
  escape: (t) => esc(t.text ?? ""),
  em: (t) => `<em>${inline(t.tokens)}</em>`,
  strong: (t) => `<strong>${inline(t.tokens)}</strong>`,
  del: (t) => `<del>${inline(t.tokens)}</del>`,
  codespan: (t) => `<code>${esc(t.text ?? "")}</code>`,
  br: () => "<br>",
  image: (t) => `<span class="image">${esc(t.text ?? "")}</span>`,
  html: (t) => esc(t.text ?? ""),
  link: (t) =>
    t.to !== undefined
      ? `<a href="#/${esc(t.to)}" data-a="${esc(t.to)}" data-link="${esc(t.to)}" ${hued(t.to)}>${inline(t.tokens)}</a>`
      : t.out === "web" && isWeb(t.href ?? "")
        ? `<a href="${esc(t.href!)}" class="web" data-link="web" target="_blank" rel="noopener">${inline(t.tokens)}</a>`
        : t.out === "owed"
          ? `<a class="owed" data-link="owed">${inline(t.tokens)}</a>`
          : `<a class="outside" data-link="outside" data-href="${esc(t.href ?? "")}">${inline(t.tokens)}</a>`,
};

const BLOCK: Record<string, (t: Tok) => string> = {
  space: () => "",
  paragraph: (t) => `<p>${inline(t.tokens)}</p>`,
  text: (t) => inline(t.tokens ?? [t]),
  heading: (t) => `<p class="stray">${inline(t.tokens)}</p>`,
  list: (t) => {
    const tag = t.ordered ? "ol" : "ul";
    const start = t.ordered && t.start && t.start !== 1 ? ` start="${t.start}"` : "";
    return `<${tag}${start}>${(t.items ?? []).map((i) => `<li>${blocks(i.tokens)}</li>`).join("")}</${tag}>`;
  },
  code: (t) => `<pre><code>${esc(t.text ?? "")}</code></pre>`,
  // an image stands at its own size, which the trace read, so the lane is laid before it loads, with the text written
  // beneath it as its caption; one the trace could not reach leaves its alt text, and its caption still stands
  image: (t) => {
    const alt = esc(textOf(t.tokens) || t.text || "");
    const sized = t.width && t.height ? ` width="${t.width}" height="${t.height}" loading="lazy"` : "";
    const caption = t.caption?.length ? `<figcaption class="chrome">${inline(t.caption)}</figcaption>` : "";
    // a sketch is set into the page, cleaned by the trace, so it reads the page's palette, theme and type
    if (t.svg) return `<figure class="image sketch">${t.svg.replace(/^<svg\b/i, `<svg role="img" aria-label="${alt}"`)}${caption}</figure>`;
    return t.src
      ? `<figure class="image" data-alt="${alt}"><img src="${esc(t.src)}" alt="${alt}"${sized} decoding="async">${caption}</figure>`
      : `<figure class="image missing"><p class="stray">${alt || "an image"}</p>${caption}</figure>`;
  },
  blockquote: (t) => `<blockquote>${blocks(t.tokens)}</blockquote>`,
  hr: () => "<hr>",
  html: (t) => `<p>${esc(t.text ?? "")}</p>`,
  table: (t) => {
    const cell = (c: Tok, tag: string, i: number) => `<${tag}${t.align?.[i] ? ` style="text-align:${t.align[i]}"` : ""}>${inline(c.tokens)}</${tag}>`;
    const head = `<tr>${(t.header ?? []).map((c, i) => cell(c, "th", i)).join("")}</tr>`;
    const rows = (t.rows ?? []).map((r) => `<tr>${r.map((c, i) => cell(c, "td", i)).join("")}</tr>`).join("");
    return `<div class="table"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  },
  other: (t) => `<p>${esc(textOf([t]))}</p>`,
};

// ## 3.3 The lane
//
// The lane holds the body depth first, each brief at its grade. Arriving lays
// the grades afresh; folding changes one brief or one level; scrolling changes
// nothing but the focus.

/** Lays the lane for an address: ancestors whole, their siblings at faces, its level whole, the level beneath at faces. */
function lay(address: string): void {
  const g = state.grades;
  g.clear();
  const S = state.scope;
  if (!within(address, S)) address = S;
  const path = prefixesOf(address).filter((p) => within(p, S));
  g.set(S, "whole");
  path.forEach((p) => level(p).forEach((c) => g.set(c.address, path.includes(c.address) || p === parentOf(address) ? "whole" : "face")));
  closeLay();
}

/** Whether an address stands in the holon of another: the root itself, or beneath it. */
const within = (a: string, root: string): boolean => root === "" || a === root || a.startsWith(root + "/");

/** Depth counted from the scope root, which is what the lane's registers and gaps follow. */
const depthIn = (a: string): number => depthOf(a) - depthOf(state.scope);

/** Every whole brief shows its level: children with no grade yet take a face. */
function closeLay(): void {
  const g = state.grades;
  state.body!.briefs.forEach((b) => {
    if (g.get(b.address) === "whole") level(b.address).forEach((c) => g.has(c.address) || g.set(c.address, "face"));
  });
}

/** Sets one brief's grade; past its face its level leaves the lane, and whole lays its level at faces. */
function setGrade(a: string, grade: Grade): void {
  const g = state.grades;
  g.set(a, grade);
  if (grade !== "whole") state.body!.briefs.forEach((b) => b.address.startsWith(a + "/") && g.delete(b.address));
  else closeLay();
}

const nextGrade = (grade: Grade | null): Grade => (grade === "whole" ? "face" : "whole");

const CHEVRON = `<svg viewBox="0 0 10 10"><path d="M3.2 1.8 6.6 5 3.2 8.2"/></svg>`;

/** A tree row's fold mark, the one place a mark folds: a chevron that turns down when whole and points right at a face. */
const foldMark = (b: Brief): string =>
  `<button class="mark ${gradeOf(b.address) ?? "none"}${b.door ? "" : " leaf"}" data-fold="${esc(b.address)}" data-tip="fold or unfold">${CHEVRON}</button>`;

/** The gap after a brief, by the depth of the level the next brief begins: tighter the deeper, so what lies beneath a brief sits together and its siblings stand apart. */
const gapAfter = (nextDepth: number): number => [56, 56, 40, 28, 20][Math.min(4, nextDepth)] ?? 16;

/** One brief in the lane at its grade: its face, the heading and the first block, then the rest when whole; `after` is the gap beneath it. */
function articleHtml(b: Brief, g: Grade, after: number): string {
  const d = Math.min(4, depthIn(b.address));
  const [first, ...rest] = blocksOf(b);
  const on = prefixesOf(state.focus).includes(b.address);
  const beneath = beneathOf(b);
  // a folded brief says beneath its face that it unfolds: the badge for the key, a bar per paragraph it hides, a frame
  // per image, and how many briefs lie beneath; the badge for opening it as the scope stands at the end of the line
  const more =
    g === "face" && (rest.length > 0 || beneath > 0)
      ? `<div class="act more chrome" data-fold="${esc(b.address)}">${badgeHtml("unfold", b.address)}` +
        (rest.length ? `<span class="bars">${rest.slice(0, 12).map((t) => (t.type === "image" ? `<i class="image"></i>` : `<i></i>`)).join("")}${rest.length > 12 ? `<b>+${rest.length - 12}</b>` : ""}</span>` : "") +
        (beneath ? `<span class="beneath">${beneath} beneath</span>` : "") +
        badgeHtml("open", b.address) +
        `</div>`
      : "";
  // a whole brief folds from a line at its foot
  const less = g === "whole" && (rest.length > 0 || beneath > 0) ? `<div class="act less chrome" data-fold="${esc(b.address)}">${badgeHtml("unfold", b.address)}${badgeHtml("open", b.address)}</div>` : "";
  // a borrowing brief says what it borrows and where its home is; pressing the line follows it there
  const home = b.borrow !== undefined ? brief(b.borrow) : undefined;
  const borrow = home ? `<div class="act borrow chrome" data-a="${esc(home.address)}" data-borrow="${esc(home.address)}" ${hued(home.address)}>${icon("links")}<span>borrows</span>${pathHtml(home.address)}<span class="name">${esc(home.title || state.body!.title)}</span></div>` : "";
  return (
    `<article class="brief ${g}${on ? " on" : ""}${b.address === state.focus ? " here" : ""}" data-a="${esc(b.address)}" style="--h:${hueOf(b.address)};--after:${after}px">` +
    `<div class="surface">` +
    `<h2 class="head d${d}"><span class="num">${esc(shownNumber(b))}</span><span class="title">${esc(b.title)}</span></h2>` +
    (first ? blocks([first]) : "") +
    more +
    `</div>` +
    (g === "whole" ? blocks(rest) + borrow + less : "") +
    `</article>`
  );
}

/** The lane as a whole: the root's opening, then every brief in reading order at its grade. */
function laneHtml(): string {
  const S = state.scope;
  const root = brief(S)!;
  const opening = `<header class="opening brief${state.focus === S ? " here" : ""}" data-a="${esc(S)}" ${hued(S)}><h1>${esc(root.title)}</h1>${blocks(root.body)}</header>`;
  const recordNote = (parent: string) => (level(parent)[0]?.kind === "record" ? `<p class="chrome record">A record: its order is when each entry happened, and nothing ranks them.</p>` : "");
  const order = laneOrder(S);
  const opensRecord = (b: Brief) => level(parentOf(b.address))[0] === b && b.kind === "record";
  return (
    opening +
    order
      .map((b, i) => (opensRecord(b) ? recordNote(parentOf(b.address)) : "") + articleHtml(b, gradeOf(b.address)!, gapAfter(order[i + 1] ? depthIn(order[i + 1].address) : 1)))
      .join("")
  );
}

// ## 3.4 The areas, the widgets, and the strip
//
// Five areas in a row. A widget is one entry in one table: an adjunct stands in
// a gutter and returns what belongs beside a brief; a figure stands in a wing
// and returns a drawing of the body. The strip at an area's foot chooses, and
// choosing nothing closes the area, which then takes no room and leaves its icons.

type Adjunct = { kind: "adjunct"; name: string; icon: string; of: (b: Brief, article: HTMLElement) => { at: HTMLElement | null; html: string }[] };
/**
 * A figure draws into the room its wing gives it. It declares the width it stands in, which never changes with what it
 * draws, so nothing beside it moves as it redraws; and whether it grows into the wing's height or takes only what it needs.
 */
type Figure = { kind: "figure"; name: string; icon: string; draw: (w: number, h: number) => string; width: () => number; grow: boolean; onFocus?: boolean; onPoint?: boolean };
/** A pane stands in the middle: the lane, or the canvas. It draws itself from the state through its own functions. */
type Pane = { kind: "pane"; name: string; icon: string };
type Widget = Adjunct | Figure | Pane;

const ICON: Record<string, string> = {
  none: `<path d="M5 5l6 6M11 5l-6 6"/>`,
  shape: `<path d="M3 3h7M3 6h9M6 9h6M6 12h4"/>`,
  tree: `<path d="M3 3h4M6 8h6M8 13h5M4.5 3v5M6.5 8v5"/>`,
  ahead: `<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>`,
  plate: `<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/>`,
  settings: `<path d="M4 11.5a5.5 5.5 0 1 1 8 0"/><path d="M8 8v-3"/>`,
  links: `<path d="M6 10 10 6M4.5 8.5 3 10a2.1 2.1 0 0 0 3 3l1.5-1.5M11.5 7.5 13 6a2.1 2.1 0 0 0-3-3L8.5 4.5"/>`,
  lane: `<path d="M4 3.5h8M4 6.5h8M4 9.5h6M4 12.5h7"/>`,
  canvas: `<rect x="2.5" y="2.5" width="5" height="3.5" rx="1"/><rect x="8.5" y="7" width="5" height="3.5" rx="1"/><rect x="2.5" y="11" width="5" height="3.5" rx="1"/><path d="M7.5 4.5h2a1.5 1.5 0 0 1 1.5 1.5v1M7.5 12.5h2a1.5 1.5 0 0 0 1.5-1.5v-.5"/>`,
};
const icon = (name: string): string => `<svg class="icon" viewBox="0 0 16 16">${ICON[name] ?? ICON.none}</svg>`;

const WIDGETS: Record<string, Widget> = {
  none: { kind: "figure", name: "close", icon: "none", draw: () => "", width: () => 0, grow: false },
  shape: { kind: "figure", name: "the shape: the lane as laid", icon: "shape", draw: (w, h) => shapeSvg(w, h), width: () => shapeWidth(), grow: true },
  tree: { kind: "figure", name: "the tree", icon: "tree", draw: () => treeHtml(), width: () => 240, grow: true, onFocus: true },
  ahead: { kind: "figure", name: "the ahead: what lies beneath and is not in the lane", icon: "ahead", draw: (w, h) => aheadSvg(w, h), width: () => aheadWidth(), grow: true, onFocus: true, onPoint: true },
  plate: { kind: "figure", name: "the plate: the body whole", icon: "plate", draw: (w, h) => plateSvg(w, h), width: () => plateWidth(), grow: false },
  settings: { kind: "figure", name: "settings", icon: "settings", draw: () => settingsHtml(), width: () => 216, grow: false },
  links: { kind: "adjunct", name: "links: what a brief points at, and what points at it", icon: "links", of: (b, el) => linkAdjuncts(b, el) },
  pointers: { kind: "figure", name: "links, for the brief in focus", icon: "links", draw: () => pointersHtml(), width: () => 240, grow: false, onFocus: true },
  canvas: { kind: "pane", name: "the canvas: the scope as nodes", icon: "canvas" },
  lane: { kind: "pane", name: "the lane: the prose, read", icon: "lane" },
};

const AREAS: { name: AreaName; kind: Widget["kind"] }[] = [
  { name: "wingL", kind: "figure" },
  { name: "gutterL", kind: "adjunct" },
  { name: "middle", kind: "pane" },
  { name: "gutterR", kind: "adjunct" },
  { name: "wingR", kind: "figure" },
];
/** The panes the middle holds, in their fixed order. */
const panesHeld = (held: string[] = state.settings.areas.middle): PaneName[] => PANES.filter((p) => held.includes(p));
/** The widgets an area holds, in order. */
const widgetsOf = (area: AreaName): Widget[] => state.settings.areas[area].map((k) => WIDGETS[k]).filter((w): w is Widget => !!w);
type WingName = "wingL" | "wingR";
/** Whether a gutter holds an adjunct the width gives no room to. */
const squeezed = (gutter: "gutterL" | "gutterR"): boolean => isOpen(gutter) && !fits()[gutter];
/**
 * The figures a wing draws, in order: what it holds, and, while the gutter on its side is squeezed out, the links figure
 * carried in beneath them, so what stood beside the prose is still read. A wing already holding two carries nothing.
 */
const figureNames = (area: WingName): string[] => {
  const held = state.settings.areas[area].filter((k) => WIDGETS[k]?.kind === "figure");
  const gutter = area === "wingL" ? "gutterL" : "gutterR";
  return squeezed(gutter) && held.length === 1 && !held.includes("pointers") ? [...held, "pointers"] : held;
};
/** The first widget an area holds, which is all a gutter holds. */
const widgetOf = (area: AreaName): Widget => widgetsOf(area)[0] ?? WIDGETS.none;
const isOpen = (area: AreaName): boolean => widgetsOf(area).length > 0;
const choicesFor = (kind: Widget["kind"]): string[] => Object.keys(WIDGETS).filter((k) => (k === "none" && kind !== "pane") || WIDGETS[k].kind === kind);
/** A strip's width: its icons laid in a row. */
const stripWidth = (kind: Widget["kind"]): number => choicesFor(kind).length * 30 - 4;

/** What an area holds once an icon on its strip is pressed: close empties it, a widget held is let go, a wing holds two, a third taking the place at the foot. */
function pressed(area: AreaName, k: string): string[] {
  const held = state.settings.areas[area];
  // the middle toggles a pane and is never left empty, its panes in their fixed order
  if (area === "middle") return held.includes(k) ? (held.length > 1 ? panesHeld(held.filter((x) => x !== k)) : held) : panesHeld([...held, k]);
  const wing = area.startsWith("wing");
  return k === "none" ? [] : held.includes(k) ? held.filter((x) => x !== k) : !wing ? [k] : held.length < 2 ? [...held, k] : [held[0], k];
}

/**
 * The strip of an area: a light icon per widget, the ones in use a little darker. It offers only what can stand: a
 * widget whose pressing would leave the area without room is not shown, and a closed area with nothing it could open
 * shows no strip at all, so no press ever makes a strip vanish from under the pointer.
 */
function stripHtml(area: AreaName, kind: Widget["kind"]): string {
  const held = state.settings.areas[area];
  const offered = choicesFor(kind).filter(
    (k) => k === "none" || kind === "pane" || held.includes(k) || ((k !== "pointers" || squeezed("gutterL") || squeezed("gutterR")) && fitsWith({ ...state.settings.areas, [area]: pressed(area, k) })[area]),
  );
  if (!isOpen(area) && offered.length <= 1) return "";
  return `<div class="strip" data-strip="${area}">${offered
    .map((k) => `<button class="pick${(k === "none" ? !isOpen(area) : held.includes(k)) ? " on" : ""}" data-area="${area}" data-widget="${k}" data-tip="${esc(WIDGETS[k].name)}">${icon(WIDGETS[k].icon)}</button>`)
    .join("")}</div>`;
}

// ## 3.5 The tree: the lane as an outline
//
// The lane's briefs as a file tree: a row per brief in the lane, nested under
// its parent, unfolded where the brief is whole. Unfolding in the tree is
// unfolding in the lane, one state. The name goes; a line lies across the row of the focus.

function treeHtml(): string {
  const node = (b: Brief, d: number): string => {
    if (!inLane(b.address)) return "";
    const whole = gradeOf(b.address) === "whole";
    const on = prefixesOf(state.focus).includes(b.address);
    return (
      `<div class="node"><div class="row${on ? " on" : ""}${b.address === state.focus ? " here" : ""}" data-a="${esc(b.address)}" style="--h:${hueOf(b.address)};--d:${d}">` +
      foldMark(b) +
      `<span class="name" data-go="${esc(b.address)}">${esc(b.title)}</span></div>` +
      (whole ? level(b.address).map((k) => node(k, d + 1)).join("") : "") +
      `</div>`
    );
  };
  const S = state.scope;
  const above = prefixesOf(S)
    .slice(0, -1)
    .map((a) => `<div class="row above" data-a="${esc(a)}" style="--h:${hueOf(a)};--d:${depthOf(a)}"><span class="mark leaf"></span><span class="name" data-go="${esc(a)}">${esc(brief(a)!.title)}</span></div>`)
    .join("");
  const root = `<div class="row root${state.focus === S ? " here" : ""}" data-a="${esc(S)}" style="--h:${hueOf(S)};--d:${depthOf(S)}"><span class="mark leaf"></span><span class="name" data-go="${esc(S)}">${esc(brief(S)!.title)}</span></div>`;
  return `<div class="tree">${above}${root}${level(S)
    .map((b) => node(b, depthOf(S) + 1))
    .join("")}<div class="laser"></div></div>`;
}

// ## 3.6 The ahead: what lies beneath, and is not in the lane
//
// For the highlighted brief, when its level is out of view: the whole subtree
// beneath it drawn as the shape draws the lane, heading bars and paragraph
// blocks shifted right by nesting, everything expanded, sized from the text
// since none of it is drawn in the lane. Drawn only where the level beneath is
// not in the lane, and only as large as the subtree needs.

let aheadRoot: string | null = null;

/** What a brief hides at its grade: paragraphs beyond its face, and its level beneath, when either is out of the lane; set to always, the ahead answers for any brief with anything beneath it. */
const hides = (a: string): boolean => {
  const b = brief(a);
  if (!b) return false;
  if (state.settings.ahead === "always") return blocksOf(b).length > 1 || level(a).length > 0;
  return gradeOf(a) !== "whole" && (blocksOf(b).length > 1 || (level(a).length > 0 && !level(a).some((k) => inLane(k.address))));
};

/** The brief the ahead answers for: the pointed brief when it hides something, otherwise the focus; a cell inside the figure never re-roots it. */
function aheadTarget(): string | null {
  const base = hides(state.focus) ? state.focus : null;
  const p = state.pointed;
  const within = (root: string | null) => root !== null && p !== null && p.startsWith(root + "/");
  // the figure keeps its root while the pointer moves within it, so pointing at a cell never redraws the figure from under the pointer
  aheadRoot = p !== null && hides(p) && !within(base) ? p : within(aheadRoot) ? aheadRoot : base;
  return aheadRoot;
}

/** A block as the ahead draws it: its kind, its height in lines of the lane, and its width as a share of the measure. */
type ABlock = { kind: "head" | "para" | "image"; lines: number; width: number };
const HEAD_BLOCK: ABlock = { kind: "head", lines: 1.5, width: 0.6 };

/** A block of prose as the lane would present it: text sized from its characters, an image at its own size at the lane's measure and its caption beneath as text. */
function aheadBlocks(t: Tok): ABlock[] {
  const text = (n: number): ABlock => ({ kind: "para", lines: 0.6 + n / LINE_CHARS, width: 1 });
  if (t.type !== "image") return [text(textOf([t]).length)];
  const s = state.settings;
  const image: ABlock = { kind: "image", lines: 0.6 + imageLines(t, s.measure, 17 * s.zoom * s.leading), width: t.width ? Math.min(1, t.width / s.measure) : 1 };
  return t.caption?.length ? [image, text(textOf(t.caption).length)] : [image];
}

type ARow = { a: string; depth: number; blocks: ABlock[]; hidden: number };

function aheadSvg(W: number, H: number): string {
  const target = aheadTarget();
  if (target === null) return "";
  const ix = state.index!;
  const t = brief(target)!;
  // the rows: the brief itself with the paragraphs its face hides, then everything beneath it, in reading order
  const rows: ARow[] = [{ a: target, depth: 0, blocks: [HEAD_BLOCK, ...blocksOf(t).slice(1).flatMap(aheadBlocks)], hidden: 0 }];
  const walk = (parent: string, d: number): void =>
    level(parent).forEach((k) => {
      rows.push({ a: k.address, depth: d, blocks: [HEAD_BLOCK, ...blocksOf(k).flatMap(aheadBlocks)], hidden: 0 });
      walk(k.address, d + 1);
    });
  walk(target, 1);
  const GAP = { block: 0.35, brief: 1.2 };
  const totalOf = (rs: ARow[]) => rs.reduce((sum, r) => sum + r.blocks.reduce((x, blk) => x + blk.lines + GAP.block, 0) + GAP.brief, 0);
  // a line of the lane is a couple of pixels here, as in the shape, and the whole must fit the wing
  const scale = (rs: ARow[]) => Math.min(2.4, (H - 8) / Math.max(1, totalOf(rs)));
  // the ladder keeps the structure: blocks while legible, else one block per brief as tall as its blocks, else the
  // deepest level dropped and its weight shown as a tail on the brief that holds it, until what is left fits
  const asBrief = (r: ARow): ARow => ({ ...r, blocks: [HEAD_BLOCK, { kind: "para", width: 1, lines: r.blocks.slice(1).reduce((x, blk) => x + blk.lines, 0) }] });
  const deepest = Math.max(0, ...rows.map((r) => r.depth));
  const toDepth = (d: number): ARow[] =>
    rows
      .filter((r) => r.depth <= d)
      .map((r) => ({ ...asBrief(r), hidden: r.depth === d && level(r.a).length > 0 ? ix.branch.get(r.a)! - ix.own.get(r.a)! : 0 }));
  let grain = "";
  let drawn: ARow[] = rows;
  if (scale(rows) < 1.8) {
    grain = "by brief";
    drawn = rows.map(asBrief);
    for (let d = deepest; scale(drawn) < 1.2 && d > 0; d--) {
      drawn = toDepth(d - 1);
      grain = `by brief, ${d - 1 === 0 ? "the first level" : `to depth ${d - 1}`}`;
    }
  }
  const k = scale(drawn);
  const total = totalOf(drawn);
  const w = Math.min(W, SHAPE.pad * 2 + Math.max(0, ...drawn.map((r) => r.depth)) * SHAPE.indent + SHAPE.bar + 4 + SHAPE.tail);
  const h = Math.ceil(total * k + 8);
  let y = 4;
  const cells = drawn.map((r) => {
    const x = SHAPE.pad + r.depth * SHAPE.indent;
    const top = y;
    let lastY = y;
    let lastH = 1;
    const bars = r.blocks
      .map((blk) => {
        const bh = Math.max(1.2, blk.lines * k - 0.6);
        const rect = blockRect(blk.kind, x, y, Math.max(4, Math.round(SHAPE.bar * blk.width)), bh);
        lastY = y;
        lastH = bh;
        y += blk.lines * k + GAP.block * k;
        return rect;
      })
      .join("");
    const tail = r.hidden > 0 ? `<rect class="hidden" x="${x + SHAPE.bar + 4}" y="${lastY.toFixed(1)}" width="${clamp(3 + Math.sqrt(r.hidden) / 4, 3, SHAPE.tail).toFixed(1)}" height="${Math.max(1.2, lastH).toFixed(1)}" rx="1"/>` : "";
    y += GAP.brief * k;
    return `<g class="cell" data-a="${esc(r.a)}" ${hued(r.a)}><rect class="hit" x="0" y="${top.toFixed(1)}" width="${w}" height="${(y - top).toFixed(1)}"/>${bars}${tail}</g>`;
  });
  // the cells carry no names; the one under the pointer is named beneath the figure
  const named = state.pointed !== null && state.pointed !== target && state.pointed.startsWith(target + "/") ? brief(state.pointed) : null;
  // the brief whose hidden part is drawn is named by its whole path, since the path is its address
  return `<div class="ahead-box"><div class="chrome ahead-where">${pathHtml(t.address)}<span class="name">${esc(t.address === "" ? state.body!.title : t.title)}</span>${grain ? `<span class="dim">${grain}</span>` : ""}</div><svg class="fig ahead" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cells.join("")}</svg><div class="chrome ahead-name">${named ? esc(named.title) : "&nbsp;"}</div></div>`;
}

// ## 3.7 Links: beside each link, its target; at the foot, what points here

/** What is told of a link's target: its title and the opening words of its face, or that it leads to the web, is owed, or leaves the body. */
function adjHtml(to: string, detail: string): string {
  const target = brief(to);
  if (target) return `<div class="adj" data-a="${esc(to)}" ${hued(to)}>${pathHtml(to)}<span class="name" data-go="${esc(to)}">${esc(target.title)}</span><span class="gloss">${esc(faceOf(target))}</span></div>`;
  if (to === "web") return `<div class="adj dim"><span class="gloss">${esc(trim(detail || "the web", 40))}</span></div>`;
  if (to === "owed") return `<div class="adj dim"><span class="gloss">a brief not yet written</span></div>`;
  return `<div class="adj dim"><span class="gloss">outside the body: ${esc(trim(detail, 40))}</span></div>`;
}

/** Where a brief stands: the titles above it with a chevron between, whole, the root left out since it is the body. */
function pathHtml(to: string): string {
  const titles = prefixesOf(to).slice(1, -1).map((a) => brief(a)?.title ?? "");
  return titles.length ? `<span class="path">${titles.map((t) => `<span>${esc(t)}</span>`).join(CHEVRON)}</span>` : "";
}

/** The opening words of a brief's face. */
const faceOf = (b: Brief): string => trim(textOf([blocksOf(b).find((t) => t.type === "paragraph") ?? { type: "space" }]), 90);

/** What points at a brief, told at its foot. */
function footHtml(b: Brief): string {
  const refs = Array.from(state.index!.backlinks.get(b.address) ?? [], (r) => brief(r)).filter((x): x is Brief => !!x);
  return refs.length ? `<div class="adj foot"><span class="gloss">pointed at by</span>${refs.map((r) => `<span class="name" data-a="${esc(r.address)}" data-go="${esc(r.address)}" ${hued(r.address)}>${esc(r.title)}</span>`).join("")}</div>` : "";
}

const hostOf = (href: string): string => {
  try {
    return new URL(href).hostname;
  } catch {
    return "";
  }
};

function linkAdjuncts(b: Brief, article: HTMLElement): { at: HTMLElement | null; html: string }[] {
  const beside = all<HTMLElement>("a[data-link]", article).map((a) => ({ at: a, html: adjHtml(a.dataset.link!, a.dataset.link === "web" ? (a as HTMLAnchorElement).hostname : a.dataset.href ?? "") }));
  const foot = footHtml(b);
  return [...beside, ...(foot ? [{ at: null, html: foot }] : [])];
}

/** The links figure: what the brief in focus points at and what points at it, drawn in a wing while the gutter has no room. */
function pointersHtml(): string {
  const b = brief(state.focus);
  if (!b) return "";
  const beside = linksIn(b.body).map((l) => adjHtml(l.to ?? l.out ?? "outside", l.out === "web" ? hostOf(l.href ?? "") : l.href ?? ""));
  return `<div class="pointers"><div class="adj lead"><span class="gloss">${esc(b.title)}</span></div>${beside.join("")}${footHtml(b)}</div>`;
}

// ## 3.8 Settings: a row of meters

type Knob = { key: "zoom" | "ratio" | "leading" | "measure" | "gap" | "dim" | "fade" | "canvas"; row: "type" | "page" | "canvas"; name: string; min: number; max: number; step: number; glyph: string };
const KNOBS: Knob[] = [
  { key: "zoom", row: "type", name: "zoom", min: 0.75, max: 1.6, step: 0.05, glyph: `<path d="M8 4v8M4 8h8"/>` },
  { key: "ratio", row: "type", name: "heading ratio", min: 1, max: 1.6, step: 0.02, glyph: `<path d="M3 12h10M4.5 8.5h7M6 5h4"/>` },
  { key: "leading", row: "type", name: "line height", min: 1.2, max: 2.2, step: 0.05, glyph: `<path d="M6 4h7M6 8h7M6 12h7M3 4v8"/>` },
  { key: "measure", row: "type", name: "measure", min: 440, max: 900, step: 10, glyph: `<path d="M3 8h10M5 6v4M11 6v4"/>` },
  { key: "gap", row: "page", name: "gap between areas", min: 8, max: 64, step: 2, glyph: `<path d="M3 4v8M13 4v8M6 8h4"/>` },
  { key: "dim", row: "page", name: "dim the rest", min: 0, max: 0.8, step: 0.05, glyph: `<circle cx="8" cy="8" r="5"/><path d="M8 3a5 5 0 0 1 0 10z" fill="currentColor"/>` },
  { key: "fade", row: "page", name: "fade at the edges", min: 0, max: 20, step: 1, glyph: `<path d="M8 3v10M4.5 6a4.5 4.5 0 0 0 0 4M11.5 6a4.5 4.5 0 0 1 0 4"/>` },
  { key: "canvas", row: "canvas", name: "the canvas's greatest width", min: 360, max: 1600, step: 40, glyph: `<rect x="2.5" y="4" width="11" height="8" rx="1.5"/><path d="M5 8h6M6.5 6.5 5 8l1.5 1.5M9.5 6.5 11 8l-1.5 1.5"/>` },
];

/** An arc of a meter: 270 degrees from the lower left, clockwise, a fraction `t` of the way. */
function meterArc(t: number, r: number): string {
  const a0 = (135 * Math.PI) / 180;
  const a1 = a0 + t * 1.5 * Math.PI;
  const P = (a: number) => `${(20 + r * Math.cos(a)).toFixed(2)} ${(20 + r * Math.sin(a)).toFixed(2)}`;
  return `M ${P(a0)} A ${r} ${r} 0 ${t * 270 > 180 ? 1 : 0} 1 ${P(a1)}`;
}

function settingsHtml(): string {
  const s = state.settings;
  const knob = (k: Knob) => {
    const t = clamp((s[k.key] - k.min) / (k.max - k.min), 0, 1);
    const shown = k.key === "measure" || k.key === "gap" ? `${Math.round(s[k.key])}px` : k.key === "fade" ? `${Math.round(s[k.key])}%` : s[k.key].toFixed(2);
    return (
      `<div class="knob" data-knob="${k.key}" title="${k.name}: ${shown}">` +
      `<svg viewBox="0 0 40 40"><path class="track" d="${meterArc(1, 15)}"/><path class="value" d="${meterArc(Math.max(t, 0.002), 15)}"/><g class="glyph" transform="translate(12 12)">${k.glyph}</g></svg>` +
      `<span class="hint chrome dim">${k.name} ${shown}</span></div>`
    );
  };
  const row = (w: Switch) =>
    `<span class="name">${w.name}</span><span class="values">${w.values
      .map((v, i) => `<button class="pick${s[w.key] === v ? " on" : ""}" data-set="${w.key}" data-value="${v}">${w.labels?.[i] ?? v}</button>`)
      .join("")}</span>`;
  return `<div class="settings">${(["type", "page", "canvas"] as const).map((r) => `<div class="knobs">${KNOBS.filter((k) => k.row === r).map(knob).join("")}</div>`).join("")}<div class="switches chrome">${SWITCHES.map(row).join("")}</div></div>`;
}

/** The switches beneath the meters: a setting with a few named values, a row apiece. */
type Switch = { key: "flick" | "theme" | "headings" | "prose" | "line" | "weight" | "ahead"; name: string; values: (string | number)[]; labels?: string[] };
const SWITCHES: Switch[] = [
  { key: "theme", name: "theme", values: THEMES },
  { key: "headings", name: "headings", values: FACES },
  { key: "prose", name: "prose", values: FACES },
  { key: "line", name: "reading line", values: ["middle", "ends"] },
  { key: "weight", name: "weight", values: ["cost", "experience"] },
  { key: "ahead", name: "the ahead", values: ["hidden", "always"] },
  { key: "flick", name: "flick", values: [1, 0], labels: ["on", "off"] },
];

/** Turns one meter to its setting's value in place, so a drag never redraws the wing under the pointer. */
function drawMeter(el: HTMLElement): void {
  const k = KNOBS.find((k) => k.key === el.dataset.knob)!;
  const v = state.settings[k.key];
  const t = clamp((v - k.min) / (k.max - k.min), 0, 1);
  const shown = k.key === "measure" || k.key === "gap" ? `${Math.round(v)}px` : k.key === "fade" ? `${Math.round(v)}%` : v.toFixed(2);
  el.querySelector(".value")?.setAttribute("d", meterArc(Math.max(t, 0.002), 15));
  el.title = `${k.name}: ${shown}`;
  const hint = el.querySelector(".hint");
  if (hint) hint.textContent = `${k.name} ${shown}`;
}

const SETTINGS_KEY = "surface.settings";
function loadSettings(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (saved) state.settings = { ...DEFAULTS, ...saved, areas: { ...DEFAULTS.areas, ...(saved.areas ?? {}) } };
    if (saved && typeof saved.fade === "number" && saved.fade <= 1 && saved.dim === undefined) (state.settings.dim = saved.fade), (state.settings.fade = DEFAULTS.fade);
  } catch {}
  // an area once held one name, "none" when closed; it now holds a list, and anything it cannot hold is dropped
  AREAS.forEach(({ name, kind }) => {
    const held = state.settings.areas[name] as unknown;
    const list = Array.isArray(held) ? held : typeof held === "string" && held !== "none" ? [held] : [];
    state.settings.areas[name] = list.filter((k) => WIDGETS[k]?.kind === kind && k !== "none").slice(0, kind === "adjunct" ? 1 : 2);
  });
  state.settings.areas.middle = panesHeld(state.settings.areas.middle);
  if (state.settings.areas.middle.length === 0) state.settings.areas.middle = ["lane"];
  if (!THEMES.includes(state.settings.theme)) state.settings.theme = DEFAULTS.theme;
  if (!FACES.includes(state.settings.headings)) state.settings.headings = DEFAULTS.headings;
  if (!FACES.includes(state.settings.prose)) state.settings.prose = DEFAULTS.prose;
  if (state.settings.line !== "middle" && state.settings.line !== "ends") state.settings.line = DEFAULTS.line;
  if (state.settings.weight !== "cost" && state.settings.weight !== "experience") state.settings.weight = DEFAULTS.weight;
  if (state.settings.ahead !== "hidden" && state.settings.ahead !== "always") state.settings.ahead = DEFAULTS.ahead;
}
const saveSettings = (): void => void localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));

// ## 3.9 The shape: the lane as laid
//
// Each brief in the lane as its blocks, a paragraph a block as tall as it is
// drawn, shifted right by the brief's depth, with the viewport drawn over it.
// Dragging scrubs; pressing goes.

const SHAPE = { indent: 9, bar: 46, pad: 6, tail: 30, inset: 4 };

/** The width the shape stands in: its deepest possible row, whatever the lane is scoped to, with the marks beside it. */
const shapeWidth = (): number => SHAPE.pad * 2 + 4 + (state.index?.depth ?? 0) * SHAPE.indent + SHAPE.bar + 4 + 26 + SHAPE.tail;
/** The width the ahead stands in: its deepest possible row with its tail. */
const aheadWidth = (): number => SHAPE.pad * 2 + (state.index?.depth ?? 0) * SHAPE.indent + SHAPE.bar + 4 + SHAPE.tail;

/** One block drawn small: a heading a short bar, a paragraph a filled block, an image a frame, so no figure passes an image off as prose. */
const blockRect = (kind: ABlock["kind"], x: number, y: number, w: number, h: number): string =>
  kind === "image"
    ? `<rect class="image" x="${(x + 0.5).toFixed(1)}" y="${(y + 0.5).toFixed(1)}" width="${Math.max(1, w - 1)}" height="${Math.max(1, h - 1).toFixed(1)}" rx="1.5"/>`
    : `<rect class="${kind}" x="${x}" y="${y.toFixed(1)}" width="${w}" height="${h.toFixed(1)}" rx="1"/>`;

/** The lane's briefs and their blocks as laid, in the scroll box's own coordinates; an image's width is its share of the lane's. */
function laidBlocks(): { a: string; top: number; height: number; blocks: { top: number; height: number; kind: ABlock["kind"]; width: number }[] }[] {
  const c = ui.content.getBoundingClientRect().top;
  return all<HTMLElement>(".brief", ui.lane).map((el) => {
    const r = el.getBoundingClientRect();
    // a figure is two blocks, the image as a frame at its own width and the caption beneath it as text
    const blocks = all<HTMLElement>(":scope > *:not(.surface):not(.act), :scope > .surface > *:not(.act)", el).flatMap((b) => {
      const at = (x: Element, kind: ABlock["kind"], width = 1) => {
        const xr = x.getBoundingClientRect();
        return { top: xr.top - c, height: xr.height, kind, width };
      };
      if (b.tagName !== "FIGURE") return [at(b, b.tagName === "H1" || b.tagName === "H2" ? "head" : "para")];
      const img = b.querySelector("img, svg");
      const caption = b.querySelector("figcaption");
      return [img ? at(img, "image", Math.min(1, img.getBoundingClientRect().width / r.width) || 1) : at(b.firstElementChild ?? b, "para"), ...(caption ? [at(caption, "para")] : [])];
    });
    return { a: el.dataset.a!, top: r.top - c, height: r.height, blocks };
  });
}

function shapeSvg(W: number, H: number): string {
  const box = ui.scroll;
  const laid = laidBlocks();
  const total = Math.max(1, box.scrollHeight);
  const k = (H - 8) / total;
  const ix = state.index!;
  // the levels above the scope stand to the left of the opening's row, a tick per ancestor, outermost leftmost
  const anc = prefixesOf(state.scope).slice(0, -1);
  const L = anc.length ? anc.length * 8 + 4 : 0;
  // the shape stands in its own width, never a wider figure's beside it in the same wing
  const w = Math.min(W, shapeWidth());
  const cells = laid.map((l) => {
    const x = SHAPE.pad + L + depthIn(l.a) * SHAPE.indent;
    const bars = l.blocks
      .map((b) => blockRect(b.kind, x, 4 + b.top * k, b.kind === "head" ? Math.round(SHAPE.bar * 0.6) : Math.max(4, Math.round(SHAPE.bar * b.width)), Math.max(1.2, b.height * k - 1)))
      .join("");
    // beside the face a brief tells what it hides, or would hide: a tick per paragraph and a small frame per image, then
    // a grey tail as long as the levels beneath are heavy; drawn when folded, and as a ghost under the pointer when unfolded
    const b = brief(l.a);
    const folded = b !== undefined && gradeOf(l.a) === "face";
    const ghost = folded ? "" : " ghost";
    const beyond = b ? blocksOf(b).slice(1) : [];
    const paras = beyond.length;
    const hidden = b && level(l.a).length > 0 ? ix.branch.get(l.a)! - ix.own.get(l.a)! : 0;
    const face = l.blocks[1] ?? l.blocks[0];
    const y = face ? (4 + face.top * k).toFixed(1) : "0";
    const h = face ? Math.max(1.2, face.height * k - 1).toFixed(1) : "1";
    // the marks keep to the room the shape declares for them, so a brief of many images stops where eight ticks would
    const t0 = x + SHAPE.bar + 4;
    let tx = t0;
    const ticks =
      face && b
        ? beyond
            .map((t) => {
              const image = t.type === "image";
              if (tx - t0 + (image ? 5 : 2) > 24) return "";
              const tick = image ? `<rect class="tick image${ghost}" x="${tx + 0.5}" y="${y}" width="4" height="${h}" rx="1"/>` : `<rect class="tick${ghost}" x="${tx}" y="${y}" width="1.6" height="${h}"/>`;
              tx += image ? 7 : 3;
              return tick;
            })
            .join("")
        : "";
    tx += paras ? 2 : 0;
    const tailW = hidden > 0 ? clamp(3 + Math.sqrt(hidden) / 4, 3, SHAPE.tail) : 0;
    const tail = hidden > 0 && face ? `<rect class="hidden${ghost}" x="${tx}" y="${y}" width="${tailW.toFixed(1)}" height="${h}" rx="1"/>` : "";
    const marksEnd = tx + tailW + (paras || hidden ? 8 : 0);
    // the opening's row carries the levels above to its left, each a press that scopes out to it
    const first = l.blocks[0];
    const above =
      l.a === state.scope && first
        ? anc.map((a, i) => `<g class="cell above" data-a="${esc(a)}" data-scope="${esc(a)}" ${hued(a)}><rect class="hit" x="${SHAPE.pad + i * 8 - 1}" y="${(4 + first.top * k - 4).toFixed(1)}" width="8" height="${(Math.max(10, first.height * k) + 8).toFixed(1)}"/><rect class="head" x="${SHAPE.pad + i * 8}" y="${(4 + first.top * k).toFixed(1)}" width="6" height="${Math.max(10, first.height * k - 1).toFixed(1)}" rx="1.5"/></g>`).join("")
        : "";
    // two presses: the blocks go to the brief; the room to their right, where what is hidden stands, folds or unfolds it,
    // the levels above are drawn last, so they take the press
    const top = (4 + l.top * k).toFixed(1);
    const height = Math.max(1, l.height * k).toFixed(1);
    // rows touch, so the room keeps to its own row; only a row thinner than a pointer can find is given height, to six pixels
    const grow = Math.max(0, (6 - l.height * k) / 2);
    const fy = Math.max(0, 4 + l.top * k - grow).toFixed(1);
    const fh = (Math.max(1, l.height * k) + 2 * grow).toFixed(1);
    return (
      `<g class="cell${l.a === state.focus ? " here" : ""}" data-a="${esc(l.a)}" ${hued(l.a)}>` +
      `<rect class="hit" data-press="go" x="${x - 3}" y="${top}" width="${SHAPE.bar + 5}" height="${height}"/>` +
      (paras || hidden ? `<rect class="hit" data-press="fold" x="${x + SHAPE.bar + 2}" y="${fy}" width="${Math.max(6, marksEnd - x - SHAPE.bar - 2)}" height="${fh}"/>` : "") +
      `${bars}${ticks}${tail}</g>` +
      above
    );
  });
  return `<svg class="fig shape" data-k="${k}" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">${cells.join("")}<rect class="cursor" x="0" y="${(4 + box.scrollTop * k).toFixed(1)}" width="${w}" height="${(box.clientHeight * k).toFixed(1)}" rx="4"/></svg>`;
}

function drawShapeCursor(): void {
  all<SVGSVGElement>("svg.shape", ui.areas).forEach((svg) => {
    const k = Number(svg.dataset.k);
    svg.querySelector<SVGRectElement>(".cursor")!.setAttribute("y", (4 + ui.scroll.scrollTop * k).toFixed(1));
  });
}

// ## 3.10 The plate: the body, as droplets

const PLATE = { gap: 2.6, floor: 7, round: 9 };

/** The room between siblings at a depth, along the arc: wide between the root's branches, narrowing outward. */
const sideGap = (d: number): number => [0, 14, 6, 3][d] ?? 2;

type Drop = { a: string; r0: number; r1: number; a0: number; a1: number; more: boolean; label: string | null };

/** Lays the body out radially inside a square of side `S`: sector by branch weight, ring by depth, every level to the rim. */
function layoutPlate(S: number): { drops: Drop[]; rc: number } {
  const ix = state.index!;
  const D = Math.max(1, ix.depth);
  const R = (S / 2) * 0.97;
  const t = R / (D + 1);
  const rc = t;
  const ring = (d: number) => ({ r0: rc + (d - 1) * t + PLATE.gap / 2, r1: rc + d * t - PLATE.gap / 2 });
  const full = (span: number) => span >= 2 * Math.PI - 1e-6;
  // the plate shows the whole topology: no level is left undrawn, so the room between siblings and the floor a cell keeps
  // both yield when a level is crowded, and cells go to slivers rather than away
  const lay = (parent: string, a0: number, span: number, d: number): Drop[] => {
    const kids = level(parent);
    if (kids.length === 0 || d > D) return [];
    const { r0, r1 } = ring(d);
    const n = kids.length;
    const gap = Math.min(sideGap(d) / r0, span / (3 * n));
    const usable = span - (full(span) ? n : n - 1) * gap;
    const floor = Math.min(Math.max(PLATE.floor, (r1 - r0) * 0.2) / r0, usable / n);
    const angles = spread(
      kids.map((k) => Math.max(1, ix.branch.get(k.address)!)),
      usable,
      floor,
    );
    const starts = offsets(angles, gap).map((x) => x + (full(span) ? gap / 2 : 0));
    return kids.flatMap((k, i) => {
      const chord = 2 * r0 * Math.sin(Math.min(Math.PI, angles[i]) / 2);
      const drop: Drop = { a: k.address, r0, r1, a0: a0 + starts[i], a1: a0 + starts[i] + angles[i], more: false, label: chord > 40 && r1 - r0 > 15 ? k.title : null };
      return [drop, ...lay(k.address, drop.a0, angles[i], d + 1)];
    });
  };
  return { drops: lay("", -Math.PI / 2, 2 * Math.PI, 1), rc };
}

/** A droplet: an annular sector with rounded corners, or a full ring when the sector is whole. */
function dropletPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, round: number): string {
  const P = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const span = a1 - a0;
  if (span >= 2 * Math.PI - 1e-6) {
    const o = (r: number) => `M ${P(r, 0)} A ${r} ${r} 0 1 1 ${P(r, Math.PI)} A ${r} ${r} 0 1 1 ${P(r, 0)} Z`;
    return `${o(r1)} ${o(r0)}`;
  }
  const rho = Math.max(0.5, Math.min(round, (r1 - r0) / 2, (r0 * span) / 2));
  const d0 = rho / r0;
  const d1 = rho / r1;
  const large = (s: number) => (s > Math.PI ? 1 : 0);
  return [
    `M ${P(r0, a0 + d0)}`,
    `A ${r0} ${r0} 0 ${large(span - 2 * d0)} 1 ${P(r0, a1 - d0)}`,
    `Q ${P(r0, a1)} ${P(r0 + rho, a1)}`,
    `L ${P(r1 - rho, a1)}`,
    `Q ${P(r1, a1)} ${P(r1, a1 - d1)}`,
    `A ${r1} ${r1} 0 ${large(span - 2 * d1)} 0 ${P(r1, a0 + d1)}`,
    `Q ${P(r1, a0)} ${P(r1 - rho, a0)}`,
    `L ${P(r0 + rho, a0)}`,
    `Q ${P(r0, a0)} ${P(r0, a0 + d0)}`,
    "Z",
  ].join(" ");
}

/** The largest extent the plate is drawn at, across or down. */
const PLATE_SIDE = 260;

/**
 * The extent of the plate's ink in a square of side `S`: the centre and every droplet, sampled along its arcs. A plate
 * is round only where the body is; a level that fills one side leaves the other empty, so the figure is cut to its ink.
 */
function plateInk(S: number): { x: number; y: number; w: number; h: number } {
  const { drops, rc } = layoutPlate(S);
  const c = S / 2;
  const xs = [c - rc, c + rc];
  const ys = [c - rc, c + rc];
  drops.forEach((d) => {
    for (let i = 0; i <= 8; i++) {
      const a = d.a0 + ((d.a1 - d.a0) * i) / 8;
      [d.r0, d.r1].forEach((r) => (xs.push(c + r * Math.cos(a)), ys.push(c + r * Math.sin(a))));
    }
  });
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * The side of the square a plate is laid in for a room: its ink as large as the room and the plate's side allow. The
 * gaps between droplets keep their size as the plate scales, so the ink does not scale evenly, and it is settled in a
 * few steps at the size itself.
 */
const plateScale = (W: number, H: number): number => {
  let S = 1000;
  for (let i = 0; i < 5; i++) {
    const ink = plateInk(S);
    S *= Math.min(W / ink.w, H / ink.h, PLATE_SIDE / Math.max(ink.w, ink.h));
  }
  return Math.floor(S);
};

/** The width the plate stands in: its ink, drawn at the plate's side. */
const plateWidth = (): number => (state.index ? Math.ceil(plateInk(plateScale(Infinity, Infinity)).w) : PLATE_SIDE);

function plateSvg(W: number, H: number): string {
  const S = plateScale(W, H);
  if (S < 80) return "";
  const { drops, rc } = layoutPlate(S);
  const c = S / 2;
  const onPath = new Set(prefixesOf(state.focus));
  const cls = (d: Drop) => `${onPath.has(d.a) ? " on" : ""}${d.a === state.focus ? " here" : ""}${inLane(d.a) ? "" : " away"}`;
  const cells = drops.map((d) => `<g class="cell${cls(d)}" data-a="${esc(d.a)}" ${hued(d.a)}><path d="${dropletPath(c, c, d.r0, d.r1, d.a0, d.a1, PLATE.round)}"/></g>`);
  const labels = drops
    .filter((d) => d.label)
    .map((d) => {
      const mid = (d.a0 + d.a1) / 2;
      const rm = (d.r0 + d.r1) / 2;
      const chord = 2 * d.r0 * Math.sin(Math.min(Math.PI, d.a1 - d.a0) / 2);
      return `<text class="label${onPath.has(d.a) ? " on" : ""}${d.a === state.focus ? " here" : ""}" data-a="${esc(d.a)}" x="${(c + rm * Math.cos(mid)).toFixed(1)}" y="${(c + rm * Math.sin(mid)).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(trim(d.label!, Math.floor((chord - 8) / 5.6)))}</text>`;
    });
  const centre = `<g class="cell centre${state.focus === "" ? " on" : ""}" data-a=""><circle cx="${c}" cy="${c}" r="${(rc - PLATE.gap / 2).toFixed(1)}"/><text class="label" x="${c}" y="${c}" text-anchor="middle" dominant-baseline="middle">${esc(trim(state.body!.title, Math.floor(rc / 3.4)))}</text></g>`;
  const ink = plateInk(S);
  return `<svg class="fig plate" width="${Math.ceil(ink.w)}" height="${Math.ceil(ink.h)}" viewBox="${ink.x.toFixed(1)} ${ink.y.toFixed(1)} ${ink.w.toFixed(1)} ${ink.h.toFixed(1)}">${cells.join("")}${centre}${labels.join("")}</svg>`;
}

// ## 3.11 The canvas: the scope as nodes
//
// The scope's root stands at the top as the entry, and its level beneath it as
// a column, each brief a node. Folded, a node is its row, with marks for what
// it hides. Whole, its row holds a zone beneath it holding its level as a
// column again, or as a row of columns when the level is a set. The nodes are
// HTML laid out by the browser; one SVG over them draws the arrows from each
// step to the next once the nodes are measured; and pan and zoom are one
// transform on the stage, kept in the browser like the lane.

type View = { x: number; y: number; k: number };
const view: View = { x: 24, y: 24, k: 1 };
/** The scope the canvas was last fitted to, so a change of scope fits again and a fold does not. */
let fitted: string | null = null;
let followed = "";

const canvasOn = (): boolean => !ui.canvas.hidden;
const stage = (): HTMLElement | null => ui.canvas.querySelector<HTMLElement>("#stage");

/** A brief's number counted from the scope root, so the nesting reads from where the reader stands: 2.1 under the scope's second brief. */
function scopedNumber(b: Brief): string {
  const parts = prefixesOf(b.address)
    .filter((a) => a !== "" && within(a, state.scope) && a !== state.scope)
    .map((a) => {
      const parent = brief(parentOf(a));
      const i = level(parentOf(a)).findIndex((k) => k.address === a);
      return parent?.set ? letterOf(i) : `${i + 1}`;
    });
  return parts.length === 1 ? `${parts[0]}.` : parts.join(".");
}

/** One node: its row, and beneath it its zone when it is whole and has a level. */
function canvasNodeHtml(b: Brief): string {
  const whole = gradeOf(b.address) === "whole";
  const kids = level(b.address);
  const rest = blocksOf(b).slice(1);
  const beneath = beneathOf(b);
  const on = prefixesOf(state.focus).includes(b.address);
  // a folded node says what it hides: a bar per paragraph, a frame per image, and a tail as long as its level is heavy
  const tail = beneath ? Math.round(Math.min(64, 8 + Math.log2(1 + (state.index!.branch.get(b.address) ?? 0) / 400) * 10)) : 0;
  const marks =
    !whole && (rest.length || beneath)
      ? `<span class="marks">${rest.slice(0, 8).map((t) => (t.type === "image" ? `<i class="image"></i>` : `<i></i>`)).join("")}${tail ? `<b class="tail" style="--w:${tail}px"></b>` : ""}</span>`
      : "";
  const home = b.borrow !== undefined ? brief(b.borrow) : undefined;
  const borrowed = home ? `<span class="borrowed" data-a="${esc(home.address)}" data-tip="borrows ${esc(home.title || state.body!.title)}">${icon("links")}</span>` : "";
  const row = `<div class="crow${on ? " on" : ""}${b.address === state.focus ? " here" : ""}" data-a="${esc(b.address)}"><span class="num">${esc(scopedNumber(b))}</span><span class="title">${esc(b.title)}</span>${marks}${borrowed}</div>`;
  const line = `<div class="cline">${portHtml(b, "in")}${row}${portHtml(b, "out")}</div>`;
  // a borrowing node's zone is its home's level, named as such; a folded borrowed brief is drawn at its face
  const zoneOf = home ? level(home.address) : kids;
  const label = home && whole && zoneOf.length ? `<div class="zlabel">${icon("links")}<span>borrows</span>${pathHtml(home.address)}<span class="name">${esc(home.title || state.body!.title)}</span></div>` : "";
  const set = home ? home.set : b.set;
  const zone = whole && zoneOf.length ? `<div class="czone${set ? " set" : ""}${home ? " borrowed" : ""}" data-fold="${esc(b.address)}">${label}${zoneOf.map(canvasNodeHtml).join("")}</div>` : "";
  // a nested row is a step narrower per level, so the nesting shows in the rows themselves and not only in the edges
  return `<div class="cnode${zone ? " whole" : ""}" style="--h:${hueOf(b.address)};--d:${Math.max(0, depthIn(b.address) - 1)}">${line}${zone}</div>`;
}

/** How many cells a port shows before the rest collapse into a count. */
const PORT_SHOWN = 5;

/** A node's port: what points at it on the left, what it points at on the right, a cell per brief in its hue. */
function portHtml(b: Brief, side: "in" | "out"): string {
  const ix = state.index!;
  const backs = Array.from(ix.backlinks.get(b.address) ?? []);
  // borrowers stand first among what leads to a brief, since a borrow is a place its level stands and a link an offer
  const list = side === "in" ? [...backs.filter((a) => brief(a)?.borrow === b.address), ...backs.filter((a) => brief(a)?.borrow !== b.address)] : Array.from(new Set(linksIn(b.body).flatMap((l) => (l.to !== undefined && l.to !== b.address ? [l.to] : []))));
  const shown = list.filter((a) => brief(a)).slice(0, list.length > PORT_SHOWN + 1 ? PORT_SHOWN : PORT_SHOWN + 1);
  const more = list.length - shown.length;
  const cells = shown.map((a) => `<i class="pc" data-a="${esc(a)}" ${hued(a)}></i>`).join("");
  return `<span class="port ${side}">${side === "in" && more ? `<b class="pc more" data-tip="${more} more">+${more}</b>` : ""}${cells}${side === "out" && more ? `<b class="pc more" data-tip="${more} more">+${more}</b>` : ""}</span>`;
}

/** Draws the canvas whole from the state: the entry, the column beneath it, then the arrows; fits the view when the scope changed. */
function drawCanvas(): void {
  if (!canvasOn() || !state.body) return;
  const S = state.scope;
  const root = brief(S)!;
  // the entry is the scope's root, named at the top; at the root of the body there is nothing above the first brief, so
  // the column simply begins with it
  const entry = S ? `<div class="cnode entry" ${hued(S)}><div class="crow root${state.focus === S ? " here" : ""}" data-a="${esc(S)}"><span class="title">${esc(root.title)}</span></div></div>` : "";
  ui.canvas.innerHTML = `<div id="stage"><svg id="edges"></svg><div class="ccol${root.set ? " set" : ""}">${entry}${level(S).map(canvasNodeHtml).join("")}</div></div>`;
  if (fitted !== S) {
    fitCanvas();
    fitted = S;
  }
  applyView(false);
  drawEdges();
}

/** The arrows: from the foot of each node to the head of the next, in every column that is a sequence, measured under the transform. */
function drawEdges(): void {
  const st = stage();
  const svg = st?.querySelector<SVGSVGElement>("#edges");
  if (!st || !svg) return;
  const k = view.k;
  const s0 = st.getBoundingClientRect();
  const at = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { left: (r.left - s0.left) / k, top: (r.top - s0.top) / k, right: (r.right - s0.left) / k, bottom: (r.bottom - s0.top) / k };
  };
  const paths: string[] = [];
  all<HTMLElement>(".ccol:not(.set), .czone:not(.set)", st).forEach((col) => {
    const nodes = Array.from(col.children).filter((c) => c.classList.contains("cnode"));
    nodes.slice(0, -1).forEach((n, i) => {
      const a = at(n);
      const row = nodes[i + 1].querySelector(".crow")!;
      const b = at(row);
      // flush with the node it leaves, short of the node it reaches, the head the end of its line
      const x = (b.left + b.right) / 2;
      const y1 = a.bottom;
      const y2 = b.top - 4;
      if (y2 - y1 < 6) return;
      paths.push(`<path class="arrow" d="M${x.toFixed(1)} ${y1.toFixed(1)}L${x.toFixed(1)} ${(y2 - 3).toFixed(1)}M${(x - 2.5).toFixed(1)} ${(y2 - 3).toFixed(1)}L${x.toFixed(1)} ${y2.toFixed(1)}L${(x + 2.5).toFixed(1)} ${(y2 - 3).toFixed(1)}"/>`);
    });
  });
  // the links of the highlighted node leave its right side and arrive at the target's right side, as a bracket in the
  // margin, and the target's cell for it lights; an in-cell pointed at draws its line on the left side instead, from
  // the cell to the source's left. Lines never cross the nodes
  all<HTMLElement>(".pc.tie", st).forEach((c) => c.classList.remove("tie"));
  const rowOf = (x: string) => st.querySelector<HTMLElement>(`.cline > .crow[data-a="${cssEsc(x)}"]`);
  const bracket = (x1: number, y1: number, x2: number, y2: number, dir: 1 | -1, to: string) => {
    const d = dir * (44 + Math.abs(y2 - y1) * 0.12);
    return `<path class="link" ${hued(to)} d="M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + d).toFixed(1)} ${y1.toFixed(1)},${(x2 + d).toFixed(1)} ${y2.toFixed(1)},${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  };
  const mid = (q: { top: number; bottom: number }) => (q.top + q.bottom) / 2;
  const hovIn = st.querySelector<HTMLElement>(".port.in .pc[data-a]:hover");
  if (hovIn) {
    const row = hovIn.closest(".cline")!.querySelector<HTMLElement>(".crow")!;
    const from = rowOf(hovIn.dataset.a!);
    if (from && from !== row) {
      const r = at(row);
      const q = at(from);
      paths.push(bracket(r.left, mid(r), q.left, mid(q), -1, hovIn.dataset.a!));
    }
  } else {
    const hovOut = st.querySelector<HTMLElement>(".port.out .pc[data-a]:hover");
    const a = hovOut ? hovOut.closest(".cline")!.querySelector<HTMLElement>(".crow")!.dataset.a! : state.pointed ?? state.focus;
    const row = rowOf(a);
    if (row) {
      const r = at(row);
      const cells = hovOut ? [hovOut] : all<HTMLElement>(".port.out .pc[data-a]", row.parentElement!);
      cells.forEach((c) => {
        const t = rowOf(c.dataset.a!);
        if (!t || t === row) return;
        const q = at(t);
        paths.push(bracket(r.right, mid(r), q.right, mid(q), 1, c.dataset.a!));
        t.parentElement!.querySelector(`.port.in .pc[data-a="${cssEsc(a)}"]`)?.classList.add("tie");
      });
    }
  }
  svg.setAttribute("width", `${Math.ceil(st.scrollWidth)}`);
  svg.setAttribute("height", `${Math.ceil(st.scrollHeight)}`);
  svg.innerHTML = paths.join("");
}

// ### 3.11.1 The depth: every brief in the scope unfolded to a depth, and folded beyond it

/** The deepest level beneath the scope root, counted from it. */
const scopeDepth = (): number => Math.max(0, ...state.body!.briefs.filter((b) => within(b.address, state.scope)).map((b) => depthIn(b.address)));

/** The depth the scope stands unfolded to: the largest such that every brief with a level above it is whole. */
function unfoldedDepth(): number {
  let d = 0;
  while (d < scopeDepth() && state.body!.briefs.every((b) => !within(b.address, state.scope) || depthIn(b.address) !== d || levelOf(b).length === 0 || gradeOf(b.address) === "whole")) d++;
  return d;
}

/** The depth strip, in the way down: a cell per level beneath the scope, the unfolded depth marked; pressing or scrubbing across sets it, in the lane as on the canvas. */
function depthHtml(): string {
  const n = scopeDepth();
  if (n === 0) return "";
  const unfolded = unfoldedDepth();
  return `<div id="depth" data-tip="how far the scope is unfolded">${Array.from({ length: n }, (_, i) => `<span class="dc${i + 1 <= unfolded ? " on" : ""}" data-depth="${i + 1}">${i + 1}</span>`).join("")}</div>`;
}

/** Unfolds every brief of the scope to a depth and folds everything beyond, as one change the reader can undo. */
function unfoldTo(n: number): void {
  const inScope = state.body!.briefs.filter((b) => b.address !== state.scope && within(b.address, state.scope));
  refold(() => {
    inScope.filter((b) => depthIn(b.address) === n && inLane(b.address)).forEach((b) => setGrade(b.address, "face"));
    inScope
      .filter((b) => depthIn(b.address) < n && unfolds(b))
      .sort((x, y) => depthOf(x.address) - depthOf(y.address))
      .forEach((b) => setGrade(b.address, "whole"));
  });
}

/** Applies the view to the stage, easing when asked. */
function applyView(ease: boolean): void {
  const st = stage();
  if (!st) return;
  st.classList.toggle("easing", ease);
  st.style.transform = `translate(${view.x.toFixed(1)}px, ${view.y.toFixed(1)}px) scale(${view.k.toFixed(3)})`;
  // the type shrinks slower than the boxes, by the square root of the zoom, so names stay readable as the overview grows
  const kz = (1 / Math.sqrt(view.k)).toFixed(3);
  if (st.style.getPropertyValue("--kz") !== kz) {
    st.style.setProperty("--kz", kz);
    requestAnimationFrame(drawEdges);
  }
  rememberView();
}

/** Fits the scope to the canvas's width, never larger than life and never smaller than reads, and stands it at the top. */
function fitCanvas(): void {
  const st = stage();
  if (!st) return;
  const W = ui.canvas.clientWidth;
  const w = st.scrollWidth || 1;
  view.k = clamp((W - 2 * CANVAS_INSET) / w, 0.6, 1);
  view.x = Math.max(CANVAS_INSET, (W - w * view.k) / 2);
  view.y = CANVAS_INSET;
}

/** Brings the brief in focus into view when it is not, easing there; a focus already in view moves nothing. */
function followFocus(): void {
  const st = stage();
  if (!st || followed === state.focus) return;
  followed = state.focus;
  const row = st.querySelector<HTMLElement>(`.crow[data-a="${cssEsc(state.focus)}"]`);
  if (!row) return;
  const c = ui.canvas.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const inside = r.top >= c.top + CANVAS_INSET && r.bottom <= c.bottom - CANVAS_INSET && r.left >= c.left && r.right <= c.right;
  if (inside) return;
  const s0 = st.getBoundingClientRect();
  const y = (r.top - s0.top) / view.k;
  view.y = Math.round(c.height / 3 - y * view.k);
  if (r.left < c.left || r.right > c.right) view.x = Math.round(c.width / 2 - ((r.left - s0.left) / view.k + row.offsetWidth / 2) * view.k);
  applyView(true);
}

/** Zooms about a point of the canvas, so what is under the pointer stays under it. */
function zoomAt(px: number, py: number, factor: number): void {
  const k = clamp(view.k * factor, 0.25, 2);
  const c = ui.canvas.getBoundingClientRect();
  const x = px - c.left;
  const y = py - c.top;
  view.x = x - (x - view.x) * (k / view.k);
  view.y = y - (y - view.y) * (k / view.k);
  view.k = k;
  applyView(false);
}

const viewKey = (): string => `surface.view:${laneKey()}`;
let viewTimer: ReturnType<typeof setTimeout> | undefined;
function rememberView(): void {
  clearTimeout(viewTimer);
  viewTimer = setTimeout(() => {
    try {
      localStorage.setItem(viewKey(), JSON.stringify({ ...view, scope: state.scope }));
    } catch {}
  }, 150);
}
/** The view as the reader left it for this scope, if any, so a reload keeps the canvas where it stood. */
function recallView(): void {
  try {
    const kept = JSON.parse(localStorage.getItem(viewKey()) ?? "null");
    if (kept && kept.scope === state.scope && typeof kept.k === "number") Object.assign(view, { x: kept.x, y: kept.y, k: kept.k }), (fitted = state.scope);
  } catch {}
}

// ## 3.12 Drawing, and drawing again
//
// From here on the functions touch the document. Each draws one thing from the
// state, and drawAll draws them all in order.

type UI = { header: HTMLElement; crumb: HTMLElement; pull: HTMLElement; tip: HTMLElement; areas: HTMLElement; canvas: HTMLElement; scroll: HTMLElement; content: HTMLElement; lane: HTMLElement; notice: HTMLElement; parts: Record<AreaName, HTMLElement>; strips: HTMLElement };
let ui: UI;

const all = <T extends Element>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel));
const cssEsc = (s: string): string => s.replace(/["\\]/g, "\\$&");

const GUTTER = 210;
/** The room beneath a wing's figures that its strip stands in, above the space every area keeps. */
const STRIP = 34;
/** The room the foot keeps clear: the strip's icons with as much above them as below. */
const FOOT = STRIP + 10;
/** Where the prose's fade lies at each edge of the lane: clear from the edge to here, then fading in over the fade setting. */
const RIM = { top: 3, foot: 6 };

/**
 * The band a wing's figures stand in, as tall as the prose reads: from the middle of the fade at the top to the middle
 * of the fade at the foot, where the prose stands half seen, so no figure reaches further up or down than the prose
 * does. It keeps at least one gap at the top, and the strip's room and a gap at the foot.
 */
/** Where the prose is clear of the top edge: a share of the height, or below the way down to the scope when it stands. */
const rimTop = (h: number): number => Math.max((h * RIM.top) / 100, ui.crumb.hidden ? 0 : ui.crumb.offsetTop + ui.crumb.offsetHeight + 8);

function band(h: number): { top: number; height: number } {
  const s = state.settings;
  const top = Math.max(s.gap, rimTop(h) + (h * s.fade) / 2 / 100);
  const foot = Math.max(s.gap + STRIP, FOOT + (h * s.fade) / 2 / 100);
  return { top: Math.round(top), height: Math.max(0, Math.round(h - top - foot)) };
}

/** What each area holds, as the settings keep it or as a press would leave it. */
type Held = Record<AreaName, string[]>;

/** How wide an area stands with what it holds: closed, nothing; a gutter its column; a wing its widest figure, its strip free to reach a little past it; the middle is laid apart. */
const widthIn = (held: Held, area: AreaName): number =>
  held[area].length === 0 || area === "middle" ? 0 : area.startsWith("gutter") ? GUTTER : Math.max(...held[area].map((k) => (WIDGETS[k]?.kind === "figure" ? (WIDGETS[k] as Figure).width() : 0)));
const widthOf = (area: AreaName): number => widthIn(state.settings.areas, area);
/** A closed area takes no room at all; its strip stands at the foot of where it would open. */
const takesRoom = (area: AreaName): boolean => isOpen(area);

/**
 * Which areas the width allows, taken in the order they give way last: after the lane, the left wing, then the right
 * wing, then the gutters as a pair. So as the viewport narrows the gutters go first, then the right wing, then the
 * left, and the lane stands alone. An open area costs its own width and one space; a closed one costs nothing and is
 * always allowed, since all it shows is its strip.
 */
/** Which areas the width allows, and which panes of the middle. */
type Fit = Record<AreaName, boolean> & { canvas: boolean; lane: boolean };
function fitsWith(held: Held): Fit {
  const s = state.settings;
  const on: Fit = { wingL: false, gutterL: false, middle: true, gutterR: false, wingR: false, canvas: false, lane: false };
  AREAS.forEach(({ name }) => name !== "middle" && (on[name] = held[name].length === 0));
  // the middle first: the lane at its measure, the canvas at its least width beside it; too narrow for both, the canvas gives way, since the lane is the reading
  const panes = panesHeld(held.middle);
  on.lane = panes.includes("lane");
  on.canvas = panes.includes("canvas");
  let used = (on.lane ? s.measure + 2 * s.gap : 0) + (on.canvas ? CANVAS_MIN + (on.lane ? s.gap : 2 * s.gap) : 0);
  if (on.lane && on.canvas && used > ui.areas.clientWidth) (on.canvas = false), (used = s.measure + 2 * s.gap);
  for (const group of [["wingL"], ["wingR"], ["gutterL", "gutterR"]] as AreaName[][]) {
    // the gutters belong to the lane and stand only beside it
    if (group[0] === "gutterL" && !on.lane) break;
    const need = group.reduce((x, a) => x + (held[a].length ? widthIn(held, a) + s.gap : 0), 0);
    if (used + need > ui.areas.clientWidth) break;
    used += need;
    group.forEach((a) => (on[a] = true));
  }
  return on;
}
const fits = (): Fit => fitsWith(state.settings.areas);

/** Applies the settings: type registers from zoom and ratio, and the row of areas from measure, gap and what is open. */
function drawLayout(): void {
  const s = state.settings;
  const root = document.documentElement.style;
  const base = 17 * s.zoom;
  // each face is sized to the serif's x-height, so changing the face never changes how large the text reads
  const body = base * sizeOf(s.prose);
  const head = base * sizeOf(s.headings);
  // the lines are spaced from the serif's size, so changing the face never changes the spacing of the lines
  root.setProperty("--leading", `${(base * s.leading).toFixed(2)}px`);
  root.setProperty("--body", `${body.toFixed(2)}px`);
  root.setProperty("--t", `${(head * s.ratio ** 3).toFixed(2)}px`);
  root.setProperty("--h1", `${(head * s.ratio ** 2).toFixed(2)}px`);
  root.setProperty("--h2", `${(head * s.ratio).toFixed(2)}px`);
  root.setProperty("--h3", `${(head * Math.sqrt(s.ratio)).toFixed(2)}px`);
  root.setProperty("--h4", `${head.toFixed(2)}px`);
  root.setProperty("--prose-face", FACE[s.prose].family);
  root.setProperty("--head-face", FACE[s.headings].family);
  // a monospace face is spaced by its grid, so the tightening a proportional heading takes is left out
  root.setProperty("--head-tight", s.headings === "mono" ? "0" : "1");
  root.setProperty("--gap", `${s.gap}px`);
  root.setProperty("--dim", `${s.dim}`);
  root.setProperty("--edge", `${s.fade}%`);
  root.setProperty("--rim-top", `${RIM.top}%`);
  // the prose clears the foot by the strip's room, as it clears the way down at the top, so the two fades balance
  root.setProperty("--rim-foot", `${FOOT}px`);
  // the theme picks a side of every colour; the system setting leaves it to the browser, so nothing flashes
  if (s.theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s.theme;
  const on = fits();
  // a viewport narrower than the measure gives the lane what there is
  const measure = Math.min(s.measure, ui.areas.clientWidth - 2 * s.gap);
  root.setProperty("--measure", `${measure}px`);
  // the gutters hug the lane at the gap, since what stands in them is aligned to its lines; only what the width allows
  // takes a column, since an absent element leaves the grid and would pull the lane into the empty track it left
  const inner = (["gutterL", "lane", "gutterR"] as const).flatMap((a) => (a === "lane" ? [measure] : on[a] && takesRoom(a) ? [widthOf(a)] : []));
  const mid = inner.reduce((x, y) => x + y, 0) + s.gap * (inner.length - 1);
  // every area is as wide as what it holds, and the spaces beside them are one: at the two edges of the viewport as
  // between the wings and the lane. The gap is the least a space is given, and what the width leaves over is shared
  // among the spaces evenly, so no area carries room it does not use
  // with the canvas standing, the spaces are the gap exactly and the canvas takes what is left; without it they share what is left
  const space = on.canvas ? `${s.gap}px` : `minmax(${s.gap}px, 1fr)`;
  const tracks = [space];
  const place = (el: HTMLElement, width: string) => {
    tracks.push(width, space);
    el.style.gridColumn = `${tracks.length - 1}`;
  };
  if (on.wingL && takesRoom("wingL")) place(ui.parts.wingL, `${widthOf("wingL")}px`);
  // the canvas grows to its greatest width and no further, so the row stays centred with its space around it
  if (on.canvas) place(ui.canvas, `minmax(${CANVAS_MIN}px, ${Math.max(CANVAS_MIN, s.canvas)}px)`);
  if (on.lane) place(ui.scroll, `${mid}px`);
  if (on.wingR && takesRoom("wingR")) place(ui.parts.wingR, `${widthOf("wingR")}px`);
  ui.areas.style.gridTemplateColumns = tracks.join(" ");
  ui.areas.style.columnGap = "0px";
  ui.content.style.gridTemplateColumns = inner.map((x) => `${x}px`).join(" ");
  ui.content.style.columnGap = `${s.gap}px`;
  ui.canvas.hidden = !on.canvas;
  // the lane off is kept laid out of sight rather than hidden, since the shape and the reading line measure it
  ui.scroll.classList.toggle("off", !on.lane);
  ui.scroll.style.width = on.lane ? "" : `${mid}px`;
  AREAS.forEach(({ name }) => name !== "middle" && (ui.parts[name].hidden = !on[name] || !takesRoom(name)));
  (["gutterL", "gutterR"] as const).forEach((a) => ui.parts[a].classList.toggle("closed", !isOpen(a)));
  (["wingL", "wingR"] as const).forEach((a) => ui.parts[a].classList.toggle("closed", !isOpen(a)));
}

/** Draws the lane whole and lays the adjuncts beside it; the header says where the lane is scoped. */
function drawLane(): void {
  drawCrumb();
  ui.lane.innerHTML = laneHtml();
  alignEnds();
  drawAdjuncts();
  drawCanvas();
  rememberLane();
}

/** How far the lane scrolls, as a share of its height, while the reading line eases between an end and the middle. */
const EASE_RUN = 0.35;

/** What the reading line rests on at the ends of the lane, measured each time the lane is laid: heights in the scroll box. */
const ends = { top: 0, bottom: 0 };

/**
 * The room above and below the lane. With the line at the middle, half a screen at either end, so the first brief and
 * the last can both reach it. With the line easing to the ends, just enough that, scrolled to the top, the opening's
 * heading stands level with the first cell of the shape, and scrolled to the bottom, the last block stands level with
 * its last cell, so the shape stands balanced. The shape draws the room at its own scale, and the scale depends on the
 * room, so it is settled in a few steps.
 */
function alignEnds(): void {
  const h = ui.scroll.clientHeight;
  const c0 = ui.content.getBoundingClientRect().top;
  const P0 = parseFloat(ui.content.style.paddingTop) || 0;
  const articles = all<HTMLElement>(".brief", ui.lane);
  const opening = articles[0];
  const last = articles.at(-1);
  const blocks = last ? all<HTMLElement>(":scope > *:not(.surface):not(.act), :scope > .surface > *:not(.act)", last) : [];
  const off = opening ? opening.getBoundingClientRect().top - c0 - P0 : 0; // the heading's margin collapses through the opening
  const lastTop = last ? last.getBoundingClientRect().top - c0 - P0 : 0;
  const lane = (blocks.at(-1) ?? last)?.getBoundingClientRect().bottom ?? c0;
  const laneH = lane - c0 - P0;
  const tail = ui.lane.getBoundingClientRect().bottom - lane;
  let P = h / 2;
  let B = h / 2;
  if (state.settings.line === "ends") {
    // the shape's own room, wherever in a wing it stands; with no shape drawn, the room a lone figure would have
    const slot = slots.get("wingL:shape") ?? slots.get("wingR:shape") ?? band(h);
    const first = slot.top + SHAPE.inset;
    for (let i = 0; i < 6; i++) {
      const k = (slot.height - 8) / (P + laneH + tail + B);
      P = Math.max(0, first / (1 - k) - off);
      B = Math.max(0, h - tail - first - (P + laneH) * k);
    }
  }
  // the browser anchors the scroll against a change of room above; a lane at its top stays at its top
  const atTop = ui.scroll.scrollTop === 0;
  ui.content.style.paddingTop = `${Math.round(P)}px`;
  ui.content.style.paddingBottom = `${Math.round(B) + hang}px`;
  if (atTop) ui.scroll.scrollTop = 0;
  const sMax = Math.max(0, ui.scroll.scrollHeight - h);
  ends.top = Math.round(P) + off + 24;
  ends.bottom = Math.max(h / 2, Math.round(P) + lastTop + 24 - sMax);
  drawFade();
}

/** How far the reading line stands from an end: 0 at it, 1 once a stretch of scrolling away. */
const eased = (d: number): number => {
  const t = clamp(d / (ui.scroll.clientHeight * EASE_RUN), 0, 1);
  return t * t * (3 - 2 * t);
};
const fromTop = (s: number): number => (state.settings.line === "ends" ? eased(s) : 1);
const fromBottom = (s: number): number => (state.settings.line === "ends" ? eased(ui.scroll.scrollHeight - ui.scroll.clientHeight - s) : 1);

/** The reading line's height in the scroll box at a scroll: the middle, or, easing to the ends, on the opening at the top and the last brief at the bottom. */
const lineAt = (s: number): number => {
  const mid = ui.scroll.clientHeight * 0.5;
  return mid + (ends.top - mid) * (1 - fromTop(s)) + (ends.bottom - mid) * (1 - fromBottom(s));
};

/** The fades at the edges come in with the line, so nothing is faded at an end before anything stands beyond it. */
const drawFade = (): void => {
  const s = ui.scroll.scrollTop;
  ui.scroll.style.setProperty("--lift", fromTop(s).toFixed(3));
  ui.scroll.style.setProperty("--drop", fromBottom(s).toFixed(3));
};

/** The scroll that brings a height in the lane to its reading line; the line moves with the scroll, so it is found by halving. */
function scrollFor(y: number): number {
  let lo = 0;
  let hi = Math.max(0, ui.scroll.scrollHeight - ui.scroll.clientHeight);
  if (lo + lineAt(lo) >= y) return lo;
  if (hi + lineAt(hi) <= y) return hi;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (m + lineAt(m) < y) lo = m;
    else hi = m;
  }
  return hi;
}

/** How many cells of the trail the way down shows before it is cut at its root, the oldest going first. */
const TRAIL_SHOWN = 16;

/** A cell's glyph: a going is a small block, a scoping a chevron down or up, a link the link glyph. */
const CELL: Record<Move, string> = {
  go: `<svg viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" rx="1.2" fill="currentColor" stroke="none"/></svg>`,
  in: `<svg viewBox="0 0 10 10"><path d="M2 3.5 5 6.5 8 3.5"/></svg>`,
  out: `<svg viewBox="0 0 10 10"><path d="M2 6.5 5 3.5 8 6.5"/></svg>`,
  link: `<svg viewBox="0 0 16 16">${ICON.links}</svg>`,
};
/** One cell of the trail, wherever it is drawn: a press that goes back to before that move. */
const hopCell = (h: Hop): string => `<span class="cell ${h.kind}" data-a="${esc(h.to)}" data-hop="${state.trail.indexOf(h)}" ${hued(h.to)}>${CELL[h.kind]}</span>`;

/** What a move was, in a word or two. */
const said = (h: Hop): string => ({ go: "went to", in: "scoped into", out: "scoped out to", link: "followed a link to" })[h.kind];

/**
 * The way down stands over the lane, level with the prose's edge, in the clear room above where the prose fades, and
 * carries two runs on one line. First how here is placed: the levels above the scope as faint names, each a press that
 * widens the scope to it, and the scope root a step darker, since the reader stands in it. Then, spaced away, how the
 * reader came here: a cell per move, oldest first, a going, a scoping in or out, or a link, each in the hue of where it
 * went and each a press that lays the lane back as it stood before it; too long, it is cut at its root. The trail shows
 * only once a move has been made, so an unscoped lane with no trail has no way down at all.
 */
function drawCrumb(): void {
  const S = state.scope;
  const trail = state.trail.filter((h) => brief(h.to));
  const depth = depthHtml();
  ui.crumb.hidden = S === "" && trail.length === 0 && depth === "";
  const place = prefixesOf(S)
    .map((a) => (a === S ? `<span class="step root" data-a="${esc(a)}" ${hued(a)}>${esc(brief(a)!.title)}</span>` : `<span class="step" data-a="${esc(a)}" data-scope="${esc(a)}" ${hued(a)}>${esc(brief(a)!.title)}</span>`))
    .join(CHEVRON);
  const shown = trail.slice(-TRAIL_SHOWN);
  const cut = trail.length - shown.length;
  const way = trail.length ? `<span class="trail">${cut ? `<span class="step more" data-tip="${cut} earlier moves, cut at the root">…</span>` : ""}${shown.map(hopCell).join("")}</span>` : "";
  ui.crumb.innerHTML = `<span class="place">${place}</span>${depth}${way}`;
  placeCrumb();
}

/** The panes of the middle that stand on the screen. */
const panesShown = (): HTMLElement[] => [ui.canvas, ui.scroll].filter((el) => !el.hidden && !el.classList.contains("off"));

/** How far the nodes stand in from the canvas's rim. */
const CANVAS_INSET = 24;

/** The canvas stands in the band the figures stand in: below the way down, above the strip's room at the foot. */
function placeCanvas(): void {
  const s = state.settings;
  const top = Math.max(s.gap, ui.crumb.hidden ? 0 : ui.crumb.offsetTop + ui.crumb.offsetHeight + 10);
  ui.canvas.style.marginTop = `${Math.round(top)}px`;
  ui.canvas.style.marginBottom = `${FOOT}px`;
}

/**
 * The way down spans the middle, whatever it holds: the placement at its left edge, the depth beside the trail against
 * its right, so the cells keep their place as moves are added. With the lane alone it is as wide as the prose.
 */
function placeCrumb(): void {
  // the bar stands flush with the prose's edges and with the canvas's rim
  const edges = panesShown().map((el) => {
    const r = el.getBoundingClientRect();
    return el === ui.scroll ? ui.lane.getBoundingClientRect() : { left: r.left, right: r.right };
  });
  const a0 = ui.areas.getBoundingClientRect();
  const left = Math.min(...edges.map((r) => r.left));
  const right = Math.max(...edges.map((r) => r.right));
  ui.crumb.style.left = `${Math.round(left - a0.left)}px`;
  ui.crumb.style.width = `${Math.round(right - left)}px`;
  // the pull's gauge lies over the top of the prose, just under the way down
  const lane = ui.lane.getBoundingClientRect();
  ui.pull.style.left = `${Math.round(lane.left - a0.left)}px`;
  ui.pull.style.width = `${Math.round(lane.width)}px`;
  ui.pull.style.top = `${ui.crumb.hidden ? 8 : ui.crumb.offsetTop + ui.crumb.offsetHeight + 4}px`;
  placeCanvas();
  // the prose is clear below the way down whatever the fade is doing, so no line reads under it
  ui.scroll.style.setProperty("--rim-crumb", ui.crumb.hidden ? "0px" : `${ui.crumb.offsetTop + ui.crumb.offsetHeight + 8}px`);
}

/** Adjuncts stand in the gutter columns at the height of the line they belong to, pushed down where two would meet. */
function drawAdjuncts(): void {
  const on = fits();
  let overhang = 0;
  (["gutterL", "gutterR"] as const).forEach((area) => {
    const col = ui.parts[area];
    const widget = widgetOf(area);
    col.innerHTML = "";
    if (!on[area] || widget.kind !== "adjunct") return;
    // measured from the column itself, which starts below the room the reading line sets above the lane
    const top0 = col.getBoundingClientRect().top;
    let floor = 0;
    all<HTMLElement>(".brief", ui.lane).forEach((article) => {
      const b = brief(article.dataset.a!);
      if (!b) return;
      widget.of(b, article).forEach(({ at, html }) => {
        const el = document.createElement("div");
        el.className = "adjunct";
        el.innerHTML = html;
        const r = (at ?? article).getBoundingClientRect();
        const top = Math.max(floor, (at ? r.top : r.bottom - 8) - top0);
        el.style.top = `${Math.round(top)}px`;
        col.appendChild(el);
        floor = top + el.offsetHeight + 6;
      });
    });
    overhang = Math.max(overhang, floor - col.clientHeight);
  });
  // what the gutters hang below the last brief would meet the box's hard edge, since the foot's fade eases away at the
  // end of the prose; so the lane's ends keep room beneath its end for it, inside the clear foot
  const before = hang;
  hang = overhang > 0 ? Math.round(overhang + 12) : 0;
  if (hang !== before) alignEnds();
}

/** The room the gutters need beneath the lane's end, measured as they are laid and kept by the lane's ends. */
let hang = 0;

/** The reading line, where it stands on the screen now. */
const readingLine = (): number => ui.scroll.getBoundingClientRect().top + lineAt(ui.scroll.scrollTop);

/** The brief under the reading line, or the nearest above it. */
function focusUnderLine(): string {
  const y = readingLine();
  const arts = all<HTMLElement>(".brief", ui.lane);
  const under = arts.find((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= y && r.bottom > y;
  });
  const above = arts.filter((el) => el.getBoundingClientRect().top <= y).at(-1);
  return (under ?? above)?.dataset.a ?? "";
}

/** Marks the path and the focus wherever rows and articles stand, and moves the tree's line, without drawing again. */
function drawFocusMarks(): void {
  const onPath = new Set(prefixesOf(state.focus));
  all<HTMLElement>(".brief, .row, .crow", ui.areas).forEach((el) => {
    el.classList.toggle("on", onPath.has(el.dataset.a!));
    el.classList.toggle("here", el.dataset.a === state.focus);
  });
  if (canvasOn()) (followFocus(), drawEdges());
  all<HTMLElement>("svg.fig [data-a]", ui.areas).forEach((el) => {
    el.classList.toggle("on", onPath.has(el.dataset.a!));
    el.classList.toggle("here", el.dataset.a === state.focus);
  });
  drawLaser();
}

/** The tree's line lies under the highlighted row: the pointed brief while pointing, the focus otherwise. */
function drawLaser(): void {
  const tree = ui.areas.querySelector<HTMLElement>(".tree");
  const laser = tree?.querySelector<HTMLElement>(".laser");
  if (!tree || !laser) return;
  const a = state.pointed !== null && tree.querySelector(`.row[data-a="${cssEsc(state.pointed)}"]`) ? state.pointed : state.focus;
  const row = tree.querySelector<HTMLElement>(`.row[data-a="${cssEsc(a)}"]`);
  laser.hidden = !row;
  if (!row) return;
  laser.style.top = `${row.offsetTop + row.offsetHeight - 1}px`;
  laser.style.left = `${row.offsetLeft}px`;
  laser.style.width = `${row.offsetWidth}px`;
  if (a !== state.focus) return;
  const wing = tree.closest<HTMLElement>(".slot")!;
  const rr = row.getBoundingClientRect();
  const wr = wing.getBoundingClientRect();
  if (rr.top < wr.top + 24 || rr.bottom > wr.bottom - 48) wing.scrollTo({ top: row.offsetTop - wing.clientHeight / 2, behavior: "smooth" });
}

/** Where each figure stands in its wing, keyed by the wing and the widget, measured as the wing is laid. */
const slots = new Map<string, { top: number; height: number }>();

/**
 * Lays one wing whole. One figure has the wing's height; two stand at its top and its foot, with one space between. A
 * figure that takes only what it needs is drawn first and measured, and a figure that grows takes what is left, shared
 * evenly when both grow. The figures stand in the band the prose reads in, between the middles of its fades.
 */
function drawWing(area: "wingL" | "wingR"): void {
  const el = ui.parts[area];
  const s = state.settings;
  const names = fits()[area] ? figureNames(area) : [];
  const figures = names.map((n) => WIDGETS[n] as Figure);
  el.innerHTML = "";
  Array.from(slots.keys())
    .filter((k) => k.startsWith(area + ":"))
    .forEach((k) => slots.delete(k));
  if (figures.length === 0) return;
  const W = el.clientWidth;
  const { top, height: room } = band(el.clientHeight);
  const slotted = figures.map((f) => {
    const div = document.createElement("div");
    div.className = "slot";
    div.dataset.slot = names[figures.indexOf(f)];
    el.appendChild(div);
    if (!f.grow) div.innerHTML = f.draw(W, figures.length === 1 ? room : (room - s.gap) / 2);
    return { f, div, height: f.grow ? 0 : Math.min(room, div.scrollHeight) };
  });
  const growing = slotted.filter((x) => x.f.grow);
  const fixed = slotted.reduce((x, y) => x + y.height, 0);
  const share = growing.length ? (room - fixed - s.gap * (slotted.length - 1)) / growing.length : 0;
  growing.forEach((x) => (x.height = Math.max(0, share)));
  slotted.forEach((x, i) => {
    // one figure stands in the whole room, centred; of two, the first stands at the top and the second at the foot
    const height = slotted.length === 1 ? room : x.height;
    const y = i === 0 ? top : top + room - height;
    x.div.style.top = `${Math.round(y)}px`;
    x.div.style.height = `${Math.round(height)}px`;
    slots.set(`${area}:${x.div.dataset.slot}`, { top: Math.round(y), height: Math.round(height) });
    if (x.f.grow) x.div.innerHTML = x.f.draw(W, Math.round(height));
  });
}

/** Draws one figure again in the slot it already has, for what changes with the focus or the pointer. */
function drawSlot(area: "wingL" | "wingR", name: string): void {
  const div = ui.parts[area].querySelector<HTMLElement>(`.slot[data-slot="${name}"]`);
  const at = slots.get(`${area}:${name}`);
  const f = WIDGETS[name];
  if (div && at && f?.kind === "figure") div.innerHTML = f.draw(ui.parts[area].clientWidth, at.height);
}

function drawWings(only?: "focus" | "point"): void {
  (["wingL", "wingR"] as const).forEach((area) => {
    if (!only) return drawWing(area);
    figureNames(area).forEach((name) => {
      const f = WIDGETS[name];
      if (f?.kind === "figure" && (only === "focus" ? f.onFocus : f.onPoint)) drawSlot(area, name);
    });
  });
  drawFocusMarks();
}

/** Lays the wings, then settles the lane's ends against where the shape now stands, and draws again if they moved. */
function drawWingsAligned(): void {
  drawWings();
  const before = `${ui.content.style.paddingTop} ${ui.content.style.paddingBottom}`;
  alignEnds();
  if (`${ui.content.style.paddingTop} ${ui.content.style.paddingBottom}` !== before) drawWings();
}

/**
 * The strips stand at the foot of their areas, laid over the row by the areas' own geometry. Each side of the lane has a
 * wing's row and a gutter's row. They stand apart when both fit where they belong without touching; where they would
 * touch, the gutter's icons join the wing's row, nearest the lane, past a thin divider, so one row offers both.
 */
function drawStrips(): void {
  const on = fits();
  const a0 = ui.areas.getBoundingClientRect();
  const gap = state.settings.gap;
  const apart = 8;
  ui.strips.innerHTML = AREAS.filter(({ name }) => on[name])
    .map(({ name, kind }) => stripHtml(name, kind))
    .join("");
  const stripOf = (name: AreaName) => ui.strips.querySelector<HTMLElement>(`[data-strip="${name}"]`);
  /** Where a row of a given width would stand on its own: its left edge on the screen. */
  const anchor = (name: AreaName, width: number): number => {
    // the middle's row is centred under whatever panes stand
    if (name === "middle") {
      const shown = panesShown().map((el) => el.getBoundingClientRect());
      const left = Math.min(...shown.map((r) => r.left));
      const right = Math.max(...shown.map((r) => r.right));
      return (left + right) / 2 - width / 2;
    }
    // an open area's row is centred under it
    if (takesRoom(name)) {
      const r = ui.parts[name].getBoundingClientRect();
      return r.left + r.width / 2 - width / 2;
    }
    // a closed gutter's row stands at the foot of the lane, at the edge the gutter would open on
    const lane = ui.lane.getBoundingClientRect();
    if (name === "gutterL") return lane.left;
    if (name === "gutterR") return lane.right - width;
    // a closed wing's row stands centred in the space beside the lane where the wing would open
    const block = ui.scroll.getBoundingClientRect();
    const [from, to] = name === "wingL" ? [a0.left, block.left] : [block.right, a0.right];
    return clamp((from + to) / 2 - width / 2, a0.left + gap, a0.right - gap - width);
  };
  // a row keeps a gap from the edges of the screen
  const place = (el: HTMLElement, left: number) => void (el.style.left = `${Math.round(clamp(left, a0.left + gap, a0.right - gap - el.offsetWidth) - a0.left)}px`);
  (["L", "R"] as const).forEach((side) => {
    const wingName = `wing${side}` as AreaName;
    const gutterName = `gutter${side}` as AreaName;
    const wing = stripOf(wingName);
    const gutter = stripOf(gutterName);
    const wingAt = wing ? anchor(wingName, wing.offsetWidth) : 0;
    const gutterAt = gutter ? anchor(gutterName, gutter.offsetWidth) : 0;
    const touch = !!wing && !!gutter && (side === "L" ? wingAt + wing.offsetWidth + apart > gutterAt : gutterAt + gutter.offsetWidth + apart > wingAt);
    if (wing && gutter && touch) {
      const divider = document.createElement("span");
      divider.className = "divider";
      const icons = Array.from(gutter.children);
      if (side === "L") wing.append(divider, ...icons);
      else wing.prepend(...icons, divider);
      gutter.remove();
      return place(wing, anchor(wingName, wing.offsetWidth));
    }
    if (wing) place(wing, wingAt);
    if (gutter) place(gutter, gutterAt);
  });
  const middle = stripOf("middle");
  if (middle) place(middle, anchor("middle", middle.offsetWidth));
}

function drawAll(): void {
  if (!state.body) return;
  drawLayout();
  drawLane();
  drawStrips();
  drawWingsAligned();
  light();
}

// ## 3.13 One brief lit, wherever it is drawn

function light(): void {
  const a = state.pointed;
  document.body.classList.toggle("pointing", a !== null);
  all<HTMLElement>(".lit").forEach((el) => el.classList.remove("lit"));
  drawLaser();
  if (a === null) return;
  const exact = all<HTMLElement>(`[data-a="${cssEsc(a)}"]`);
  exact.forEach((el) => el.classList.add("lit"));
  const litFigures = new Set(exact.map((el) => el.closest(".fig")));
  all<HTMLElement>(".fig")
    .filter((f) => !litFigures.has(f))
    .forEach((f) => {
      const holding = all<HTMLElement>("[data-a]", f)
        .map((cell) => cell.dataset.a!)
        .filter((ca) => ca !== "" && a.startsWith(ca + "/"))
        .sort((x, y) => y.length - x.length)[0];
      if (holding !== undefined) all<HTMLElement>(`[data-a="${cssEsc(holding)}"]`, f).forEach((el) => el.classList.add("lit"));
    });
}

function point(a: string | null): void {
  if (state.scrubbing || a === state.pointed) return;
  state.pointed = a;
  light();
  drawWings("point");
  if (canvasOn()) drawEdges();
}

// ## 3.13.1 One tooltip, beneath whatever the pointer rests on
//
// A cell, an icon, a step of the way down, or a link when no gutter tells of it:
// what it is, and for a brief where it stands, its path drawn as the way down
// draws one. It comes a moment after the pointer rests, beneath the element and
// never under the pointer, and goes with any scroll or press.

const TIP_SEL = "[data-tip], [data-act], [data-hop], #lane a[data-link], svg.fig [data-a], #crumb .step[data-a], .adj.foot .name[data-a], .pc[data-a], .crow[data-a]";
let tipped: Element | null = null;
let tipTimer: ReturnType<typeof setTimeout> | undefined;

/** What the tooltip says of an element, or nothing when the element needs none. */
function tipHtml(el: HTMLElement): string {
  const name = (b: Brief) => `<span class="name">${esc(b.title || state.body!.title)}</span>`;
  if (el.dataset.tip !== undefined) return `<span class="name plain">${esc(el.dataset.tip)}</span>`;
  // a badge tells what its action does, and the other ways to the same thing, since the badge itself has room for a word
  if (el.dataset.act !== undefined) {
    const act = ACTIONS[el.dataset.act];
    if (!act) return "";
    const said = (s?: string) => (s ? `<span class="gloss">${esc(s)}</span>` : "");
    return (
      `<span class="what">${esc(act.keys.map(chordName).join(", or "))}</span>` +
      `<span class="name">${esc(act.label(el.dataset.a))}</span>` +
      said(act.help(el.dataset.a)) +
      said(act.shifted) +
      (act.also ? `<span class="gloss also">Also: ${esc(act.also[0].toLowerCase() + act.also.slice(1))}</span>` : "")
    );
  }
  if (el.dataset.hop !== undefined) {
    const h = state.trail[Number(el.dataset.hop)];
    const b = h && brief(h.to);
    return b ? `<span class="what">${said(h)}</span>${pathHtml(h.to)}${name(b)}<span class="gloss">press to go back to before it</span>` : "";
  }
  if (el.matches("#lane a[data-link]")) {
    // beside the lane the links already tell of every link, so the tooltip stays out of the way there
    if (isOpen("gutterR") && fits().gutterR) return "";
    const to = el.dataset.link!;
    const b = brief(to);
    if (b) return `${pathHtml(to)}${name(b)}<span class="gloss">${esc(faceOf(b))}</span>`;
    return `<span class="gloss">${esc(to === "web" ? (el as HTMLAnchorElement).hostname : to === "owed" ? "a brief not yet written" : `outside the body: ${el.dataset.href ?? ""}`)}</span>`;
  }
  const b = brief(el.dataset.a ?? "");
  return b ? `${pathHtml(b.address)}${name(b)}` : "";
}

/** Follows the pointer: a new element under it hides the tooltip and starts the moment before the next shows. */
function tip(e: PointerEvent): void {
  const el = (e.target as Element | null)?.closest?.<HTMLElement>(TIP_SEL) ?? null;
  if (el === tipped) return;
  hideTip();
  tipped = el;
  // a port cell under the pointer draws its own line, so the edges follow the element and not only the brief pointed at
  if (canvasOn() && (el?.classList.contains("pc") || el?.classList.contains("crow"))) drawEdges();
  if (!el) return;
  const html = tipHtml(el);
  if (html) tipTimer = setTimeout(() => showTip(el, html), 260);
}

/**
 * Shows the tooltip where it hides nothing. Over a figure it would cover what is pointed at, so there it stands beside
 * the figure, on the side nearest the lane, level with the cell. On the canvas it stands beside the row, past its ports,
 * level with it. Anywhere else it stands beneath the element, centred, or above it when there is no room beneath.
 */
function showTip(el: Element, html: string): void {
  const t = ui.tip;
  t.innerHTML = html;
  t.hidden = false;
  const r = el.getBoundingClientRect();
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  const level = () => clamp(r.top + r.height / 2 - h / 2, 8, innerHeight - h - 8);
  const fig = el.closest("svg.fig, .tree, .pointers, .settings");
  const wing = el.closest<HTMLElement>(".wing");
  let left: number;
  let top: number;
  if (fig && wing) {
    const f = fig.getBoundingClientRect();
    left = wing.dataset.area === "wingL" ? f.right + 8 : f.left - w - 8;
    top = level();
  } else if (el.closest("#canvas")) {
    // past the row, its ports and the dashed edge of the zone it sits in, as far as they actually reach, and no further
    const line = el.closest(".cline");
    const row = line?.getBoundingClientRect() ?? r;
    const out = line?.querySelector(".port.out")?.getBoundingClientRect();
    const into = line?.querySelector(".port.in")?.getBoundingClientRect();
    const zone = line?.parentElement?.closest(".czone")?.getBoundingClientRect();
    const right = Math.max(row.right, out?.right ?? 0, zone?.right ?? 0) + 12;
    const leftOf = Math.min(row.left, into?.left ?? Infinity, zone?.left ?? Infinity) - w - 12;
    left = right + w <= innerWidth - 8 ? right : leftOf;
    top = level();
  } else {
    left = r.left + r.width / 2 - w / 2;
    top = r.bottom + 8 + h > innerHeight - 8 ? r.top - h - 8 : r.bottom + 8;
  }
  t.style.left = `${Math.round(clamp(left, 8, innerWidth - w - 8))}px`;
  t.style.top = `${Math.round(top)}px`;
}

function hideTip(): void {
  clearTimeout(tipTimer);
  tipped = null;
  ui.tip.hidden = true;
}

/** A line in the header for what the reader is owed a word about: an address that did not resolve. */
const notice = (text: string): void => void (ui.notice.textContent = text);

// ## 3.14 Moving: pressing goes, a fold line folds, dragging scrubs, and the address follows the focus

/** The address after the hash: the focus, and after `?in=` the scope, when the lane is scoped. */
const readHash = (): string => decodeURIComponent(location.hash.replace(/^#\/?/, "").split("?")[0]).replace(/\/+$/, "");
const readScope = (): string => decodeURIComponent((location.hash.split("?in=")[1] ?? "")).replace(/\/+$/, "");
const hashFor = (focus: string, scope = state.scope): string => `#/${focus}${scope ? `?in=${scope}` : ""}`;
let arriving = false;

/** Enters a step into the browser's history at an address, for its back and forward. */
const enterHistory = (hash: string): void => history.pushState(null, "", hash);
/** Replaces the address of the step the reader stands on. */
const followHistory = (hash: string): void => (history.replaceState(null, "", hash), rememberLane());

/** The lane as it stood: its scope, every fold, the focus and the scroll. */
type Lane = { scope: string; grades: [string, Grade][]; focus: string; scroll: number };
/** A move: a going, a scoping in or out, or a link followed. Folds and scrolls are not moves. */
type Move = "go" | "in" | "out" | "link";
/** One hop of the trail: a move, where it went, and the lane as it stood before it. */
type Hop = { kind: Move; to: string; lane: Lane };
/** How many moves the trail keeps. */
const TRAIL_KEPT = 60;
/** Adds a move to the trail, with the lane as it stands now, before the move is made. */
const move = (kind: Move, to: string): void => void (state.trail = [...state.trail, { kind, to, lane: laneNow() }].slice(-TRAIL_KEPT));
/** Two moves that bring the lane back where it stood before the first, a scoping in and out again, are no journey: both leave the trail. */
function settleTrail(): void {
  const prev = state.trail.at(-2);
  if (prev && prev.lane.scope === state.scope && prev.lane.focus === state.focus) state.trail = state.trail.slice(0, -2);
  drawCrumb();
}
/** Everything a reader's change moves: the lane, and the trail. */
type Snapshot = Lane & { trail: Hop[] };
const undos: Snapshot[] = [];
const redos: Snapshot[] = [];
const laneNow = (): Lane => ({ scope: state.scope, grades: Array.from(state.grades), focus: state.focus, scroll: ui.scroll.scrollTop });
const snapshot = (): Snapshot => ({ ...laneNow(), trail: state.trail.slice() });
const sameSnapshot = (x: Snapshot, y: Snapshot): boolean =>
  x.scope === y.scope && x.focus === y.focus && x.scroll === y.scroll && JSON.stringify(x.grades) === JSON.stringify(y.grades) && JSON.stringify(x.trail) === JSON.stringify(y.trail);

/**
 * Records the lane as it stands, before a change the reader makes: a fold or an unfolding, a change of scope, a going or
 * an arrival. Scrolling alone records nothing. A change made of two, a going that widens the scope first, records once.
 */
function record(): void {
  const now = snapshot();
  if (undos.length && sameSnapshot(undos[undos.length - 1], now)) return;
  undos.push(now);
  if (undos.length > 200) undos.shift();
  redos.length = 0;
}

/** Lays the lane as a snapshot holds it and scrolls to where it stood, so the reader is exactly back. */
function restore(s: Snapshot): void {
  arriving = true;
  state.holding = null;
  state.scope = brief(s.scope) ? s.scope : "";
  state.grades = new Map(s.grades.filter(([a]) => brief(a)));
  state.focus = brief(s.focus) ? s.focus : state.scope;
  state.trail = s.trail.filter((h) => brief(h.to));
  drawAll();
  ui.scroll.scrollTop = s.scroll;
  followHistory(hashFor(state.focus));
  arriving = false;
}

/** Escape: the lane back as it stood before the last change the reader made. */
function undo(): void {
  const s = undos.pop();
  if (!s) return;
  redos.push(snapshot());
  restore(s);
}

/** Shift and escape: the change undone made again. */
function redo(): void {
  const s = redos.pop();
  if (!s) return;
  undos.push(snapshot());
  restore(s);
}

/**
 * Follows a link in the lane. A local link, one whose target stands within the scope, so the shape already shows it,
 * unfolded or folded, goes there as an arrival and scopes nothing; enter scopes once there. Any other link scopes the lane
 * to its target, or to the target's parent when the target has no level beneath it, and adds a hop to the trail: the
 * link followed, with the lane as it stood before.
 */
function follow(to: string): void {
  const target = brief(to) ? to : nearest(to);
  record();
  move("link", target);
  if (within(target, state.scope)) {
    enterHistory(hashFor(target));
    arrive(target);
    return settleTrail();
  }
  arriving = true;
  state.scope = level(target).length ? target : parentOf(target);
  lay(target);
  state.focus = target;
  drawAll();
  scrollToFocus(false);
  arriving = false;
  enterHistory(hashFor(target));
  settleTrail();
}

/** A press on a cell of the trail: the lane back as it stood before that move, and the trail cut back to there. */
function backTo(i: number): void {
  const h = state.trail[i];
  if (!h) return;
  record();
  enterHistory(hashFor(h.lane.focus, h.lane.scope));
  restore({ ...h.lane, trail: state.trail.slice(0, i) });
}

/** Goes to an address from the tree or a figure: enters the history, then settles there, keeping what the reader folded. */
function goTo(a: string): void {
  record();
  move("go", a);
  // a target outside the scope widens the scope to the whole body first, laid afresh, and the step is on the way back
  if (!within(a, state.scope)) scopeTo("");
  if (readHash() !== a || readScope() !== state.scope) enterHistory(hashFor(a));
  settle(a);
  settleTrail();
}

/** Settles on an address without laying the lane afresh: unfolds the way to it where it is folded, then scrolls. */
function settle(a: string): void {
  const target = brief(a) ? a : nearest(a);
  if (!inLane(target)) {
    if (!within(target, state.scope)) return arrive(target);
    prefixesOf(target).filter((p) => within(p, state.scope)).forEach((p) => p !== target && gradeOf(p) !== "whole" && setGrade(p, "whole"));
    drawLane();
  }
  state.focus = target;
  drawWings();
  light();
  scrollToFocus(true);
}

/** Where the lane as laid is kept for this page and this body, in the browser's own storage. */
const laneKey = (): string => `surface.lane:${location.pathname}:${state.body?.root ?? ""}:${state.body?.title ?? ""}`;
let laneTimer: ReturnType<typeof setTimeout> | undefined;

/** Keeps the lane as laid, its scope and every fold, with the address the reader stands at; written a moment after it settles. */
function rememberLane(): void {
  clearTimeout(laneTimer);
  laneTimer = setTimeout(() => {
    try {
      localStorage.setItem(laneKey(), JSON.stringify({ hash: location.hash, scope: state.scope, grades: Array.from(state.grades), trail: state.trail }));
    } catch {}
  }, 150);
}

/** The lane as the reader left it, when they left it at the address the page now stands at. */
function recalledLane(): { scope: string; grades: [string, Grade][]; trail?: Hop[] } | null {
  try {
    const kept = JSON.parse(localStorage.getItem(laneKey()) ?? "null");
    return kept && kept.hash === location.hash && Array.isArray(kept.grades) ? kept : null;
  } catch {
    return null;
  }
}

/**
 * Lays the lane again as the reader left it: a reload of the same place is not an arrival, so its scope and every fold
 * come back. What no longer resolves is dropped, a brief whose parent is not unfolded leaves with it, and the way to
 * the focus stands unfolded.
 */
function resume(a: string, kept: { scope: string; grades: [string, Grade][]; trail?: Hop[] }): void {
  arriving = true;
  state.trail = Array.isArray(kept.trail) ? kept.trail.filter((h) => h && typeof h.to === "string" && brief(h.to) && h.lane && h.kind) : [];
  const target = brief(a) ? a : nearest(a);
  state.scope = brief(kept.scope) && within(target, kept.scope) ? kept.scope : "";
  const S = state.scope;
  state.grades = new Map(kept.grades.filter(([x, g]) => brief(x) && within(x, S) && (g === "face" || g === "whole")));
  state.grades.set(S, "whole");
  state.body!.briefs.forEach((b) => b.address !== S && state.grades.has(b.address) && gradeOf(parentOf(b.address)) !== "whole" && state.grades.delete(b.address));
  prefixesOf(target)
    .filter((p) => within(p, S) && p !== target)
    .forEach((p) => gradeOf(p) !== "whole" && setGrade(p, "whole"));
  closeLay();
  state.focus = target;
  drawAll();
  scrollToFocus(false);
  arriving = false;
}

/** Arrives at an address: lays the lane afresh and scrolls the brief under the reading line. */
function arrive(a: string): void {
  arriving = true;
  const target = brief(a) ? a : nearest(a);
  if (!within(target, state.scope)) state.scope = "";
  notice(target === a ? "" : `No brief at ${a}; showing ${target || "the root"} instead.`);
  lay(target);
  state.focus = target;
  drawAll();
  scrollToFocus(false);
  arriving = false;
}

let holdTimer: ReturnType<typeof setTimeout> | undefined;
function scrollToFocus(smooth: boolean): void {
  const art = ui.lane.querySelector<HTMLElement>(`.brief[data-a="${cssEsc(state.focus)}"]`);
  if (!art) return;
  const top = art.getBoundingClientRect().top - ui.content.getBoundingClientRect().top;
  const target = scrollFor(top + 24);
  if (smooth) {
    state.holding = state.focus;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => (state.holding = null), 1200);
  }
  ui.scroll.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
}

// ### 3.14.1 Pull past the top
//
// At the top of a scope, scrolling up beyond where the lane can go fills a
// gauge, and when it is full the reader is taken up a level, as some
// applications refresh when pulled past their top. A pull that stops drains.

/** How far a pull must go before it takes the reader up. */
const PULL = 420;
/** How much of a pull passes unseen, so the tail of a scroll that only just reached the top does not flash the gauge. */
const PULL_DEAD = 0.15;
let pulled = 0;
let pullTimer: ReturnType<typeof setTimeout> | undefined;
/** When the last wheel event came, and whether a push has been felt: momentum is an unbroken stream, a new swipe begins after a gap. */
let lastWheelAt = 0;
let pushing = false;
/** The gap in the stream that means a gesture has begun: momentum never pauses this long, and a finger touching the pad stops it dead. */
const PULL_GAP = 80;

/**
 * Whether a wheel event came from a notched mouse wheel rather than a trackpad. No browser says; a wheel arrives as
 * whole notches of a hundred or more, or in lines, where a trackpad arrives as small fractional deltas.
 */
const notched = (e: WheelEvent): boolean => e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 100 && Number.isInteger(e.deltaY));

/**
 * Takes a wheel at the lane: up at the top of a scope, in the same movement that reached it, fills the gauge; anything
 * else lets it drain. A pull that stops springs back after a second of quiet, long enough for a second swipe to continue
 * the first; a mouse wheel's notches come slower still, so its pull is kept longer between them.
 */
function pull(e: WheelEvent): void {
  clearTimeout(pullTimer);
  const now = performance.now();
  const gap = now - lastWheelAt;
  lastWheelAt = now;
  if (state.scope === "" || ui.scroll.scrollTop > 0 || e.deltaY >= 0) return drainPull();
  // the momentum of a scroll that reaches the top must never count. Momentum is an unbroken stream of events, and a
  // finger touching the pad stops it dead before its swipe begins, so the pull arms only on an upward event at the top
  // that comes after a gap in the stream, or on a wheel's notch
  if (gap > PULL_GAP || notched(e)) pushing = true;
  if (!pushing) return;
  pulled = Math.min(PULL, pulled + -e.deltaY);
  drawPull(false);
  if (pulled >= PULL) {
    pulled = 0;
    drawPull(true);
    return popUp();
  }
  // a swipe with its momentum seldom reaches the whole pull, so the pull is held long enough for the next swipe to continue it
  pullTimer = setTimeout(drainPull, notched(e) ? 1500 : 1000);
}

function drainPull(): void {
  pushing = false;
  if (pulled === 0) return;
  pulled = 0;
  drawPull(true);
}

/** The gauge: a line over the top of the lane that fills from its middle out past the dead zone, and eases back when it drains. */
function drawPull(ease: boolean): void {
  const g = ui.pull;
  const share = Math.max(0, (pulled / PULL - PULL_DEAD) / (1 - PULL_DEAD));
  g.classList.toggle("easing", ease);
  g.style.setProperty("--pull", share.toFixed(3));
  if (share > 0) g.hidden = false;
  else if (ease) setTimeout(() => pulled === 0 && (g.hidden = true), 260);
  else g.hidden = true;
}

/** Where the pointer last moved, and whether a scroll has come under it since. */
const pointer = { x: -1, y: -1, still: false };

/** Scrolling moves the focus and nothing else; the address follows without entering the history. */
function onScroll(): void {
  hideTip();
  drawShapeCursor();
  drawFade();
  pointer.still = true;
  // scrolling swings the highlight back to the centre: what the pointer rested on is let go
  if (state.pointed !== null) {
    state.pointed = null;
    light();
    drawWings("point");
  }
  // a keyed move holds its target until the scroll has brought it to the line
  if (state.holding !== null) {
    const held = ui.lane.querySelector<HTMLElement>(`.brief[data-a="${cssEsc(state.holding)}"]`);
    const at = held ? held.getBoundingClientRect().top - (ui.scroll.getBoundingClientRect().top + lineAt(ui.scroll.scrollTop) - 24) : 0;
    if (Math.abs(at) > 2) return;
    state.holding = null;
    clearTimeout(holdTimer);
  }
  const f = focusUnderLine();
  if (f === state.focus) return;
  state.focus = f;
  if (!arriving) followHistory(hashFor(f));
  drawWings("focus");
}

/** Changes grades under a function, keeping the acted-on brief's heading where it stood on the screen. */
function refold(change: () => void, anchor: string = state.focus, jump = false): void {
  record();
  const at = (a: string) => ui.lane.querySelector<HTMLElement>(`.brief[data-a="${cssEsc(a)}"]`)?.getBoundingClientRect().top;
  const before = at(anchor) ?? at(state.focus);
  const held = at(anchor) !== undefined ? anchor : state.focus;
  change();
  if (!inLane(state.focus)) state.focus = nearestInLane(state.focus);
  drawLane();
  const after = at(held);
  if (before !== undefined && after !== undefined) ui.scroll.scrollTop += after - before;
  // a brief folded from inside it takes the reader up with it: its heading returns to the reading line;
  // the jump is instant, since a smooth scroll is cancelled by any scroll that follows the press, as trackpad inertia does
  const top = at(held);
  const box = ui.scroll.getBoundingClientRect();
  if (jump && top !== undefined && (top < box.top + 8 || top > box.bottom - 40)) {
    state.focus = held;
    scrollToFocus(false);
  }
  followHistory(hashFor(state.focus));
  drawWings();
  light();
}

/** A fold toggles one brief between its face and whole. Unfolding a brief not in the lane unfolds what leads to it. */
function cycle(a: string): void {
  const b = brief(a);
  if (a === "" || !b || !unfolds(b)) return;
  // only a fold that takes away what stood under the reader moves them; unfolding, or folding elsewhere, never scrolls
  const jump = gradeOf(a) === "whole" && within(state.focus, a);
  refold(
    () => {
      if (!inLane(a)) prefixesOf(a).forEach((p) => p !== a && gradeOf(p) !== "whole" && setGrade(p, "whole"));
      setGrade(a, inLane(a) ? nextGrade(gradeOf(a)) : "whole");
    },
    a,
    jump,
  );
}

/** Moves the focus to an address that is in the lane, without changing any grade. */
function moveTo(a: string): void {
  if (a === state.focus || !(a === "" || inLane(a))) return;
  state.focus = a;
  followHistory(hashFor(a));
  scrollToFocus(true);
  drawWings("focus");
}

/** Up: the parent of the focus becomes the focus, without folding anything. */
const up = (): void => moveTo(parentOf(state.focus));

/** Down into the level beneath: its first brief, when it stands in the lane. */
const down = (): void => moveTo(level(state.focus)[0]?.address ?? state.focus);

/** Scopes the lane to a brief: its holon becomes the whole, its heading the opening, and the registers count from it. */
function scopeTo(S: string): void {
  if (S === state.scope || !brief(S)) return;
  record();
  move(depthOf(S) > depthOf(state.scope) ? "in" : "out", S);
  state.scope = S;
  if (!within(state.focus, S)) state.focus = S;
  lay(state.focus);
  drawAll();
  scrollToFocus(false);
  // a change of scope is a step of its own in the browser's history as well
  enterHistory(hashFor(state.focus));
  settleTrail();
}

/** Shift and enter: the scope widens by one level, to the parent of the scope root. */
const popUp = (): void => void (state.scope !== "" && scopeTo(parentOf(state.scope)));

/** How long the space bar is held before it acts on the whole scope rather than the brief in focus. */
const HOLD = 450;

/** Space held: every brief in the scope unfolded whole, the heading in focus kept where it stands. */
function unfoldAll(): void {
  refold(() =>
    state.body!.briefs.forEach((b) => b.address !== state.scope && within(b.address, state.scope) && unfolds(b) && setGrade(b.address, "whole")),
  );
}

/** Shift and space held: every brief in the scope folded to its face, the reader taken up with what they stood in. */
function foldAll(): void {
  refold(() => level(state.scope).forEach((b) => setGrade(b.address, "face")), state.focus, true);
}

/** The previous or the next brief in the lane's order. */
function step(delta: number): void {
  const order = [brief(state.scope)!, ...laneOrder(state.scope)];
  const i = order.findIndex((b) => b.address === state.focus);
  const j = clamp(i + delta, 0, order.length - 1);
  moveTo(i < 0 ? order[0]?.address ?? "" : order[j].address);
}

/** Wires the gestures: pointing lights, pressing goes, a fold line folds, dragging scrubs, and keys do the same. */
function wire(): void {
  const named = (e: Event) => (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-a]") ?? null;

  document.addEventListener("pointermove", (e) => {
    // after a scroll, a pointer lights a brief only once it has travelled a little: a scroll that comes to rest under a
    // still pointer makes the browser send a move of its own, which would light whatever the scroll left beneath it.
    // Otherwise every move counts, so the highlight never lags behind the region the pointer is in
    if (pointer.still && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) < 4) return;
    pointer.still = false;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    // the room right of a brief's blocks in the shape points at the brief like its blocks do, so the ahead shows what a fold there would unfold
    const el = named(e);
    all<HTMLElement>(".keep").forEach((k) => k.classList.remove("keep"));
    if (el?.tagName === "A" && el.closest("#lane")) el.closest(".brief")?.classList.add("keep");
    point(el ? el.dataset.a! : null);
    tip(e);
  });
  document.documentElement.addEventListener("pointerleave", () => (point(null), hideTip()));

  document.addEventListener("click", (e) => {
    hideTip();
    const t = e.target as HTMLElement;
    // a link within the body is followed by the page itself, as a change that can be undone; one held with a modifier is left to the browser
    const inner = t.closest<HTMLAnchorElement>('a[href^="#/"]');
    if (inner && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      e.preventDefault();
      return void follow(inner.dataset.link ?? decodeURIComponent(inner.getAttribute("href")!.slice(2)));
    }
    if (t.closest("a[href]") || window.getSelection()?.toString()) return;
    // a badge takes its own press, wherever it stands, and acts on the address it carries rather than on the focus
    const badge = t.closest<HTMLElement>("[data-act]");
    if (badge) {
      const act = ACTIONS[badge.dataset.act!];
      return void (act && act.can(badge.dataset.a) && act.run(badge.dataset.a));
    }
    // on the canvas a row goes, and only the ground of a zone folds
    const crow = t.closest<HTMLElement>(".crow");
    if (crow) return void (state.scrubbing || crow.classList.contains("root") || goTo(crow.dataset.a!));
    const pc = t.closest<HTMLElement>(".pc[data-a]");
    if (pc) return void goTo(pc.dataset.a!);
    const dc = t.closest<HTMLElement>("[data-depth]");
    if (dc) return void unfoldTo(Number(dc.dataset.depth));
    if (t.closest("#canvas") && state.scrubbing) return;
    const fold = t.closest<HTMLElement>("[data-fold]");
    if (fold) return void cycle(fold.dataset.fold!);
    // the line of a borrowing brief follows to the home of what it borrows, as a link would
    const borrowed = t.closest<HTMLElement>("[data-borrow]");
    if (borrowed) return void follow(borrowed.dataset.borrow!);
    const pick = t.closest<HTMLElement>(".strip [data-widget]");
    if (pick) {
      const area = pick.dataset.area as AreaName;
      state.settings.areas[area] = pressed(area, pick.dataset.widget!);
      saveSettings();
      return void drawAll();
    }
    const set = t.closest<HTMLElement>("[data-set]");
    if (set) {
      const v = set.dataset.value!;
      const key = set.dataset.set as keyof Settings;
      (state.settings as unknown as Record<string, unknown>)[key] = typeof DEFAULTS[key] === "number" ? Number(v) : v;
      // what a brief weighs is in the index, so a change of weight indexes the body again
      if (key === "weight" && state.body) state.index = indexBody(state.body);
      saveSettings();
      return void drawAll();
    }
    // a hop of the trail lays the lane back as it stood there
    const hop = t.closest<HTMLElement>("[data-hop]");
    if (hop) return void backTo(Number(hop.dataset.hop));
    // a level above, in the shape or the crumb, scopes out to itself
    const scope = t.closest<HTMLElement>("[data-scope]");
    if (scope) return void scopeTo(scope.dataset.scope!);
    const go = t.closest<HTMLElement>("[data-go]");
    if (go) return void goTo(go.dataset.go!);
    const cell = t.closest<HTMLElement>("svg.fig [data-a]");
    if (!cell || state.scrubbing) return;
    // in the shape the blocks go and the room to their right folds or unfolds; in the other figures a press goes and the modifier folds
    const press = t.closest<HTMLElement>("[data-press]")?.dataset.press;
    const folds = press ? press === "fold" : e.metaKey || e.ctrlKey;
    return void (folds ? cycle(cell.dataset.a!) : goTo(cell.dataset.a!));
  });

  // dragging: a knob turns, the shape scrubs
  let drag: { kind: "knob" | "shape" | "canvas"; el: HTMLElement; x: number; y: number; start: number; vx?: number; vy?: number; moved: boolean } | null = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const knob = (e.target as HTMLElement).closest<HTMLElement>("[data-knob]");
    const map = (e.target as HTMLElement).closest<HTMLElement>("svg.shape");
    const cv = (e.target as HTMLElement).closest("#depth") ? null : (e.target as HTMLElement).closest<HTMLElement>("#canvas");
    if (knob) drag = { kind: "knob", el: knob, x: e.clientX, y: e.clientY, start: state.settings[knob.dataset.knob as Knob["key"]], moved: false };
    else if (map) drag = { kind: "shape", el: map, x: e.clientX, y: e.clientY, start: ui.scroll.scrollTop, moved: false };
    else if (cv) drag = { kind: "canvas", el: cv, x: e.clientX, y: e.clientY, start: 0, vx: view.x, vy: view.y, moved: false };
    if (drag) (e.target as Element).setPointerCapture?.(e.pointerId);
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    // up or right turns a meter up; the shape scrubs by height alone
    const dy = drag.kind === "knob" ? e.clientY - drag.y - (e.clientX - drag.x) : e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 3) return;
    drag.moved = true;
    state.scrubbing = true;
    if (drag.kind === "canvas") {
      view.x = drag.vx! + (e.clientX - drag.x);
      view.y = drag.vy! + (e.clientY - drag.y);
      applyView(false);
    } else if (drag.kind === "knob") {
      const k = KNOBS.find((k) => k.key === drag!.el.dataset.knob)!;
      const v = clamp(drag.start - (dy / 150) * (k.max - k.min), k.min, k.max);
      state.settings[k.key] = Math.round(v / k.step) * k.step;
      drawLayout();
      drawAdjuncts();
      drawMeter(drag.el);
    } else {
      const k = Number(drag.el.dataset.k);
      ui.scroll.scrollTop = drag.start + dy / k;
    }
  });
  const release = () => {
    if (drag?.kind === "knob" && drag.moved) (saveSettings(), drawStrips(), drawWingsAligned());
    drag = null;
    setTimeout(() => (state.scrubbing = false), 0);
  };
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
  document.addEventListener(
    "wheel",
    (e) => {
      const knob = (e.target as HTMLElement).closest<HTMLElement>("[data-knob]");
      if (!knob) return;
      e.preventDefault();
      const k = KNOBS.find((k) => k.key === knob.dataset.knob)!;
      state.settings[k.key] = clamp(Math.round((state.settings[k.key] - Math.sign(e.deltaY) * k.step) / k.step) * k.step, k.min, k.max);
      saveSettings();
      drawAll();
    },
    { passive: false },
  );

  // the wheel scrolls the lane wherever the pointer rests, except over a meter, which turns instead
  document.addEventListener(
    "wheel",
    (e) => {
      state.holding = null;
      const t = e.target as HTMLElement;
      if (t.closest("#scroll") || t.closest("[data-knob]") || t.closest("#canvas")) return;
      e.preventDefault();
      ui.scroll.scrollTop += e.deltaY;
      flick(e);
      pull(e);
    },
    { passive: false },
  );
  ui.scroll.addEventListener("wheel", pull, { passive: true });

  // over the canvas the wheel pans, and with a pinch, which arrives as a wheel with the control key, it zooms about the pointer
  ui.canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      hideTip();
      if (e.ctrlKey || e.metaKey) return zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      applyView(false);
    },
    { passive: false },
  );
  // the depth strip scrubs: with the button held, crossing a cell sets that depth
  ui.crumb.addEventListener("pointerover", (e) => {
    const dc = (e.target as HTMLElement).closest<HTMLElement>("[data-depth]");
    if (dc && e.buttons & 1) unfoldTo(Number(dc.dataset.depth));
  });
  // Safari sends a pinch as a gesture of its own, with the scale so far
  let pinch = 1;
  ui.canvas.addEventListener("gesturestart", (e) => ((pinch = 1), e.preventDefault()));
  ui.canvas.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    const g = e as Event & { scale: number; clientX: number; clientY: number };
    zoomAt(g.clientX, g.clientY, g.scale / pinch);
    pinch = g.scale;
  });

  // the flick: a small reversal of the scroll, down then up then down within a moment, cycles the brief in focus
  const legs: { t: number; d: number }[] = [];
  let flicked = 0;
  const flick = (e: WheelEvent): void => {
      if (!state.settings.flick || Math.abs(e.deltaY) < 2) return;
      const now = performance.now();
      const last = legs.at(-1);
      if (last && Math.sign(last.d) === Math.sign(e.deltaY)) last.d += e.deltaY;
      else legs.push({ t: now, d: e.deltaY });
      while (legs.length && now - legs[0].t > 260) legs.shift();
      const atEnd = ui.scroll.scrollTop <= 0 || ui.scroll.scrollTop >= ui.scroll.scrollHeight - ui.scroll.clientHeight - 1;
      if (legs.length >= 3 && now - flicked > 600 && !atEnd) {
        const [a, b, c] = legs.slice(-3);
        if (Math.abs(a.d) > 6 && Math.abs(b.d) > 6 && Math.abs(c.d) > 6 && Math.abs(a.d + b.d + c.d) < 80) {
          flicked = now;
          legs.length = 0;
          cycle(state.focus);
        }
      }
  };
  ui.scroll.addEventListener("wheel", flick, { passive: true });

  // Every key fires an action from the table, and nothing is named here: a chord is looked up, and taken only where the
  // action says it can be. The space bar keeps its own discipline, since it acts when it is let go, so a reader who only
  // scrolls never reaches for the pointer, and held a moment it acts on the whole scope instead.
  const take = (c: Chord): boolean => {
    const act = actionFor(c);
    if (!act || !act.can()) return false;
    act.run();
    return true;
  };
  let space: { shift: boolean; held: boolean; timer: ReturnType<typeof setTimeout> } | null = null;
  const letGo = () => void (space && clearTimeout(space.timer), (space = null));
  window.addEventListener("blur", letGo);
  document.addEventListener("keyup", (e) => {
    if (e.key !== " " || !space) return;
    e.preventDefault();
    const { shift, held } = space;
    letGo();
    if (!held) take({ key: " ", shift });
  });

  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key === " ") {
      e.preventDefault();
      if (space) return;
      const shift = e.shiftKey;
      const hold: { shift: boolean; held: boolean; timer: ReturnType<typeof setTimeout> } = { shift, held: false, timer: setTimeout(() => ((hold.held = true), take({ key: " ", shift, hold: true })), HOLD) };
      space = hold;
      return;
    }
    // escape is left to the browser as well, since a reader may be leaning on it for something of the page's own
    const chord: Chord = { key: e.key, shift: e.shiftKey };
    if (!actionFor(chord)) return;
    if (e.key !== "Escape") e.preventDefault();
    take(chord);
  });

  // an image whose size the trace could not read, or a remote one whose shape changed since, takes its own size once it
  // has loaded, and what stands beside the lane is laid again; one that fails to load leaves its alt text. Only the
  // shape is compared, since a vector sized by its view box loads at a size the browser picks for it
  let relaying = 0;
  const relay = () => {
    cancelAnimationFrame(relaying);
    relaying = requestAnimationFrame(() => (alignEnds(), drawAdjuncts(), drawWings()));
  };
  ui.lane.addEventListener(
    "load",
    (e) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== "IMG" || !state.body || !img.naturalWidth) return;
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      const toks = state.body.briefs.flatMap((b) => b.body).filter((t) => t.type === "image" && t.src === img.getAttribute("src"));
      if (toks.every((t) => t.width && t.height && Math.abs(t.width / t.height / (size.width / size.height) - 1) < 0.01)) return;
      toks.forEach((t) => Object.assign(t, size));
      if (img.hasAttribute("width")) Object.assign(img, size);
      state.index = indexBody(state.body);
      relay();
    },
    true,
  );
  ui.lane.addEventListener(
    "error",
    (e) => {
      const img = e.target as HTMLElement;
      if (img.tagName !== "IMG") return;
      img.closest("figure")?.classList.add("broken");
      relay();
    },
    true,
  );

  ui.scroll.addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
  // the browser's back and forward, or an address typed, arrive as a change the reader made
  window.addEventListener("hashchange", () => {
    record();
    state.scope = brief(readScope()) ? readScope() : "";
    arrive(readHash());
  });
  window.addEventListener("resize", () => {
    drawLayout();
    placeCrumb();
    alignEnds();
    drawAdjuncts();
    drawCanvas();
    drawStrips();
    drawWingsAligned();
  });
}

// ## 3.15 Where the body comes from
//
// Published, the body is inside the page and is read before the page is drawn
// over. Live, it is asked of the process, and asked again whenever the change
// stream says a file moved.

const inlined: string | null = typeof document === "undefined" ? null : (document.getElementById("substrate")?.textContent ?? null);

const load = async (): Promise<Body> => (inlined !== null ? JSON.parse(inlined) : (await fetch("/body")).json());

function setBody(body: Body): void {
  const first = state.body === null;
  state.body = body;
  state.index = indexBody(body);
  document.title = body.title || "The surface";
  const w = ui.header.querySelector<HTMLElement>(".warnings")!;
  w.textContent = body.warnings.length ? `${body.warnings.length} warning${body.warnings.length > 1 ? "s" : ""}` : "";
  w.dataset.tip = body.warnings.join("\n");
  body.warnings.forEach((x) => console.warn(x));
  if (first) {
    // read before the address is written back, since writing it keeps the lane as it stands, which is not yet laid
    const kept = recalledLane();
    history.replaceState(null, "", location.hash || "#/");
    state.scope = brief(readScope()) ? readScope() : "";
    recallView();
    return kept ? resume(readHash(), kept) : arrive(readHash());
  }
  // the lane is drawn again from the new body, keeping the grades that still resolve and the scroll
  const kept = new Map(Array.from(state.grades).filter(([a]) => state.index!.by.has(a)));
  const top = ui.scroll.scrollTop;
  state.grades = kept;
  closeLay();
  if (!inLane(state.focus)) state.focus = nearestInLane(state.focus);
  drawAll();
  ui.scroll.scrollTop = top;
}

async function start(): Promise<void> {
  loadSettings();
  document.body.innerHTML = `
    <header id="header"><span class="warnings chrome dim"></span><span class="notice chrome"></span></header>
    <main id="areas">
      <nav id="crumb" class="chrome" hidden></nav>
      <div id="pull" hidden><i></i></div>
      <section class="wing" data-area="wingL"></section>
      <section id="canvas" hidden></section>
      <section id="scroll"><div id="content"><div class="gutter" data-area="gutterL"></div><div id="lane"></div><div class="gutter" data-area="gutterR"></div></div></section>
      <section class="wing" data-area="wingR"></section>
      <div id="strips"></div>
    </main>
    <div id="tip" class="chrome" hidden></div>`;
  const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!;
  ui = {
    header: $("#header"),
    crumb: $("#crumb"),
    pull: $("#pull"),
    tip: $("#tip"),
    areas: $("#areas"),
    canvas: $("#canvas"),
    scroll: $("#scroll"),
    content: $("#content"),
    lane: $("#lane"),
    notice: $("#header .notice"),
    strips: $("#strips"),
    parts: { wingL: $('[data-area="wingL"]'), gutterL: $('[data-area="gutterL"]'), middle: $("#scroll"), gutterR: $('[data-area="gutterR"]'), wingR: $('[data-area="wingR"]') },
  };
  wire();
  setBody(await load());
  // the web fonts land after the first draw and reflow the prose, so what stands beside it is laid again
  document.fonts?.ready.then(() => {
    alignEnds();
    drawAdjuncts();
    drawEdges();
    drawWings();
  });
  if (inlined === null) {
    // the first word from a process names the page it serves; a process started again with a different page reloads this
    // one, and the lane is laid again as it was left, so a page left open never runs code older than its body
    let version: string | null = null;
    new EventSource("/changes").onmessage = async (e) => {
      if (!String(e.data).startsWith("version ")) return setBody(await load());
      if (version !== null && version !== e.data) location.reload();
      version = e.data;
    };
  }
}

if (typeof document !== "undefined") start();

// ## 3.16 The page's style
//
// Flat, as the design language asks: no boxes, hierarchy from type and rhythm,
// ink only for a live fact. A serif for the prose and a sans for the chrome; the
// heading registers grow over the body by the ratio a reader sets. The brief in
// focus stands whole and the rest a step dimmer; the prose fades at the top and
// the bottom edges. The page is white, or a warm near-black when the theme is
// dark, one palette with both sides. This part stays with the server, which
// writes it into the page's head.

/**
 * The palette: every colour's role once, with its light value and its dark value side by side. A role whose value takes
 * the branch hue reads it from --h, so it is set on every element and follows the branch the element stands under. A
 * sketch imports this and falls back to the light side where no page supplies the roles.
 */
export const PALETTE: Record<string, [light: string, dark: string]> = {
  ground: ["#ffffff", "oklch(18.5% 0.005 60)"],
  ink: ["#141414", "oklch(92% 0.005 60)"],
  muted: ["#6b6b6b", "oklch(74% 0.005 60)"],
  faint: ["#a8a8a8", "oklch(55% 0.005 60)"],
  wash: ["rgb(0 0 0 / .035)", "rgb(255 255 255 / .05)"],
  veil: ["rgb(0 0 0 / .05)", "rgb(255 255 255 / .07)"],
  track: ["rgb(0 0 0 / .08)", "rgb(255 255 255 / .13)"],
  meter: ["oklch(62% 0.19 28)", "oklch(70% 0.14 28)"],
  rim: ["rgb(0 0 0 / .08)", "rgb(255 255 255 / .1)"],
  rest: ["oklch(88% 0.045 var(--h))", "oklch(35% 0.04 var(--h))"],
  door: ["oklch(74% 0.085 var(--h))", "oklch(54% 0.07 var(--h))"],
  on: ["oklch(42% 0.072 var(--h))", "oklch(84% 0.055 var(--h))"],
  lit: ["oklch(60% 0.12 var(--h))", "oklch(74% 0.1 var(--h))"],
  glow: ["oklch(80% 0.08 var(--h))", "oklch(47% 0.06 var(--h))"],
  grey: ["oklch(90% 0 0)", "oklch(32% 0 0)"],
  hub: ["oklch(92% 0.01 60)", "oklch(27% 0.01 60)"],
};

/** The palette as declarations: the roles without a hue, or the roles that take one. */
const paletteCss = (hued: boolean): string =>
  Object.entries(PALETTE)
    .filter(([, [light]]) => light.includes("var(--h)") === hued)
    .map(([role, [light, dark]]) => `--${role}: light-dark(${light}, ${dark});`)
    .join("\n  ");

const CSS = `
/*
 * Two themes, one palette: every colour is a light and a dark value side by side, and the theme picks the side.
 * Neither side is the other inverted. The light side is laid on a white ground; the dark side matches each role's
 * contrast against its own ground, and bends where perception does:
 *   the ground is a warm near-black and the ink a soft white, since pure black under pure white glares and a dead
 *   neutral grey reads cold; light text on dark reads heavier, so the type thins a step (--thin);
 *   fills near the ground step further from it in dark, since small differences in the dark are harder to see;
 *   chroma follows what a hue can hold at a lightness, which peaks in the middle and falls towards both ends, so
 *   every role's chroma sits under the weakest hue at its lightness and no branch shouts over another;
 *   accents drop chroma on dark, where a saturated colour looks brighter than it is and vibrates.
 */
:root {
  color-scheme: light dark;
  ${paletteCss(false)}
  --serif: "Source Serif 4", "Iowan Old Style", "Charter", Georgia, serif;
  --sans: "Source Sans 3", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  --mono: "Source Code Pro", ui-monospace, "SF Mono", Menlo, monospace;
  --body: 17px; --t: 33px; --h1: 26.5px; --h2: 21px; --h3: 19px; --h4: 17px;
  --prose-face: var(--serif); --head-face: var(--serif); --head-tight: 1; --small: 13px;
  --leading: 27.2px;
  --gap: 24px; --rim-top: 3%; --rim-foot: 6%; --measure: 600px; --dim: .4; --edge: 8%;
  --thin: 0;
  --h: 60;
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; --thin: 30; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --thin: 30; } }
*, ::before, ::after {
  ${paletteCss(true)}
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { display: flex; flex-direction: column; background: var(--ground); color: var(--ink); font-family: var(--prose-face); font-size: var(--body); font-weight: calc(400 - var(--thin)); line-height: 1.6; overflow: hidden; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: underline; text-decoration-color: var(--door); text-decoration-thickness: 1px; text-underline-offset: .18em; }
a:hover, a.lit { text-decoration-color: var(--lit); }
/* a link pointed at is lit as its target is, wherever the target is drawn, and the brief it sits in keeps its ink */
#lane a.lit { color: var(--on); }
a.web { text-decoration-style: dotted; }
a.owed { text-decoration-style: dashed; color: var(--muted); cursor: help; }
a.outside { text-decoration-style: dotted; color: var(--muted); cursor: help; }
.chrome { font-family: var(--sans); font-size: var(--small); color: var(--muted); letter-spacing: .01em; line-height: 1.4; }
.dim { color: var(--faint); }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }

#header { position: absolute; top: 8px; left: 0; right: 0; z-index: 4; display: flex; justify-content: center; gap: 16px; pointer-events: none; }
#header > * { pointer-events: auto; }
#header .warnings { cursor: help; }
#crumb { position: absolute; top: 12px; z-index: 5; display: flex; align-items: center; gap: 7px; white-space: nowrap; overflow: hidden; color: var(--faint); }
#crumb .step { cursor: pointer; overflow: hidden; text-overflow: ellipsis; transition: color .15s; }
#crumb .step:hover, #crumb .step.lit { color: var(--on); }
#crumb .step.root { flex: none; color: var(--muted); cursor: default; }
#crumb .step.root.lit { color: var(--on); }
#crumb .place, #crumb .trail { display: flex; align-items: center; gap: 7px; min-width: 0; }
/* how the reader came here stands spaced away from how here is placed, on the same line */
#crumb .trail { flex: none; padding-left: 28px; gap: 3px; }
#crumb .place { flex: 1 1 auto; }
#crumb .cell { width: 14px; height: 14px; display: grid; place-items: center; border-radius: 3px; color: var(--door); cursor: pointer; transition: color .15s, background .15s; }
#crumb .cell svg { width: 10px; height: 10px; opacity: 1; }
#crumb .cell.link svg { width: 11px; height: 11px; stroke-width: 1.5; }
#crumb .cell:hover, #crumb .cell.lit { color: var(--on); background: var(--wash); }
#crumb .step.more { color: var(--faint); cursor: default; margin-right: 2px; }
#crumb svg { flex: none; width: 7px; height: 7px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }
#header .notice { color: var(--lit); }
/* the pull's gauge: a hairline over the prose that fills from its middle out as the reader pulls past the top */
#pull { position: absolute; z-index: 5; height: 2px; pointer-events: none; }
#pull i { position: absolute; top: 0; height: 2px; left: 50%; width: calc(var(--pull, 0) * 100%); transform: translateX(-50%); border-radius: 1px; background: var(--muted); }
#pull.easing i { transition: width .25s ease-out; }
/* the one tooltip: on the page's own ground, lifted by a soft shadow and the rim an image keeps, never under the pointer */
#tip { position: fixed; z-index: 9; max-width: 320px; padding: 7px 10px 8px; border-radius: 8px; background: var(--ground); color: var(--muted); font-size: 12px; line-height: 1.35; box-shadow: 0 1px 2px rgb(0 0 0 / .06), 0 6px 20px rgb(0 0 0 / .12), 0 0 0 1px var(--rim); pointer-events: none; white-space: pre-line; }
#tip .what { display: block; color: var(--faint); margin-bottom: 1px; }
#tip .path { margin-bottom: 2px; }
#tip .name { display: block; color: var(--ink); font-weight: calc(500 - var(--thin)); }
#tip .name.plain { font-weight: calc(400 - var(--thin)); color: var(--ink); }
#tip .gloss { display: block; color: var(--muted); margin-top: 2px; }

#areas { position: relative; flex: 1 1 auto; min-height: 0; display: grid; justify-content: center; }
#areas > [hidden] { display: none; }
/* a wing is as wide as what it holds and has no padding of its own; its figures stand in slots the layout places */
.wing { position: relative; overflow: hidden; }
#canvas { position: relative; overflow: hidden; min-width: 0; touch-action: none; user-select: none; cursor: grab; border-radius: 10px; }
/* the rim lies over everything on the canvas, as a layer that takes no pointer, so no node paints over it */
#canvas::after { content: ""; position: absolute; inset: 0; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--rim); pointer-events: none; z-index: 3; }
#stage { position: absolute; left: 0; top: 0; width: max-content; transform-origin: 0 0; will-change: transform; }
#stage.easing { transition: transform .35s cubic-bezier(.2,.7,.2,1); }
#edges { position: absolute; left: 0; top: 0; z-index: 1; overflow: visible; pointer-events: none; }
/* an arrow is neutral, since a step's order says nothing of where it stands; a link line takes its target's hue */
#edges path { fill: none; stroke: var(--faint); stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
#edges path.arrow { stroke: var(--rim); stroke-width: 1; stroke-linecap: butt; }
/* a level is a column of nodes; a set is a row of columns; a whole node's level is a zone beneath its row, held by
   dashed edges that come out of the row's own sides, so the parent is seen to hold what stands under it */
.ccol, .czone { display: flex; flex-direction: column; align-items: center; gap: 16px; }
/* a set is a row of columns, wrapping past three, since nothing in it stands on anything */
.ccol.set, .czone.set { flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 24px 56px; max-width: 892px; }
.cnode { display: flex; flex-direction: column; align-items: center; }
/* the zone's dashed edges emerge from the parent row's straight sides: the zone begins behind the row, above its rounded
   lower corners, and the row paints over it, so the row keeps its corners */
.czone { margin-top: -8px; padding: 22px 24px 12px; cursor: pointer; border: 1px dashed var(--track); border-radius: 10px; transition: border-color .15s; }
.czone:hover { border-color: var(--door); }

.czone.borrowed { padding-top: 8px; }
.zlabel { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-family: var(--sans); font-size: 11px; color: var(--faint); margin-bottom: 2px; }
.zlabel .icon { width: 11px; height: 11px; }
.zlabel .name { color: var(--muted); }
.cline { position: relative; display: flex; align-items: stretch; z-index: 1; }
/* a row's type follows the zoom as the prose does, and it stands tall enough to read at a distance */
.crow { flex: none; display: flex; align-items: baseline; gap: .5em; width: max(180px, calc(260px - 16px * var(--d, 0))); padding: .7em .9em; border-radius: 8px; font-family: var(--sans); font-size: calc(var(--body) * .8 * var(--kz, 1)); line-height: 1.35; color: var(--ink); cursor: pointer; background: var(--ground); box-shadow: inset 0 0 0 1px var(--rim); transition: box-shadow .15s; }
/* the ports: what points at a node to its left, what it points at to its right, a cell per brief, outside the row */
.port { position: absolute; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 3px; }
.port.in { right: 100%; padding-right: 8px; }
.port.out { left: 100%; padding-left: 8px; }
.pc { display: block; width: 8px; height: 8px; border-radius: 2px; background: var(--door); cursor: pointer; transition: background .15s; }
.pc:hover, .pc.lit, .pc.tie { background: var(--lit); }
.pc.more { width: auto; height: 8px; display: grid; align-items: center; background: none; color: var(--faint); font-family: var(--sans); font-size: 8.5px; line-height: 1; letter-spacing: -.02em; cursor: default; }
#edges path.link { stroke: var(--lit); stroke-dasharray: 3 3; }
/* the depth strip stands in the way down, before the trail: a cell per level, the unfolded ones marked */
#depth { flex: none; margin-left: auto; display: flex; gap: 3px; font-size: 11px; color: var(--faint); cursor: ew-resize; user-select: none; }
#depth .dc { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 4px; background: var(--wash); }
#depth .dc.on { background: var(--track); color: var(--ink); }
#depth .dc:hover { background: var(--muted); color: var(--ground); }
.crow .num { flex: none; font-size: .85em; color: var(--faint); }
.crow .title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crow.on .num { color: var(--on); }
.crow.here { box-shadow: inset 0 0 0 1.5px var(--on); }
.crow.lit, .crow:hover { box-shadow: inset 0 0 0 1.5px var(--lit); }
.crow.root { width: auto; max-width: 320px; background: none; box-shadow: none; font-weight: calc(600 - var(--thin)); cursor: default; }
.crow.root:hover { box-shadow: none; }
.crow .marks { display: inline-flex; align-items: center; gap: 3px; flex: none; }
.crow .marks i { display: block; width: 8px; height: 3px; border-radius: 1.5px; background: var(--rest); }
.crow .marks i.image { width: 8px; height: 6px; border-radius: 2px; background: none; box-shadow: inset 0 0 0 1.2px var(--rest); }
.crow .marks .tail { display: block; width: var(--w); height: 3px; border-radius: 1.5px; background: var(--grey); }
.crow .borrowed { flex: none; color: var(--door); }
.crow .borrowed .icon { width: 11px; height: 11px; }
.slot { position: absolute; left: 0; right: 0; display: flex; align-items: safe center; justify-content: center; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
.slot::-webkit-scrollbar { display: none; }
.slot > * { max-width: 100%; }
#scroll { overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent max(var(--rim-crumb, 0px), calc(var(--rim-top) * var(--lift, 1))), black calc(max(var(--rim-crumb, 0px), calc(var(--rim-top) * var(--lift, 1))) + var(--edge) * var(--lift, 1)), black calc(100% - (var(--rim-foot) + var(--edge)) * var(--drop, 1)), transparent calc(100% - var(--rim-foot) * var(--drop, 1))); mask-image: linear-gradient(to bottom, transparent max(var(--rim-crumb, 0px), calc(var(--rim-top) * var(--lift, 1))), black calc(max(var(--rim-crumb, 0px), calc(var(--rim-top) * var(--lift, 1))) + var(--edge) * var(--lift, 1)), black calc(100% - (var(--rim-foot) + var(--edge)) * var(--drop, 1)), transparent calc(100% - var(--rim-foot) * var(--drop, 1))); }
#scroll::-webkit-scrollbar { display: none; }
#scroll.off { position: absolute; left: 0; top: 0; bottom: 0; visibility: hidden; pointer-events: none; }
/* the room above and below the lane is set by the reading line's setting, each time the lane is laid */
#content { position: relative; display: grid; margin: 0 auto; padding: 50vh 0; }
.gutter { position: relative; }
.gutter.closed { visibility: hidden; }
#lane { min-width: 0; line-height: var(--leading); }

#strips { position: absolute; left: 0; right: 0; bottom: 0; height: 0; z-index: 5; pointer-events: none; }
.strip { position: absolute; bottom: 10px; display: flex; gap: 4px; justify-content: center; pointer-events: auto; }
.strip .pick { width: 26px; height: 24px; display: grid; place-items: center; border-radius: 6px; color: var(--ink); opacity: .22; transition: opacity .15s, color .15s; }
.strip .pick:hover { opacity: .7; }
.strip .divider { width: 1px; height: 12px; align-self: center; margin: 0 4px; background: var(--track); }
.strip .pick.on { opacity: 1; color: var(--muted); }
.icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }

.opening { margin-bottom: 40px; }
.opening h1 { font-family: var(--head-face); font-size: var(--t); font-weight: calc(600 - var(--thin)); line-height: 1.12; letter-spacing: calc(-.014em * var(--head-tight)); margin: 6px 0 .56em; }
.record { margin: 4px 0 24px; }

.brief { position: relative; margin: 0; padding-bottom: var(--after, 36px); opacity: calc(1 - var(--dim)); transition: opacity .3s; }
.brief.here { opacity: 1; }
.surface p { margin-bottom: 12px; }
.act { display: flex; align-items: center; gap: 10px; color: var(--ink); cursor: pointer; margin: -4px -8px 0; padding: 4px 8px; border-radius: 6px; transition: color .15s; }
.act:hover { color: var(--on); }
.act svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
/* the badge: the key drawn as a cap, and what it does beside it. Its room is kept on every line, and it inks only on
   the brief the reading line stands on, which is the brief a key acts on, so nothing reflows as the reader moves */
.badge { display: inline-flex; align-items: center; gap: 6px; visibility: hidden; }
.brief.here .badge, .badge.tight { visibility: visible; }
.badge .keys { display: inline-flex; gap: 2px; }
.badge .cap { width: 18px; height: 16px; display: grid; place-items: center; border-radius: 4px; background: var(--wash); color: var(--muted); transition: background .15s, color .15s; }
.badge .cap svg { width: 11px; height: 11px; transform: none; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.badge .label { color: var(--ink); }
.act:hover .badge .cap, .badge:hover .cap { background: var(--track); color: var(--ink); }
.badge:hover .label { color: var(--on); }
.act .bars { display: inline-flex; gap: 3px; align-items: center; }
.act .bars i { display: block; width: 9px; height: 3px; border-radius: 1.5px; background: var(--rest); }
.act .bars i.image { width: 9px; height: 7px; border-radius: 2px; background: none; box-shadow: inset 0 0 0 1.2px var(--rest); }
.act .bars b { font-weight: calc(500 - var(--thin)); margin-left: 2px; }
.act.less { margin-top: -6px; }
.act.borrow { flex-wrap: wrap; gap: 6px; color: var(--muted); }
.act.borrow .icon { width: 12px; height: 12px; flex: none; }
.act.borrow .name { color: var(--ink); }
.act.borrow:hover .name { color: var(--on); }
.pointing .brief.here:not(.lit):not(.keep) { opacity: calc(1 - var(--dim)); }
.brief.lit, .brief.keep { opacity: 1; }
.head { position: relative; font-family: var(--head-face); display: flex; align-items: baseline; font-weight: calc(600 - var(--thin)); line-height: 1.2; letter-spacing: calc(-.012em * var(--head-tight)); margin: 0 0 .56em; transition: color .12s; }
.head.d1 { font-size: var(--h1); }
.head.d2 { font-size: var(--h2); }
.head.d3 { font-size: var(--h3); }
.head.d4 { font-size: var(--h4); }
.head .num { flex: 0 0 auto; margin-right: .4em; font-family: var(--sans); font-size: calc(.5em + 4px); font-weight: calc(500 - var(--thin)); letter-spacing: 0; color: var(--faint); }
.head .title { flex: 1 1 auto; }
.brief.lit .title { color: var(--on); }
.brief.on .num { color: var(--on); font-weight: calc(600 - var(--thin)); }
.brief.here .num { color: var(--lit); }
.mark { position: absolute; width: 16px; height: 16px; display: grid; place-items: center; color: var(--door); opacity: .7; transition: opacity .15s; }
.mark:hover { opacity: 1; color: var(--lit); }
.mark svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; transition: transform .15s; }
.mark.whole svg { transform: rotate(90deg); }
.mark.leaf { visibility: hidden; }
.brief p, .brief li { margin: 0 0 12px; }
.brief li { margin-bottom: 8px; }
.brief ul, .brief ol { padding-left: 1.4rem; margin: 0 0 12px; }
.brief blockquote { margin: 0 0 12px; padding-left: 16px; border-left: 2px solid var(--rest); color: var(--muted); }
.brief pre { font-family: var(--mono); font-size: var(--small); line-height: 1.5; background: var(--wash); border-radius: 10px; padding: 12px 16px; overflow-x: auto; margin: 0 0 12px; }
.brief code { font-family: var(--mono); font-size: .92em; }
/* an image is rounded and carries a faint rim drawn inside its edge, over its own pixels, so a light image keeps an
   edge on a light ground; an inset shadow would lie beneath the pixels and never show */
/* an image or a sketch stands a little further from the prose than paragraphs stand from each other */
.brief figure.image { margin: 22px 0; }
.brief figure.image img { display: block; max-width: 100%; height: auto; border-radius: 10px; outline: 1px solid var(--rim); outline-offset: -1px; background: var(--wash); }
.brief figure.image.broken img { display: none; }
.brief figure.image.broken::before { content: attr(data-alt); color: var(--muted); }
/* the text beneath an image is set as the chrome is, quieter than the prose, since it belongs to the image */
.brief figure.image figcaption { margin-top: 8px; }
/* a sketch is drawn on the page's own ground, rounded and rimmed as an image is, at its width or the lane's */
.brief figure.image.sketch svg { display: block; max-width: 100%; height: auto; overflow: visible; border-radius: 10px; outline: 1px solid var(--rim); outline-offset: -1px; }
.brief figure.image.sketch svg .ground { fill: transparent; }
.brief figure.image.missing p { margin: 0; }
.brief .table { overflow-x: auto; margin: 0 0 12px; }
.brief table { border-collapse: collapse; font-family: var(--sans); font-size: var(--small); line-height: 1.4; }
.brief th { text-align: left; font-weight: calc(600 - var(--thin)); padding: 4px 12px 4px 0; border-bottom: 1px solid var(--rest); }
.brief td { padding: 4px 12px 4px 0; vertical-align: top; }
.brief em { font-style: italic; }
.brief hr { border: 0; border-top: 1px solid var(--rest); margin: 16px 0; }
.stray { color: var(--muted); }

.adjunct { position: absolute; left: 0; right: 0; padding: 0 12px 0 0; font-family: var(--sans); font-size: var(--small); line-height: 1.35; color: var(--muted); }
.gutter[data-area="gutterL"] .adjunct { padding: 0 0 0 12px; text-align: right; }
.adj { padding-left: 8px; border-left: 2px solid var(--rest); }
.gutter[data-area="gutterL"] .adj { border-left: 0; border-right: 2px solid var(--rest); padding: 0 8px 0 0; }
.adj.lit { border-color: var(--lit); }
/* a path is the titles above a brief with a chevron between, as the way down draws them, wrapping where it must */
.path { display: flex; flex-wrap: wrap; align-items: center; gap: 1px 5px; color: var(--faint); font-size: 11px; line-height: 1.3; }
.path svg { flex: none; width: 7px; height: 7px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }
.gutter[data-area="gutterL"] .path { justify-content: flex-end; }
.adj .path { margin-bottom: 1px; }
/* three sizes: the path smallest and faint, the name the largest, the opening words a step smaller and quieter */
.adj .name { display: block; color: var(--ink); font-weight: calc(500 - var(--thin)); cursor: pointer; }
.adj .name:hover, .adj .name.lit { color: var(--on); }
.adj .gloss { display: block; color: var(--muted); font-size: 12px; line-height: 1.35; margin-top: 1px; }
.adj.dim .gloss { color: var(--faint); }
.adj.foot { border-left-color: transparent; border-right-color: transparent; }
/* what points at a brief stands one name to a line, so the names never run together */
.adj.foot .name { display: block; }
.adj.foot .gloss { margin-bottom: 2px; }
/* the links figure, in a wing while the gutter has no room: the same adjuncts, stacked, under the brief's name */
.pointers { width: 100%; max-width: 240px; display: flex; flex-direction: column; gap: 6px; font-family: var(--sans); font-size: var(--small); line-height: 1.35; color: var(--muted); }
.pointers .adj.lead { border-left-color: transparent; color: var(--ink); }
.pointers .adj.lead .gloss { color: var(--ink); }

.tree { position: relative; font-family: var(--sans); font-size: var(--small); line-height: 1.35; color: var(--muted); width: 100%; max-width: 320px; }
.tree .row { position: relative; display: flex; align-items: center; gap: 6px; padding: 2px 8px 2px calc(20px + var(--d) * 14px); border-radius: 6px; }
.tree .row .mark { position: absolute; left: calc(2px + var(--d) * 14px); top: 3px; }
.tree .row.root { color: var(--ink); font-weight: calc(600 - var(--thin)); margin-bottom: 4px; }
.tree .row.above .name { color: var(--faint); }
.tree .row:hover, .tree .row.lit { background: var(--wash); }
.tree .name { cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tree .row.on .name { color: var(--ink); }
.tree .row.here .name, .tree .row.lit .name { color: var(--on); font-weight: calc(600 - var(--thin)); }
.pointing .tree .row.here:not(.lit) .name { color: var(--ink); font-weight: calc(500 - var(--thin)); }
.tree .laser { position: absolute; height: 1.5px; background: var(--on); border-radius: 1px; transition: top .28s cubic-bezier(.2,.7,.2,1), left .28s, width .28s; pointer-events: none; }

svg.fig { display: block; overflow: visible; touch-action: none; user-select: none; }
svg.fig .cell { cursor: pointer; }
.ahead-box { max-width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
svg.ahead .hit { fill: transparent; }
svg.ahead .para { fill: var(--rest); }
svg.ahead .head { fill: var(--door); }
svg.ahead .hidden { fill: var(--grey); }
svg.ahead .cell.lit .para, svg.ahead .cell.lit .head { fill: var(--lit); }
/* an image is a frame wherever a figure draws it, never a filled block that reads as prose */
svg.fig .image { fill: none; stroke: var(--door); stroke-width: 1; }
svg.fig .cell.here .image { stroke: var(--on); }
svg.fig .cell.lit .image { stroke: var(--lit); }
.ahead-name { min-height: 1.2em; text-align: center; color: var(--ink); }
.ahead-where { display: flex; flex-direction: column; align-items: center; gap: 1px; max-width: 100%; }
.ahead-where .path { justify-content: center; }
.ahead-where .name { color: var(--muted); }

svg.shape .hit { fill: transparent; }
svg.shape .para { fill: var(--rest); }
svg.shape .head { fill: var(--door); }
svg.shape .cell.here .para { fill: var(--door); }
svg.shape .cell.here .head { fill: var(--on); }
svg.shape .cell.lit .para, svg.shape .cell.lit .head { fill: var(--lit); }
svg.shape .above .head { fill: var(--grey); }
svg.shape .above.lit .head, svg.shape .above:hover .head { fill: var(--lit); }
/* only the two regions take the pointer; the marks drawn over them never do */
svg.shape .head, svg.shape .para, svg.shape .image, svg.shape .tick, svg.shape .hidden { pointer-events: none; }
svg.shape .ghost { opacity: 0; transition: opacity .12s; }
svg.shape .cell:has(.hit[data-press="fold"]:hover) .ghost { opacity: 1; }
svg.shape .cell:has(.hit[data-press="fold"]:hover) .tick:not(.ghost), svg.shape .cell:has(.hit[data-press="fold"]:hover) .hidden:not(.ghost) { fill: var(--lit); }
/* resting on the room to the right points at the brief, so the ahead previews it, but the brief's blocks keep their
   colour there: only its marks light, so resting on the room reads apart from resting on the blocks */
svg.shape .cell:has(.hit[data-press="fold"]:hover) .para { fill: var(--rest); }
svg.shape .cell:has(.hit[data-press="fold"]:hover) .head { fill: var(--door); }
svg.shape .cell.here:has(.hit[data-press="fold"]:hover) .para { fill: var(--door); }
svg.shape .cell.here:has(.hit[data-press="fold"]:hover) .head { fill: var(--on); }
svg.shape .hit[data-press="fold"] { cursor: pointer; }
svg.shape .tick { fill: var(--grey); }
svg.shape .tick.image { fill: none; stroke: var(--grey); stroke-width: 1; }
svg.shape .cell:has(.hit[data-press="fold"]:hover) .tick.image:not(.ghost) { fill: none; stroke: var(--lit); }
svg.shape .cell:has(.hit[data-press="fold"]:hover) .image { stroke: var(--door); }
svg.shape .cell.here:has(.hit[data-press="fold"]:hover) .image { stroke: var(--on); }
svg.shape .hidden { fill: var(--grey); }
svg.shape .cell.lit .hidden { fill: var(--glow); }
svg.shape .cursor { fill: var(--veil); pointer-events: none; }
svg.shape { cursor: grab; }

svg.plate .cell path, svg.plate .cell circle { fill: var(--rest); }
svg.plate .cell.centre circle { fill: var(--hub); }
svg.plate .cell.on path { fill: var(--door); }
svg.plate .cell.here path { fill: var(--on); }
/* grey for anything not in the lane wins over the marks above, at every depth */
svg.plate .cell.away path { fill: var(--grey); }
svg.plate .cell.lit path, svg.plate .cell.lit circle { fill: var(--lit); }
svg.plate .label { font-family: var(--sans); font-size: 11px; fill: var(--ink); pointer-events: none; }
svg.plate .label.lit, svg.plate .cell.lit .label, svg.plate .label.here { fill: var(--ground); }

.settings { width: 216px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.knobs { display: flex; gap: 12px; justify-content: center; }
.knob { position: relative; width: 40px; height: 40px; cursor: ns-resize; touch-action: none; user-select: none; color: var(--faint); }
.knob svg { width: 40px; height: 40px; display: block; }
.knob .track { fill: none; stroke: var(--track); stroke-width: 3; stroke-linecap: round; }
.knob .value { fill: none; stroke: var(--meter); stroke-width: 3; stroke-linecap: round; }
.knob .glyph { fill: none; stroke: var(--muted); stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.knob .hint { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 2px; white-space: nowrap; opacity: 0; transition: opacity .15s; pointer-events: none; }
.knob:hover .hint { opacity: 1; }
.switches { display: grid; grid-template-columns: auto auto; gap: 2px 8px; align-items: center; }
.switches .name { justify-self: end; color: var(--faint); }
.switches .values { display: flex; gap: 2px; }
.switches .pick { padding: 2px 5px; border-radius: 6px; color: var(--muted); }
.switches .pick.on { color: var(--ink); }
.switches .pick:hover { background: var(--wash); }
`;

// The run, last, so that everything it calls stands above it.
if (import.meta.main) run();
