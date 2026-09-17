// surface.ts — the surface: one page that reads knowledge written under the rule.
//
// # 1. What it is and how it is run
//
// One file serves two moments of a repository. Run against a path in a working
// tree it serves the page live and tells it when a file changes; run once with
// a flag it writes the page with the body inside, and that is all a pipeline
// does on each commit. The file is laid by the gradient, as a brief is: what it
// is and how it runs, then how the body is assembled, then how it is drawn,
// with the details beneath each. Its sections carry numbered headings in
// comments, so it is read by depth like anything else under the rule.
//
//   bun surface.ts <path>                  serve live, http://localhost:4141
//   bun surface.ts <path> --port 8080      serve on another port
//   bun surface.ts <path> --build [out]    write the page, default ./surface.html
//   bun surface.ts <path> --check          trace only, print the warnings
//   bun surface.ts <path> --history        trace, then print every brief's span of lines and its age in commits
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
    console.error("usage: bun surface.ts <path> [--port N | --build [out.html] | --check | --history]");
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
  if (flag("--history") >= 0) {
    const body = await trace(root);
    const rootDir = dirname(rootFileOf(root));
    const spans = spansOf(body, rootDir);
    withHistory(body, rootDir);
    const history = body.history;
    if (!history) return void console.log(`${body.briefs.length} briefs traced from ${body.root}; no history: the root is not in a repository git can read`);
    history.commits.forEach((c, i) => console.log(`${String(i).padStart(2)}  ${c.short}  ${c.date}  ${c.subject}`));
    const real = body.briefs.filter((b) => b.virtual === undefined);
    real.forEach((b) => {
      const span = spans.get(b.address);
      const age = history.age[b.address];
      console.log(`${(b.address || "(the root)").padEnd(72)} ${b.file.padEnd(40)} ${span ? `[${span[0]}, ${span[1]}]`.padEnd(12) : "no span".padEnd(12)} ${age === null ? "older" : age}`);
    });
    const aged = real.filter((b) => history.age[b.address] !== null).length;
    console.log(`${real.length} briefs, ${aged} with an age in the last ${history.commits.length} commits, ${real.length - aged} with none`);
    // the commits as briefs: the first three and the widest, each with what it touched, to be checked against git show --stat
    const commits = body.briefs.filter((b) => b.virtual === "commit");
    const widest = commits.reduce((x, y) => ((tokensIn("list_item", y.body).length > tokensIn("list_item", x.body).length) ? y : x), commits[0]);
    [...commits.slice(0, 3), ...(widest && !commits.slice(0, 3).includes(widest) ? [widest] : [])].forEach((b) => {
      const items = tokensIn("list_item", b.body).map((i) => textOf(i.tokens));
      const files = new Set((touched.get(history.commits[b.rank!].hash) ?? []).map((t) => t.file)).size;
      console.log(`\n${b.address} ${b.number} "${b.title}"\n  ${textOf([b.body[0]])}\n  touched ${items.length} in ${files} files:\n${items.map((i) => `    ${i}`).join("\n")}`);
    });
    // the blocks against their lines: how many briefs aligned, and one brief written across commits, block by block
    console.log(`\nblocks: ${alignment.aligned} briefs aligned to their lines, ${alignment.whole} took the brief's age whole`);
    const shown = real.find((b) => b.address.endsWith("the-step-lies-on-a-way-of-life")) ?? real.find((b) => b.address.endsWith("the-rename-breaks-dependents"));
    if (shown && spans.get(shown.address)) {
      const lines = readFileSync(join(rootDir, shown.file), "utf8").split(/\r?\n/);
      const src = sourceBlocks(lines, ...spans.get(shown.address)!);
      console.log(`${shown.address} (${shown.file} ${spans.get(shown.address)!.join("-")}, age ${history.age[shown.address]})`);
      shown.body.filter((t) => t.type !== "space").forEach((t, i) => console.log(`  block ${i + 1} ${t.type.padEnd(10)} lines ${src[i] ? `[${src[i][0]}, ${src[i][1]}]`.padEnd(11) : "?".padEnd(11)} rank ${t.age === null ? "older" : t.age}`));
    }
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
    withHistory(b, rootDir);
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
  withHistory(body, rootDir);
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
  /** set by the history on a block: the rank of the newest commit that touched its lines, null where none of the listed commits did */
  age?: number | null;
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
  /** set on a brief that stands in no file: the history level read from git, or one commit of it, with its rank from the head */
  virtual?: "history" | "commit";
  rank?: number;
};

/** One commit among the last on the root, as git tells it: who, when, the subject, and the message beneath it. */
type Commit = { hash: string; short: string; date: string; author: string; subject: string; message: string };
/**
 * The history: the last commits on the root, newest first, and for every brief the rank of the newest commit that
 * touched a line of its own prose, the head ranking zero; null where none of the listed commits did.
 */
type History = { commits: Commit[]; age: Record<string, number | null> };

/** The body: every brief in reading order, what the trace had to say, and its history where git could tell it. */
type Body = {
  title: string;
  root: string;
  briefs: Brief[];
  warnings: string[];
  traced: string;
  history?: History;
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

// ## 2.2 A file says it is under the rule

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
  return front["under"] === "the rule" || front["under"] === "the code" ? { front, rest: src.slice(m[0].length) } : null;
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
    return st ? { kind: st.front["kind"] ?? "brief", cut: cut(imageBlocks(lean(marked.lexer(st.rest) as unknown as Tok[]))) } : { fault: "not under the rule; the mount is skipped" };
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

// ## 2.8 History is read from git
//
// The files are the working tree, and git holds which commit last changed each
// line of them. So after the trace every brief is given its span of lines, its
// heading to the line before the next heading of any depth, which is its own
// prose and not its level's; and each line of the span is asked of git blame
// where it came from. A brief's age is the rank of the newest of those commits
// among the last commits on the root, the head ranking zero, and a line not yet
// committed ranks zero too, since it is newer than the head. A root outside a
// repository, or a machine without git, leaves the history undefined, and the
// page then offers nothing of it. The trace itself is not touched: this reads
// the files a second time, by line, and git a first.

/** How many commits back the history reaches. */
const HISTORY_DEPTH = 60;

/** A file's heading lines, one-based, each with its depth; a fenced block is skipped, since a line of code may open with a hash. */
function headingLines(src: string): { line: number; depth: number }[] {
  let fenced = false;
  return src.split(/\r?\n/).flatMap((text, i) => {
    if (/^ {0,3}(```|~~~)/.test(text)) fenced = !fenced;
    const m = fenced ? null : /^ {0,3}(#{1,6}) /.exec(text);
    return m ? [{ line: i + 1, depth: m[1].length }] : [];
  });
}

/**
 * Every brief's span of lines in its file. The trace lists a file's briefs in its heading order, and the cut takes the
 * first title as the file's name and a second one as prose, so the headings of depth two and deeper are the briefs, in
 * order; the root's opening is the one brief a title starts, so the root file's first heading is its first brief. A
 * span runs from the heading to the line before the next heading of any depth, or to the file's end.
 */
function spansOf(body: Body, rootDir: string): Map<string, [from: number, to: number]> {
  const spans = new Map<string, [number, number]>();
  const byFile = Map.groupBy(body.briefs.filter((b) => b.virtual === undefined), (b) => b.file);
  byFile.forEach((briefs, file) => {
    const abs = join(rootDir, file);
    if (!existsSync(abs)) return;
    const src = readFileSync(abs, "utf8");
    const heads = headingLines(src);
    const last = src.split(/\r?\n/).length;
    const titled = heads.findIndex((h) => h.depth === 1);
    const own = heads.filter((h, i) => h.depth >= 2 || (i === titled && file === body.root));
    briefs.forEach((b, i) => {
      const h = own[i];
      if (!h) return;
      const next = heads.find((x) => x.line > h.line);
      spans.set(b.address, [h.line, next ? next.line - 1 : last]);
    });
  });
  return spans;
}

/**
 * The blocks of a brief's source as ranges of lines after its heading: runs of lines parted by blank lines, save inside
 * a fence, or where a list goes on past a blank line into another item or an indented line. They stand in the order the
 * brief's blocks do, so each block of prose is given the lines it was written on.
 */
function sourceBlocks(lines: string[], from: number, to: number): [from: number, to: number][] {
  const out: [number, number][] = [];
  const blank = (x: string) => /^\s*$/.test(x);
  const item = (x: string) => /^ {0,3}([-*+]|\d+[.)])\s/.test(x);
  let open: [number, number] | null = null;
  let fenced = false;
  let list = false;
  for (let n = from + 1; n <= to; n++) {
    const x = lines[n - 1] ?? "";
    if (/^ {0,3}(```|~~~)/.test(x)) fenced = !fenced;
    if (blank(x) && !fenced) {
      const k = lines.slice(n, to).findIndex((y) => !blank(y));
      if (open && list && k >= 0 && (item(lines[n + k]) || /^ {2,}\S/.test(lines[n + k]))) continue;
      if (open) out.push(open);
      open = null;
      continue;
    }
    if (open) open[1] = n;
    else (open = [n, n]), (list = item(x));
  }
  if (open) out.push(open);
  return out;
}

/** How the blocks fell against their lines on the last reading of history: the briefs whose blocks aligned, and those that took the brief's age whole. */
const alignment = { aligned: 0, whole: 0 };

/** What git says to a question asked in the root's directory, or null where it cannot answer: no git, no repository, no such path. */
function git(rootDir: string, args: string[]): string | null {
  try {
    const r = Bun.spawnSync(["git", ...args], { cwd: rootDir, stdout: "pipe", stderr: "pipe" });
    return r.exitCode === 0 ? r.stdout.toString() : null;
  } catch {
    return null;
  }
}

/** The commit each line of a file came from, one-based, an all-zero hash where the line is not yet committed; null where git holds no such file. */
function blameOf(rootDir: string, file: string): (string | undefined)[] | null {
  const out = git(rootDir, ["blame", "--line-porcelain", "--", file]);
  if (out === null) return null;
  const lines: (string | undefined)[] = [];
  out.split("\n").forEach((l) => {
    const m = /^([0-9a-f]{40}) \d+ (\d+)/.exec(l);
    if (m) lines[Number(m[2])] = m[1];
  });
  return lines;
}

/** The body's history, or undefined where the root has none git can tell. */
function historyOf(body: Body, rootDir: string): History | undefined {
  const log = git(rootDir, ["log", `-n${HISTORY_DEPTH}`, "--format=%H%x1f%h%x1f%ad%x1f%an%x1f%s%x1f%b%x1e", "--date=short", "--", "."]);
  if (log === null) return undefined;
  const commits: Commit[] = log
    .split("\x1e")
    .filter((l) => l.includes("\x1f"))
    .map((l) => l.trim().split("\x1f"))
    .map(([hash, short, date, author, subject, message]) => ({ hash, short, date, author, subject, message: (message ?? "").trim() }));
  const rank = new Map(commits.map((c, i) => [c.hash, i]));
  rank.set("0".repeat(40), 0);
  const spans = spansOf(body, rootDir);
  const blames = new Map<string, (string | undefined)[] | null>();
  const sources = new Map<string, string[]>();
  const age: Record<string, number | null> = {};
  alignment.aligned = alignment.whole = 0;
  body.briefs.forEach((b) => {
    const span = spans.get(b.address);
    if (b.virtual !== undefined) return void (age[b.address] = b.rank ?? null);
    if (!span) return void (age[b.address] = null);
    if (!blames.has(b.file)) blames.set(b.file, blameOf(rootDir, b.file));
    if (!sources.has(b.file)) sources.set(b.file, readFileSync(join(rootDir, b.file), "utf8").split(/\r?\n/));
    const blame = blames.get(b.file)!;
    // a file git does not hold yet is all new, so every line of it ranks with the head
    const rankOf = ([from, to]: [number, number]): number | null => {
      const ranks = blame === null ? [0] : blame.slice(from, to + 1).flatMap((h) => (h !== undefined && rank.has(h) ? [rank.get(h)!] : []));
      return ranks.length ? Math.min(...ranks) : null;
    };
    age[b.address] = rankOf(span);
    // each block takes the age of its own lines, where the source's blocks fall one to one against the brief's; a mount
    // paragraph the trace took off is allowed to stand last in the source. Where they do not fall so, every block takes
    // the brief's age rather than a guess
    const toks = b.body.filter((t) => t.type !== "space");
    const src = sourceBlocks(sources.get(b.file)!, span[0], span[1]);
    const mount = src.length === toks.length + 1 && /^\s*\[[^\]]*\]\([^)]*\)\s*$/.test(sources.get(b.file)![src[src.length - 1][0] - 1] ?? "");
    const aligned = src.length === toks.length || mount;
    alignment[aligned ? "aligned" : "whole"]++;
    toks.forEach((t, i) => (t.age = aligned ? rankOf(src[i]) : age[b.address]));
  });
  return { commits, age };
}

// ### 2.8.1 The commits are briefs
//
// The history is not a widget but a level: one brief for the history itself,
// standing last among the root's, and beneath it one brief per commit, newest
// first, so the lane, the shape, the plate, the rail and the way down draw
// commits as they draw everything else. A commit's brief opens with who and
// when, carries its message, and ends with every brief the commit touched,
// each a link with a line of what changed there, so a commit leads to what it
// changed and the foot of each of those briefs leads back. What a commit
// touched is read from the commit itself and never changes, so it is read
// from git once and kept for the process's life.

/** One change a commit made to a file, on the new side: where it stands, what it added and what it took out. */
type Hunk = { from: number; count: number; oldFrom: number; oldCount: number; added: string[]; removed: string[] };
/** A heading as it stood in a file at a commit, its title without its number, and which of that title's headings in the file it is. */
type Head = { line: number; depth: number; title: string; nth: number };
/** One place a commit changed: a heading of a file, or the file's own opening, and a line of what changed there. */
type Touch = { file: string; title: string | null; nth: number; excerpt: string };

const touched = new Map<string, Touch[]>();

/** A file's title as the trace reads it: the heading's text without its syntax and its number. */
const titleOf = (line: string): string => splitHeading(textOf((marked.lexer(line.trim())[0] as Tok | undefined)?.tokens)).title;

/** Every heading of every stamped-looking file at a commit, by the file's path from the root. */
function headsAt(rootDir: string, rev: string, prefix: string): Map<string, Head[]> {
  const out = git(rootDir, ["grep", "-n", "--full-name", "-E", "^ {0,3}#{1,6} ", rev, "--", "*.md"]) ?? "";
  const heads = new Map<string, Head[]>();
  out.split("\n").forEach((l) => {
    const m = /^[^:]+:([^:]+):(\d+):( {0,3}(#{1,6}) .*)$/.exec(l);
    if (!m || !m[1].startsWith(prefix)) return;
    const file = m[1].slice(prefix.length);
    const list = heads.get(file) ?? [];
    const title = titleOf(m[3]);
    list.push({ line: Number(m[2]), depth: m[4].length, title, nth: list.filter((h) => h.title === title).length });
    heads.set(file, list);
  });
  return heads;
}

/** The hunks a commit made to the stamped-looking files, by file, with the paths from the root. */
function hunksAt(rootDir: string, hash: string, prefix: string): { file: string; oldFile: string; hunks: Hunk[] }[] {
  const out = git(rootDir, ["show", "--format=", "--unified=0", "-M", hash, "--", "*.md"]) ?? "";
  const changes: { file: string; oldFile: string; hunks: Hunk[] }[] = [];
  const path = (p: string) => (p.startsWith("/dev/null") ? "" : p.replace(/^[ab]\//, "").slice(prefix.length));
  let inHunk = false;
  out.split("\n").forEach((l) => {
    const c = changes[changes.length - 1];
    const h = c?.hunks[c.hunks.length - 1];
    if (l.startsWith("diff --git ")) return void ((inHunk = false), changes.push({ file: "", oldFile: "", hunks: [] }));
    if (!inHunk && l.startsWith("--- ")) return void (c.oldFile = path(l.slice(4)));
    if (!inHunk && l.startsWith("+++ ")) return void (c.file = path(l.slice(4)));
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (m) return void ((inHunk = true), c.hunks.push({ oldFrom: Number(m[1]), oldCount: m[2] === undefined ? 1 : Number(m[2]), from: Number(m[3]), count: m[4] === undefined ? 1 : Number(m[4]), added: [], removed: [] }));
    if (inHunk && h && l.startsWith("+")) h.added.push(l.slice(1));
    else if (inHunk && h && l.startsWith("-")) h.removed.push(l.slice(1));
  });
  return changes;
}

/** A line of a change, cut to what a list item can carry. */
const EXCERPT = 120;
const excerptOf = (added: string[], removed: string[]): string => {
  const line = (xs: string[]) => xs.map((x) => x.trim()).find((x) => x !== "");
  const a = line(added);
  const r = line(removed);
  const text = a !== undefined ? a : r !== undefined ? `− ${r}` : "";
  return text.length > EXCERPT ? text.slice(0, EXCERPT - 1).trimEnd() + "…" : text;
};

/**
 * Where a commit changed the body, from the commit itself: each hunk on the new side falls under the headings whose
 * spans it crosses, or under the file's opening before its first section, which is the brief that mounts the file. A
 * hunk that only takes lines out stands between two lines on the new side, so it is placed by where the lines stood on
 * the old side. Read once per commit and kept.
 */
function touchesOf(rootDir: string, hash: string, prefix: string): Touch[] {
  if (touched.has(hash)) return touched.get(hash)!;
  const heads = headsAt(rootDir, hash, prefix);
  let olds: Map<string, Head[]> | null = null;
  const out: Touch[] = [];
  hunksAt(rootDir, hash, prefix).forEach((c) => {
    const file = c.file || c.oldFile;
    c.hunks.forEach((h) => {
      if (h.count === 0) {
        // the lines are gone from the new side; the heading they stood under is on the old side, by the file's old name
        olds ??= headsAt(rootDir, `${hash}^`, prefix);
        const under = (olds.get(c.oldFile) ?? []).filter((x) => x.depth >= 2 && x.line <= h.oldFrom + Math.max(0, h.oldCount - 1));
        const sections = under.filter((x, i) => i === under.length - 1 || under[i + 1].line > h.oldFrom);
        const hit = sections.length ? sections : [null];
        hit.forEach((x) => out.push({ file, title: x?.title ?? null, nth: x?.nth ?? 0, excerpt: excerptOf([], h.removed) }));
        return;
      }
      const to = h.from + h.count - 1;
      const sections = (heads.get(file) ?? []).filter((x) => x.depth >= 2);
      // the sections the hunk crosses: the one its first line falls under, and every one that opens before its last
      const first = sections.findLastIndex((x) => x.line <= h.from);
      const crossed = sections.filter((x, i) => i === first || (x.line > h.from && x.line <= to));
      const lead = first < 0 ? [null] : [];
      const places = [...lead, ...crossed];
      places.forEach((x) => {
        const start = x === null ? h.from : Math.max(h.from, x.line);
        const next = x === null ? (sections[0]?.line ?? Infinity) : (sections[sections.indexOf(x) + 1]?.line ?? Infinity);
        const added = h.added.filter((_, k) => h.from + k >= start && h.from + k < next);
        const excerpt = excerptOf(added, x === places[0] ? h.removed : []);
        // a hunk that crosses into a section with nothing but blank lines did not change it
        if (excerpt !== "" || places.length === 1) out.push({ file, title: x?.title ?? null, nth: x?.nth ?? 0, excerpt });
      });
    });
  });
  touched.set(hash, out);
  return out;
}

/** The history as a level of briefs, appended to the body, and the age of every brief with the commits' own set. */
function historyLevel(body: Body, rootDir: string, history: History): void {
  const prefix = (git(rootDir, ["rev-parse", "--show-prefix"]) ?? "").trim();
  const taken = new Set(body.briefs.map((b) => b.address));
  const home = ["the-history", ...Array.from({ length: 9 }, (_, k) => `the-history-${k + 2}`)].find((a) => !taken.has(a))!;
  const roots = body.briefs.filter((b) => depthOf(b.address) === 1).length;
  const at = new Map(body.briefs.map((b, i) => [b.address, i]));
  const byTitle = Map.groupBy(body.briefs.filter((b) => b.virtual === undefined), (b) => `${b.file}\u0000${b.title}`);
  const ownerOf = (file: string): Brief | undefined => {
    const first = body.briefs.find((b) => b.file === file && b.virtual === undefined);
    return first && body.briefs.find((b) => b.address === parentOf(first.address));
  };
  const text = (t: string): Tok => ({ type: "text", text: t });
  const para = (toks: Tok[]): Tok => ({ type: "paragraph", text: textOf(toks), tokens: toks });
  const link = (b: Brief): Tok => ({ type: "link", href: `#/${b.address}`, to: b.address, text: b.title || body.title, tokens: [text(b.title || body.title)] });
  const entry: Brief = {
    address: home,
    title: "The history",
    number: `${roots + 1}`,
    written: "",
    file: "",
    kind: "record",
    body: [para([text(`The last ${history.commits.length} commits on the root, newest first, each with the briefs it touched. This level is read from git and stands in no file; a commit's brief leads to what it changed, and the foot of each of those leads back.`)])],
    door: true,
    virtual: "history",
  };
  body.briefs.push(entry);
  history.commits.forEach((c, rank) => {
    const address = `${home}/${c.short}`;
    // one item per brief, in the body's order, the first line of change standing for the brief; what no longer stands
    // in the body is named and not linked
    const items = new Map<string, { b: Brief | null; lost: string; excerpt: string; order: number }>();
    touchesOf(rootDir, c.hash, prefix).forEach((t) => {
      const b = t.title === null ? ownerOf(t.file) : (byTitle.get(`${t.file}\u0000${t.title}`) ?? [])[t.nth];
      const key = b ? b.address : `${t.file}#${t.title ?? ""}`;
      if (!items.has(key)) items.set(key, { b: b ?? null, lost: t.title === null ? `the opening of ${t.file}` : `"${t.title}" in ${t.file}`, excerpt: t.excerpt, order: b ? (at.get(b.address) ?? Infinity) : Infinity });
    });
    const list = Array.from(items.values()).sort((x, y) => x.order - y.order);
    const item = (x: { b: Brief | null; lost: string; excerpt: string }): Tok => ({
      type: "list_item",
      tokens: [{ type: "text", tokens: [...(x.b ? [link(x.b)] : [text(`${x.lost}, no longer in the body`)]), ...(x.excerpt ? [text(` — ${x.excerpt}`)] : [])] }],
    });
    const message = c.message.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s !== "");
    body.briefs.push({
      address,
      title: c.subject,
      number: `${roots + 1}.${rank + 1}`,
      written: "",
      file: "",
      kind: "record",
      body: [
        para([text(`${c.short} · ${c.date} · ${c.author}`)]),
        ...message.map((m) => para([text(m)])),
        list.length ? { type: "list", ordered: false, start: "", loose: false, items: list.map(item) } : para([text("Touched no brief: the change stood outside the stamped files.")]),
      ],
      door: false,
      virtual: "commit",
      rank,
    });
    history.age[address] = rank;
  });
  history.age[home] = null;
}

/** The body with its history: the ages of its briefs, and the commits as a level of their own, where git can tell them. */
function withHistory(body: Body, rootDir: string): void {
  body.history = historyOf(body, rootDir);
  if (body.history) historyLevel(body, rootDir, body.history);
}

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
  /** how many commits back the reading is of history: a brief changed within them takes its commit's hue and the rest go grey; 0 reads the body as it stands */
  back: number;
};

const DEFAULTS: Settings = {
  zoom: 1,
  ratio: 1.25,
  measure: 600,
  gap: 24,
  dim: 0.4,
  fade: 12,
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
  back: 0,
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

// A phone takes away the pointer, the keyboard and the room for two panes, and each of those moves a rule rather than
// only a size. One fact carries the first two: touch, what the browser says of the reader's own pointer. With it a key
// names nothing, so a badge carries its word alone; nothing answers for what a pointer rests on, so a figure answers a
// finger instead; and every press wants room a finger can find. The third, the room, is the width, and the areas
// already read it as they give way.

/** Whether the reader has a finger rather than a pointer, which is also to say no keyboard: read from the browser, and again at the first touch, since a machine may be both. */
let touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

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

/** How many commits back the reading is of history: what the reader set, where the body has a history at all. */
const backing = (): number => (state.body?.history ? state.settings.back : 0);
/** The rank of the commit that last changed a brief's own prose, null where none of the listed commits did. */
const ageOf = (address: string): number | null => state.body?.history?.age[address] ?? null;
/**
 * The section of the wheel the commits take when the reading is of history: the newest warmest, at twenty degrees, the
 * oldest asked for coolest, at three hundred, and the ranks between spread evenly from one end to the other through
 * the yellows and the greens, so two commits apart read as two hues apart.
 */
const WHEEL = { from: 20, to: 300 };
const wheelHue = (rank: number, back: number): number => Math.round(WHEEL.from + ((WHEEL.to - WHEEL.from) * rank) / Math.max(1, back - 1));
/**
 * The hue of a branch: every brief carries the hue of the root-level brief it stands under, so colour says
 * where in the body a thing sits and nothing else. Hues step by the golden angle, so neighbours differ. Reading
 * history, a brief changed within the commits asked for carries its commit's hue instead, so colour then says when.
 */
const hueOf = (address: string): number => {
  const back = backing();
  const r = back > 0 ? ageOf(address) : null;
  if (r !== null && r < back) return wheelHue(r, back);
  const i = level("").findIndex((b) => b.address === address.split("/")[0]);
  return i < 0 ? 0 : Math.round((30 + i * 137.508) % 360);
};
/** Whether a brief is drawn without colour: the reading is of history, and no commit asked for changed it. */
const greyed = (address: string): boolean => {
  const back = backing();
  const r = ageOf(address);
  return back > 0 && (r === null || r >= back);
};
/** The declarations that colour an element for its brief: the hue, and no chroma where history leaves it grey. The chroma is said either way, since a brief drawn inside an older one, as the canvas nests them, must not inherit its grey. */
const tint = (address: string): string => `--h:${hueOf(address)};--c:${greyed(address) ? 0 : 1}`;
const hued = (address: string): string => `style="${tint(address)}"`;

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
  /** its glyph, where it stands in a row of round buttons and a word would not fit; only the acts that stand there have one */
  mark?: (a?: string) => string;
  /** the chords that fire it */
  keys: Chord[];
  /** what it does, in a sentence, for the tooltip; it takes the address so it can say which way the act goes */
  help: (a?: string) => string;
  /** the other ways to the same thing, named on the tooltip */
  also?: string;
  /** what the same key with shift does, named where the plain badge stands */
  shifted?: string;
  /** whether it can be taken at all; a badge that cannot is not drawn */
  can: (a?: string) => boolean;
  /** whether it is taken now, for an act that holds a state; its badge is marked so */
  on?: (a?: string) => boolean;
  run: (a?: string) => void;
};

/** The address an action acts on: the one a badge passes, or the focus, which is what a key acts on. */
const acts = (a?: string): string => a ?? state.focus;

/** Whether the reading stands at a commit's brief: the history reaches back to exactly that commit. */
const readsBackTo = (a: string): boolean => {
  const b = brief(a);
  return b?.rank !== undefined && state.settings.back === b.rank + 1;
};

const ACTIONS: Record<string, Action> = {
  unfold: {
    label: (a) => (gradeOf(acts(a)) === "whole" ? "fold" : "unfold"),
    mark: (a) => (gradeOf(acts(a)) === "whole" ? ICON.fold : ICON.unfold),
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
    mark: () => ICON.open,
    keys: [{ key: "Enter" }],
    help: () => "Opens the brief as the whole of the lane: its heading becomes the opening and everything above it leaves.",
    shifted: "Shift widens the scope by a level instead.",
    can: (a) => level(acts(a)).length > 0,
    run: (a) => scopeTo(acts(a)),
  },
  backTo: {
    label: (a) => (readsBackTo(acts(a)) ? "read as now" : "back to here"),
    keys: [{ key: "h" }],
    help: (a) =>
      readsBackTo(acts(a))
        ? "Reads the body as it stands again, with no commit coloured."
        : "Reads the body as a diff against this commit: every brief and every block changed since, this commit included, takes its commit's hue, and the rest goes grey.",
    also: "The swatch or the hash of the commit's row in the history widget, and the history switch in the settings, by count.",
    can: (a) => brief(acts(a))?.virtual === "commit",
    on: (a) => readsBackTo(acts(a)),
    run: (a) => {
      const b = brief(acts(a));
      if (b?.rank === undefined) return;
      state.settings.back = readsBackTo(b.address) ? 0 : b.rank + 1;
      saveSettings();
      drawAll();
    },
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
    help: () => "Unfolds every brief of the scope one level further, and folds what lies beyond it. Holding the space bar unfolds the scope whole.",
    also: "Pressing or scrubbing the depth strip.",
    can: () => unfoldedDepth() < scopeDepth(),
    run: () => unfoldTo(Math.min(scopeDepth(), unfoldedDepth() + 1)),
  },
  shallower: {
    label: () => "a level less",
    keys: [{ key: "ArrowLeft", shift: true }],
    help: () => "Folds the scope back a level, so one level less stands unfolded. Holding shift and the space bar folds it whole.",
    also: "Pressing or scrubbing the depth strip.",
    can: () => unfoldedDepth() > 1,
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
    can: () => undos.length > 0,
    run: () => undo(),
  },
  redo: {
    label: () => "redo",
    keys: [{ key: "Escape", shift: true }],
    help: () => "Makes the change escape undid again.",
    can: () => redos.length > 0,
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
  h: { glyph: `<path d="M4.6 3.6v8.8M11.4 3.6v8.8M4.6 8h6.8"/>`, name: "h" },
};

const cap = (glyph: string, kind = ""): string => `<span class="cap${kind ? " " + kind : ""}"><svg viewBox="0 0 16 16">${glyph}</svg></span>`;

/** The pointer, drawn for a badge beside a brief the keys do not act on, so every line keeps a cap and one edge. */
const MOUSE = `<path d="M5 6.4a3 3 0 0 1 6 0v3.8a3 3 0 0 1-6 0z"/><path d="M8 4.4v2.2"/><path d="M5 7.6h6"/>`;

/** A chord as caps: shift first, then the key, so a row of caps reads as it is pressed. */
const capsOf = (c: Chord, aimed = false): string => (c.shift ? cap(KEY.Shift.glyph, aimed ? "key" : "") : "") + cap(KEY[c.key]?.glyph ?? "", aimed ? "key" : "");

/** A chord in words, for the tooltip: "shift and space, held". */
const chordName = (c: Chord): string => (c.shift ? `shift and ${KEY[c.key]?.name}` : (KEY[c.key]?.name ?? c.key)) + (c.hold ? ", held" : "");

/**
 * One badge: the chord as caps and the action beside it, worded, or as a glyph where the room is tight. It carries the
 * address it acts on, so a press acts on the brief it stands beside rather than on the brief in focus.
 */
function badgeHtml(id: string, a?: string, tight = false): string {
  const act = ACTIONS[id];
  if (!act) return "";
  // a badge keeps its room when it cannot be taken so that no row shifts under the pointer; with no pointer there is
  // nothing to shift under, and the room is wanted for the words, so a phone draws only what can be taken
  if (touch && !act.can(a)) return "";
  // the badge's third grade, beside the worded and the tight: a phone has no key, so the badge carries the word alone
  // and the cap's room goes with the cap. A tight badge falls back to the word, since its keys were all it had to show
  if (touch)
    return `<span class="badge worded${act.can(a) ? "" : " off"}${act.on?.(a) ? " on" : ""}" data-act="${esc(id)}"${a !== undefined ? ` data-a="${esc(a)}"` : ""}><span class="label">${esc(act.label(a))}</span></span>`;
  // tight, the badge is its keys alone, since it stands on the very thing it acts on and its place says what it does
  const said = tight ? "" : `<span class="label">${esc(act.label(a))}</span>`;
  // the caps cannot show that a key is leaned on rather than tapped, so a held chord says the word
  const held = act.keys[0].hold ? `<span class="held">held</span>` : "";
  // a badge beside a brief carries both caps: the key, inked on the brief a key acts on, and the pointer on every other
  // brief, where a press is the only way to it. The two take the same room, so no line shifts as the reading moves
  const aimed = a !== undefined;
  const chord = `<span class="chord">${capsOf(act.keys[0], aimed)}${aimed ? cap(MOUSE, "pointer") : ""}</span>`;
  // a badge that cannot be taken keeps its room and goes quiet, so a row of badges never shifts under the pointer
  return `<span class="badge${tight ? " tight" : ""}${aimed ? " aimed" : ""}${act.can(a) ? "" : " off"}${act.on?.(a) ? " on" : ""}" data-act="${esc(id)}"${aimed ? ` data-a="${esc(a)}"` : ""}>${chord}${said}${held}</span>`;
}

/** Two acts that share a modifier, drawn as one unit: the modifier once, then a key for each, each its own press. */
function badgePair(first: string, second: string): string {
  const [x, y] = [ACTIONS[first], ACTIONS[second]];
  // the pair is a modifier and two keys, so a phone has nothing of it to draw; the strip it stands on is the act's own picture
  if (touch) return "";
  if (!x || !y || !x.keys[0].shift || !y.keys[0].shift) return badgeHtml(first, undefined, true) + badgeHtml(second, undefined, true);
  const one = (id: string, act: Action) =>
    `<span class="badge tight bare${act.can() ? "" : " off"}" data-act="${esc(id)}">${cap(KEY[act.keys[0].key]?.glyph ?? "")}</span>`;
  return `<span class="pair">${cap(KEY.Shift.glyph, "lead")}${one(first, x)}${one(second, y)}</span>`;
}

// ## 3.2 Prose is drawn from tokens
//
// Each kind of token has one renderer, and the two tables are the whole of the
// markdown the page knows: the block kinds and the inline kinds.

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inline = (toks: Tok[] = []): string => toks.map((t) => (INLINE[t.type] ?? INLINE.text)(t)).join("");
const blocks = (toks: Tok[] = []): string => toks.map((t) => aged(t, (BLOCK[t.type] ?? BLOCK.other)(t))).join("");

/** A block a commit within the reading touched stands in that commit's hue, a wash behind it and a rule at its left, its text kept ink; every other block stands as it is. */
const aged = (t: Tok, html: string): string => {
  const back = backing();
  return back > 0 && t.age !== undefined && t.age !== null && t.age < back && html ? `<div class="aged" style="--h:${wheelHue(t.age, back)}">${html}</div>` : html;
};

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

// The figure on the action line answers two questions, so it compresses in two ways. What the press itself gives, the
// paragraphs beyond the face, is drawn exactly: a mark per block, as long as that block is tall in the lane, so three
// short paragraphs read as three short marks. Where the run is too wide the marks scale together, keeping their lengths
// true against each other. What lies further, the level beneath, is drawn as a bar per brief, as long as that brief's
// branch is heavy, with a tick beneath the ones that hold more; where that is too much it merges into one bar, which
// still says how much waits even when it can no longer say what. So the answer to "only three paragraphs?" is never
// compressed away, and the deeper structure yields first.
const FIG = { h: 13, y: 3, bar: 5, tick: 1.8, gap: 3, split: 16, max: 176, floor: 28, shown: 12, level: 9 };

/**
 * The room the figure on the action line is drawn in. Wide, it is the room the figure asks for; where the lane is
 * narrow, it is what the line has left once the count of what lies beneath and the acts beside it have taken theirs,
 * since a figure that runs past the prose says nothing at all. The words are reckoned from what they are: two acts and
 * a count, worded, in the chrome's own size.
 */
const figRoom = (): number => clamp((ui?.lane?.clientWidth ?? FIG.max + 200) - (touch ? 190 : 150), FIG.floor, FIG.max);

/** A block's mark, as long as the block is tall in the lane: the shape's own reading, laid on its side. */
const markLength = (t: Tok): number => {
  const s = state.settings;
  const lines = t.type === "image" ? imageLines(t, s.measure, 17 * s.zoom * s.leading) : 0.55 + textOf([t]).length / LINE_CHARS;
  return clamp(lines * 5.5, 5, 58);
};

/** A brief's bar in the level run, as long as its branch is heavy; the root of the scale is the branch in lines of the lane. */
const branchLength = (a: string): number => clamp(Math.sqrt(Math.max(1, (state.index!.branch.get(a) ?? 0) / LINE_CHARS)) * 4.4, 4, 44);

/** The figure beside the action: what the press gives, then what lies further. */
function actFigure(b: Brief, rest: Tok[]): string {
  // the room is what the line has left once its count and its acts have taken theirs, so the figure yields to the words
  // rather than running past the prose; the marks scale together into it and keep their lengths true against each other
  const MAX = figRoom();
  const kids = levelOf(b);
  const blocks = rest.slice(0, FIG.shown).map((t) => ({ image: t.type === "image", w: markLength(t) }));
  const over = rest.length - blocks.length;
  const wide = (xs: { w: number }[]) => xs.reduce((n, x) => n + x.w + FIG.gap, 0);
  // the level merges into one bar when it holds too many to draw or the room has run out
  const room = Math.max(0, MAX - (blocks.length ? wide(blocks) + FIG.split : 0));
  const bars = kids.map((k) => ({ w: branchLength(k.address), deep: level(k.address).length > 0 }));
  const merged = kids.length > FIG.level || wide(bars) > room;
  // merged, the one bar is as long as the whole level is heavy, never as long as the room happens to be
  const home = b.borrow ?? b.address;
  const heavy = (state.index!.branch.get(home) ?? 0) - (state.index!.own.get(home) ?? 0);
  const whole = clamp(Math.sqrt(Math.max(1, heavy / LINE_CHARS)) * 4.4, 8, Math.max(8, Math.min(48, room)));
  const cells = !kids.length ? [] : merged ? [{ w: whole, deep: false, all: true }] : bars.map((x) => ({ ...x, all: false }));
  // what the paragraphs ask for, scaled to the room they have, so their lengths stay true against each other
  const asked = wide(blocks);
  const left = Math.max(FIG.floor, MAX - (cells.length ? Math.min(room, wide(cells)) + FIG.split : 0));
  const k = asked > left ? left / asked : 1;
  let x = 0;
  const marks = blocks
    .map((blk) => {
      const w = Math.max(4, blk.w * k);
      const r = blk.image
        ? `<rect class="image" x="${(x + 0.5).toFixed(1)}" y="${FIG.y + 0.5}" width="${(w - 1).toFixed(1)}" height="${FIG.bar - 1}" rx="1.5"/>`
        : `<rect class="para" x="${x.toFixed(1)}" y="${FIG.y}" width="${w.toFixed(1)}" height="${FIG.bar}" rx="1.5"/>`;
      x += w + FIG.gap;
      return r;
    })
    .join("");
  const overMark = over > 0 ? `<text class="more" x="${x.toFixed(1)}" y="${FIG.y + FIG.bar}">+${over}</text>` : "";
  if (over > 0) x += 16;
  if (blocks.length && cells.length) x += FIG.split - FIG.gap;
  const start = x;
  const run = cells
    .map((c) => {
      const bar = `<rect class="head" x="${x.toFixed(1)}" y="${FIG.y}" width="${c.w.toFixed(1)}" height="${FIG.bar}" rx="1.5"/>`;
      // a tick beneath a bar says that brief holds a level of its own; a merged bar carries one along its whole length
      const tick = c.deep || c.all ? `<rect class="hidden" x="${x.toFixed(1)}" y="${FIG.y + FIG.bar + 2}" width="${c.w.toFixed(1)}" height="${FIG.tick}" rx="0.9"/>` : "";
      x += c.w + FIG.gap;
      return bar + tick;
    })
    .join("");
  const w = Math.ceil(Math.max(x - FIG.gap, start));
  return w <= 0 ? "" : `<svg class="fig marks" width="${w}" height="${FIG.h}" viewBox="0 0 ${w} ${FIG.h}">${marks}${overMark}${run}</svg>`;
}

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
      ? `<div class="act more chrome" data-fold="${esc(b.address)}">` +
        actFigure(b, rest) +
        (beneath ? `<span class="beneath">${beneath} beneath</span>` : "") +
        `<span class="acts">${badgeHtml("unfold", b.address)}${ACTIONS.open.can(b.address) ? badgeHtml("open", b.address) : ""}${ACTIONS.backTo.can(b.address) ? badgeHtml("backTo", b.address) : ""}</span>` +
        `</div>`
      : "";
  // a whole brief folds from a line at its foot
  const less = g === "whole" && (rest.length > 0 || beneath > 0) ? `<div class="act less chrome" data-fold="${esc(b.address)}"><span class="acts">${badgeHtml("unfold", b.address)}${ACTIONS.open.can(b.address) ? badgeHtml("open", b.address) : ""}${ACTIONS.backTo.can(b.address) ? badgeHtml("backTo", b.address) : ""}</span></div>` : "";
  // a borrowing brief says what it borrows and where its home is; pressing the line follows it there
  const home = b.borrow !== undefined ? brief(b.borrow) : undefined;
  const borrow = home ? `<div class="act borrow chrome" data-a="${esc(home.address)}" data-borrow="${esc(home.address)}" ${hued(home.address)}>${icon("links")}<span>borrows</span>${pathHtml(home.address)}<span class="name">${esc(home.title || state.body!.title)}</span></div>` : "";
  return (
    `<article class="brief ${g}${on ? " on" : ""}${b.address === state.focus ? " here" : ""}" data-a="${esc(b.address)}" style="${tint(b.address)};--after:${after}px">` +
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
  keys: `<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M4 6.5h1M7.5 6.5h1M11 6.5h1M5 9.5h6"/>`,
  links: `<path d="M6 10 10 6M4.5 8.5 3 10a2.1 2.1 0 0 0 3 3l1.5-1.5M11.5 7.5 13 6a2.1 2.1 0 0 0-3-3L8.5 4.5"/>`,
  lane: `<path d="M4 3.5h8M4 6.5h8M4 9.5h6M4 12.5h7"/>`,
  close: `<path d="M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8"/>`,
  unfold: `<path d="M5.4 6.6 8 4l2.6 2.6M5.4 9.4 8 12l2.6-2.6"/>`,
  fold: `<path d="M5.4 4.4 8 7l2.6-2.6M5.4 11.6 8 9l2.6 2.6"/>`,
  open: `<path d="M9.6 3.5h3v3M6.4 12.5h-3v-3M12.5 3.5 9 7M3.5 12.5 7 9"/>`,
  chooser: `<rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2.2"/><path d="M6.1 3.2v9.6"/><path d="M3.4 6.1h1.4M3.4 8h1.4M3.4 9.9h1.4"/>`,
  history: `<circle cx="8" cy="3.6" r="1.7"/><circle cx="8" cy="12.4" r="1.7"/><path d="M8 5.3v5.4"/><path d="M9.7 12.4h1.8a2 2 0 0 0 2-2V8"/>`,
  canvas: `<rect x="2.5" y="2.5" width="5" height="3.5" rx="1"/><rect x="8.5" y="7" width="5" height="3.5" rx="1"/><rect x="2.5" y="11" width="5" height="3.5" rx="1"/><path d="M7.5 4.5h2a1.5 1.5 0 0 1 1.5 1.5v1M7.5 12.5h2a1.5 1.5 0 0 0 1.5-1.5v-.5"/>`,
};
const icon = (name: string): string => `<svg class="icon" viewBox="0 0 16 16">${ICON[name] ?? ICON.none}</svg>`;

const WIDGETS: Record<string, Widget> = {
  shape: { kind: "figure", name: "the shape: the lane as laid", icon: "shape", draw: (w, h) => shapeSvg(w, h), width: () => shapeWidth(), grow: true },
  tree: { kind: "figure", name: "the tree", icon: "tree", draw: () => treeHtml(), width: () => 240, grow: true, onFocus: true },
  ahead: { kind: "figure", name: "the ahead: what lies beneath and is not in the lane", icon: "ahead", draw: (w, h) => aheadSvg(w, h), width: () => aheadWidth(), grow: true, onFocus: true, onPoint: true },
  plate: { kind: "figure", name: "the plate: the body whole", icon: "plate", draw: (w, h) => plateSvg(w, h), width: () => plateWidth(), grow: false },
  settings: { kind: "figure", name: "settings", icon: "settings", draw: () => settingsHtml(), width: () => 216, grow: false },
  keys: { kind: "figure", name: "the keys: every act and what fires it", icon: "keys", draw: () => keysHtml(), width: () => 216, grow: false, onFocus: true },
  history: { kind: "figure", name: "the history: the commits' level small, a row per commit in its hue", icon: "history", draw: () => historyHtml(), width: () => 264, grow: true, onFocus: true },
  links: { kind: "adjunct", name: "links: what a brief points at, and what points at it", icon: "links", of: (b, el) => linkAdjuncts(b, el) },
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
/** The figures a wing draws, in order. */
const figureNames = (area: WingName): string[] => state.settings.areas[area].filter((k) => WIDGETS[k]?.kind === "figure");
/** The first widget an area holds, which is all a gutter holds; nothing, where the area is closed. */
const widgetOf = (area: AreaName): Widget | undefined => widgetsOf(area)[0];
const isOpen = (area: AreaName): boolean => widgetsOf(area).length > 0;
const choicesFor = (kind: Widget["kind"]): string[] => Object.keys(WIDGETS).filter((k) => WIDGETS[k].kind === kind);

/** The two sides a widget of each kind can stand on; a pane has none, since the middle holds its panes in one order. */
const SIDES: Record<Widget["kind"], AreaName[]> = { figure: ["wingL", "wingR"], adjunct: ["gutterL", "gutterR"], pane: [] };

/** The area holding a widget now, or null when it stands nowhere. */
const standsIn = (k: string): AreaName | null => AREAS.find(({ name }) => state.settings.areas[name].includes(k))?.name ?? null;

/** The panes the middle holds after one is pressed: a toggle, and the last pane cannot be taken away. */
const panesPressed = (k: string): string[] => {
  const held = state.settings.areas.middle;
  return held.includes(k) ? (held.length > 1 ? panesHeld(held.filter((x) => x !== k)) : held) : panesHeld([...held, k]);
};

/**
 * What every area holds with a widget put at one side, or at none. A pane toggles instead, since the middle holds its
 * panes in one order. A wing holds two, and a third takes the place at its foot; a gutter holds one.
 */
function placed(k: string, side: AreaName | null): Held {
  const w = WIDGETS[k];
  const held: Held = { ...state.settings.areas };
  if (w.kind === "pane") return { ...held, middle: panesPressed(k) };
  SIDES[w.kind].forEach((s) => (held[s] = held[s].filter((x) => x !== k)));
  if (side) held[side] = w.kind === "adjunct" ? [k] : held[side].length < 2 ? [...held[side], k] : [held[side][0], k];
  return held;
}

/** Whether a side would hold a widget at this width, reckoned with it taken off the side it stands on now. */
const holds = (k: string, side: AreaName): boolean => fitsWith(placed(k, side))[side];

/**
 * Where the next press puts a widget: the next side of the cycle that can hold it at this width, or nowhere. A side the
 * width denies is stepped over rather than offered, so a press never sends a widget somewhere it cannot stand.
 * Undefined where a press would do nothing at all, which is what makes an icon quiet.
 */
function nextPlace(k: string): AreaName | null | undefined {
  const [left, right] = SIDES[WIDGETS[k].kind];
  const at = standsIn(k);
  if (at === right) return null;
  if (at === left) return holds(k, right) ? right : null;
  return holds(k, left) ? left : holds(k, right) ? right : undefined;
}

const cycled = (k: string): Held => placed(k, nextPlace(k) ?? null);

/** Whether pressing an icon would change anything a reader can see: a widget already standing can always be moved on. */
function offered(k: string): boolean {
  const w = WIDGETS[k];
  const at = standsIn(k);
  if (w.kind === "pane") return at ? panesHeld().length > 1 : fitsWith({ ...state.settings.areas, middle: panesPressed(k) })[k as PaneName];
  return nextPlace(k) !== undefined;
}

/** What the tooltip says of an icon: what it is, and what the next press would do with it. */
function pickTip(k: string): string {
  const w = WIDGETS[k];
  const at = standsIn(k);
  const said = (s: string) => `${w.name} — ${s}`;
  if (!offered(k)) return said(w.kind === "pane" && at ? "the last pane cannot be taken away" : "no room for it at this width");
  if (w.kind === "pane") return said(at ? "press to take it away" : "press to stand it in the middle");
  const [left] = SIDES[w.kind];
  const where = (x: AreaName | null) => (x === null ? "take it away" : x === left ? "stand it at the left" : "stand it at the right");
  // a widget the width denies says so, and still says what a press would do with it
  const now = at === null ? "" : !fits()[at] ? "asked for, but there is no room at this width; " : at === left ? "at the left; " : "at the right; ";
  return said(`${now}press to ${where(nextPlace(k) ?? null)}`);
}

// ### 3.4.1 Where the lane stands alone
//
// The foot is not a second design: it is the strip in a second grain. Wide, it
// is the row; narrow, the row folds into one round mark at the foot of the
// page, and pressing it opens the row as a wide pill. One table, one set of
// states, so a choice is never specified twice.
//
// What the pill holds is fewer choices, since there are no sides to stand on:
// the panes, and the figures a reader opens whole over the reading and
// dismisses. The shape is not among them, since it is not a mode a reader picks
// but the rail beside the prose; nor is the ahead, which answers for a brief the
// pointer rests on, and a phone has no pointer.

/** Whether the lane stands alone: the width holds no wing at the width a figure declares, and no gutter beside it. */
const narrow = (): boolean => ui.areas.clientWidth < state.settings.measure + 3 * state.settings.gap + GUTTER.least;

/**
 * What the foot's row holds where the lane stands alone, which is always drawn and never opened: the pane the reader is
 * not in, which is one press to the other; the rail, while the prose stands and nothing is open over it; and the
 * settings. Three at most, and the acts of what is chosen stand beside them rather than behind a mark.
 *
 * The outline and the radial are not among them. Both were built and read badly on a phone, the outline poor whole and
 * the radial impossible to hit, so they wait until each has a touch reading of its own.
 */
const narrowChoices = (): string[] => [
  fits().lane ? "canvas" : "lane",
  ...(fits().lane && chooser.sheet === null ? ["shape"] : []),
  "settings",
  ...(touch ? [] : ["keys"]),
];

/** The figure standing open over the reading, which does not outlive a widening. */
const chooser = { sheet: null as string | null };

/** Whether a choice stands now: a pane in the middle, the shape as the rail beside the prose, any other figure opened whole. */
const narrowOn = (k: string): boolean => (WIDGETS[k].kind === "pane" ? panesHeld().includes(k as PaneName) : k === "shape" ? standsIn(k) !== null : chooser.sheet === k);

/** One choice in the pill: what it is, and whether it stands. No side, since the pill has none. */
function pickNarrowHtml(k: string): string {
  const w = WIDGETS[k];
  const on = narrowOn(k);
  // the pane standing alone cannot be taken away, so its icon says it is in use and offers nothing
  const quiet = w.kind === "pane" && on ? " fixed" : "";
  return `<button class="pick${on ? " on" : ""}${quiet}" data-widget="${esc(k)}" data-tip="${esc(w.name)}">${icon(w.icon)}</button>`;
}

/**
 * The acts the foot offers for a brief chosen on the canvas: the same two [the action line](lane.md#61-the-action-line-is-the-press)
 * draws beside a brief in the lane, since a node on the canvas has no line of its own to carry them.
 */
const FOOT_ACTS = ["unfold", "open"];

/**
 * An act in the foot's row: its glyph alone, in the round button the choices stand in, since the row is one grain and
 * the card beside it already says what is being acted on.
 */
const footBadge = (id: string, a: string): string => {
  const act = ACTIONS[id];
  if (!act?.mark || !act.can(a)) return "";
  return `<button class="pick" data-act="${esc(id)}" data-a="${esc(a)}" aria-label="${esc(act.label(a))}"><svg class="icon" viewBox="0 0 16 16">${act.mark(a)}</svg></button>`;
};

/** What the reader has chosen on the canvas, and how tall the card telling of it stands. */
const card = { a: null as string | null, h: 0 };

/** The brief the card tells of: what the reader chose, unless that is the scope's own root, which the entry takes no press to be. */
const chosen = (): Brief | undefined => (card.a !== null && card.a !== state.scope ? brief(card.a) : undefined);

/**
 * Whether the foot carries those acts: the canvas is the pane standing, the reader has chosen a brief on it, and that
 * brief has something to act on.
 */
const actingOnCanvas = (): boolean => narrow() && !fits().lane && fits().canvas && !!chosen() && FOOT_ACTS.some((id) => ACTIONS[id].can(card.a!));

/**
 * A press in the pill: a pane takes the middle, since the middle holds one; the shape stands as the rail or leaves it,
 * since it is not a mode but what stands beside the reading; any other figure opens whole, or closes if it stood.
 */
function chooseNarrow(k: string): void {
  if (WIDGETS[k].kind === "pane") {
    const taking = !narrowOn(k);
    if (taking) {
      state.settings.areas = { ...state.settings.areas, middle: [k] };
      saveSettings();
    }
    chooser.sheet = null;
    // the lane was laid out of sight while the reader was away, so its scroll says nothing; coming back, it is settled
    // at the brief they stand on, which is what lights it and everything that answers for it
    if (taking && k === "lane") {
      drawAll();
      return void settle(state.focus);
    }
    // taking the canvas, it is fitted again: the view it was left at was measured under a way down that may have said
    // something else then, and the entry would be drawn under it
    if (taking && k === "canvas") {
      drawAll();
      fitCanvas();
      return void applyView(false);
    }
  } else if (k === "shape") {
    // the rail cycles through the sides as the strip does on a desk, since a reader scrubbing with the hand they have
    // wants the rail under that hand and the callout away from it
    const at = standsIn(k);
    state.settings.areas = placed(k, at === "wingL" ? "wingR" : at === "wingR" ? null : "wingL");
    saveSettings();
  } else chooser.sheet = chooser.sheet === k ? null : k;
  drawAll();
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
      `<div class="node"><div class="row${on ? " on" : ""}${b.address === state.focus ? " here" : ""}" data-a="${esc(b.address)}" style="${tint(b.address)};--d:${d}">` +
      foldMark(b) +
      `<span class="name" data-go="${esc(b.address)}">${esc(b.title)}</span></div>` +
      (whole ? level(b.address).map((k) => node(k, d + 1)).join("") : "") +
      `</div>`
    );
  };
  const S = state.scope;
  const above = prefixesOf(S)
    .slice(0, -1)
    .map((a) => `<div class="row above" data-a="${esc(a)}" style="${tint(a)};--d:${depthOf(a)}"><span class="mark leaf"></span><span class="name" data-go="${esc(a)}">${esc(brief(a)!.title)}</span></div>`)
    .join("");
  const root = `<div class="row root${state.focus === S ? " here" : ""}" data-a="${esc(S)}" style="${tint(S)};--d:${depthOf(S)}"><span class="mark leaf"></span><span class="name" data-go="${esc(S)}">${esc(brief(S)!.title)}</span></div>`;
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
  if (target) return `<div class="adj" data-a="${esc(to)}" ${hued(to)}>${pathHtml(to)}<span class="name" data-go="${esc(to)}">${esc(target.title)}</span><span class="gloss">${esc(faceOf(target, fits().gutter))}</span></div>`;
  if (to === "web") return `<div class="adj dim"><span class="gloss">${esc(trim(detail || "the web", 40))}</span></div>`;
  if (to === "owed") return `<div class="adj dim"><span class="gloss">a brief not yet written</span></div>`;
  return `<div class="adj dim"><span class="gloss">outside the body: ${esc(trim(detail, 40))}</span></div>`;
}

/** Where a brief stands: the titles above it with a chevron between, whole, the root left out since it is the body. */
function pathHtml(to: string): string {
  const titles = prefixesOf(to).slice(1, -1).map((a) => brief(a)?.title ?? "");
  return titles.length ? `<span class="path">${titles.map((t) => `<span>${esc(t)}</span>`).join(CHEVRON)}</span>` : "";
}

/** The opening words of a brief's face, cut shorter where the gutter has been given less room to read them in. */
const faceOf = (b: Brief, room = GUTTER.want): string => trim(textOf([blocksOf(b).find((t) => t.type === "paragraph") ?? { type: "space" }]), room < 170 ? 56 : 90);

/** What points at a brief, told at its foot. */
function footHtml(b: Brief): string {
  const refs = Array.from(state.index!.backlinks.get(b.address) ?? [], (r) => brief(r)).filter((x): x is Brief => !!x);
  return refs.length ? `<div class="adj foot"><span class="gloss">pointed at by</span>${refs.map((r) => `<span class="name" data-a="${esc(r.address)}" data-go="${esc(r.address)}" ${hued(r.address)}>${esc(r.title)}</span>`).join("")}</div>` : "";
}

function linkAdjuncts(b: Brief, article: HTMLElement): { at: HTMLElement | null; html: string }[] {
  const beside = all<HTMLElement>("a[data-link]", article).map((a) => ({ at: a, html: adjHtml(a.dataset.link!, a.dataset.link === "web" ? (a as HTMLAnchorElement).hostname : a.dataset.href ?? "") }));
  const foot = footHtml(b);
  return [...beside, ...(foot ? [{ at: null, html: foot }] : [])];
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

/**
 * What a setting cannot change where the lane stands alone: the measure, which the width already sets; the canvas's
 * greatest width, since it takes the page whole; the ahead, which does not stand there; and the flick, which reads a
 * wheel no finger sends. They are not drawn, rather than drawn and idle.
 */
const IDLE_NARROW = new Set(["measure", "canvas", "ahead", "flick"]);
/** A setting that cannot act where the lane stands alone is not drawn, and the history is not offered where the body has none. */
const shownHere = (key: string): boolean => !(narrow() && IDLE_NARROW.has(key)) && (key !== "back" || !!state.body?.history);

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
  const rows = (["type", "page", "canvas"] as const).map((r) => KNOBS.filter((k) => k.row === r && shownHere(k.key))).filter((ks) => ks.length);
  return `<div class="settings">${rows.map((ks) => `<div class="knobs">${ks.map(knob).join("")}</div>`).join("")}<div class="switches chrome">${SWITCHES.filter((w) => shownHere(w.key)).map(row).join("")}</div></div>`;
}

/** The switches beneath the meters: a setting with a few named values, a row apiece. */
type Switch = { key: "flick" | "theme" | "headings" | "prose" | "line" | "weight" | "ahead" | "back"; name: string; values: (string | number)[]; labels?: string[] };
const SWITCHES: Switch[] = [
  { key: "theme", name: "theme", values: THEMES },
  { key: "headings", name: "headings", values: FACES },
  { key: "prose", name: "prose", values: FACES },
  { key: "line", name: "reading line", values: ["middle", "ends"] },
  { key: "weight", name: "weight", values: ["cost", "experience"] },
  { key: "ahead", name: "the ahead", values: ["hidden", "always"] },
  { key: "flick", name: "flick", values: [1, 0], labels: ["on", "off"] },
  { key: "back", name: "history", values: [0, 1, 3, 5, 10, 20], labels: ["off", "1", "3", "5", "10", "20"] },
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
    // the fade was lengthened on 2026-09-16, and a reader holding exactly the value it had before never chose it, so
    // they take the new one. This is the last such line: what is written from here on keeps only what a reader set
    if (saved && saved.fade === 8) state.settings.fade = DEFAULTS.fade;
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
  if (!Number.isInteger(state.settings.back) || state.settings.back < 0) state.settings.back = DEFAULTS.back;
}
/**
 * Only what the reader has actually set is kept, which is what they differ from the defaults in. A reader who never
 * turned a meter then follows the default when it changes, rather than being pinned for good to the value it had the
 * first time they pressed anything at all.
 */
const saveSettings = (): void =>
  void localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(Object.fromEntries(Object.entries(state.settings).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULTS[k as keyof Settings])))),
  );

// ### 3.8.1 The keys: every act and what fires it
//
// Most acts stand as a badge where their object stands, and a few have no
// object on the page: the arrows that move the reading are the keys of a
// cursor. So one figure holds the whole table, grouped by what each act works
// on, drawn from the same entries, and every badge there is pressable and tells
// the rest on hover. It answers for the focus, so what the space bar would do
// now is what it says.

const KEY_GROUPS: { of: string; acts: string[] }[] = [
  { of: "the brief", acts: ["unfold", "foldUp", "open", "backTo"] },
  { of: "the scope", acts: ["deeper", "shallower", "unfoldAll", "foldAll", "widen"] },
  { of: "the reading", acts: ["previous", "next", "above", "beneath"] },
  { of: "the lane", acts: ["undo", "redo"] },
];

const keysHtml = (): string =>
  `<div class="keys">${KEY_GROUPS.map((g) => `<div class="group"><span class="of chrome dim">${esc(g.of)}</span>${g.acts.map((id) => badgeHtml(id)).join("")}</div>`).join("")}</div>`;

// ### 3.8.2 The history: the level's miniature
//
// The commits stand in the body as briefs of their own level, and this figure
// is that level small, as the shape is the lane small: a row per commit, its
// swatch in the hue the commit takes, its short hash, its date and its subject
// cut to the row. Each row is the commit's brief, so pointing lights it
// wherever it is drawn; the name goes to it in the lane, and the swatch or the
// hash takes the brief's own act, back to here. The row the reading stands at
// is marked.

function historyHtml(): string {
  const h = state.body?.history;
  const home = state.body?.briefs.find((b) => b.virtual === "history");
  if (!h || !home) return `<div class="history chrome"><span class="none dim">no history: the root is not in a repository git can read</span></div>`;
  const back = state.settings.back;
  const row = (c: Commit, i: number) => {
    const a = `${home.address}/${c.short}`;
    return (
      `<div class="commit${i === back - 1 ? " on" : ""}${i < back ? " in" : ""}${a === state.focus ? " here" : ""}" data-a="${esc(a)}" ${hued(a)}>` +
      `<span class="when" data-back="${i}" data-tip="${i === back - 1 ? "read as now" : "back to here"}"><i class="swatch"></i><span class="hash">${esc(c.short)}</span><span class="date">${esc(c.date)}</span></span>` +
      `<span class="name" data-go="${esc(a)}" data-tip="${esc(c.subject)}">${esc(c.subject)}</span></div>`
    );
  };
  return `<div class="history chrome">${h.commits.map(row).join("")}</div>`;
}

// ## 3.9 The shape: the lane as laid
//
// Each brief in the lane as its blocks, a paragraph a block as tall as it is
// drawn, shifted right by the brief's depth, with the viewport drawn over it.
// Dragging scrubs; pressing goes.

const SHAPE = { indent: 9, bar: 46, pad: 6, tail: 30, inset: 4, railIndent: 5, railBar: 28 };

/** The width the shape stands in: its deepest possible row, whatever the lane is scoped to, with the marks beside it. */
const shapeWidth = (): number => SHAPE.pad * 2 + 4 + (state.index?.depth ?? 0) * SHAPE.indent + SHAPE.bar + 4 + 26 + SHAPE.tail;
/**
 * The rail: where the lane stands alone the shape keeps standing beside it, narrow, since it does not need much width
 * to make itself clear. What it gives up at that width is the room for its marks and its tail, so it is its rows and
 * nothing else; and the lane gives it its room, taking the edge's space for it.
 */
const RAIL = { least: 72, most: 110, lane: 200 };
const railWidth = (): number => clamp(SHAPE.pad * 2 + 4 + (state.index?.depth ?? 0) * SHAPE.railIndent + SHAPE.railBar, RAIL.least, RAIL.most);
/** Whether the shape stands as the rail now, which is what takes its marks away. */
const onRail = (): boolean => fits().rail > 0;
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
  // as the rail the shape stands narrow, so its marks take the room each row actually has left and no more, rather
  // than the room the figure declares; and a finger cannot find a row six pixels tall, so the rail takes no presses
  // under one and answers a scrub instead
  const rail = onRail();
  const bar = rail ? SHAPE.railBar : SHAPE.bar;
  // the levels above the scope stand to the left of the opening's row, a tick per ancestor, outermost leftmost
  // the ticks for the levels above are marks like any other, so the rail gives up their room as well; the way down,
  // which reaches over the rail, names those levels and is a press a finger can find
  const anc = rail ? [] : prefixesOf(state.scope).slice(0, -1);
  const L = anc.length ? anc.length * 8 + 4 : 0;
  // the shape stands in its own width, never a wider figure's beside it in the same wing
  const w = Math.min(W, shapeWidth());
  const cells = laid.map((l) => {
    // the rail nests a step tighter than the wing does, so a level six deep still leaves a row room for its marks
    const x = SHAPE.pad + L + depthIn(l.a) * (rail ? SHAPE.railIndent : SHAPE.indent);
    const bars = l.blocks
      .map((b) => blockRect(b.kind, x, 4 + b.top * k, b.kind === "head" ? Math.round(bar * 0.6) : Math.max(4, Math.round(bar * b.width)), Math.max(1.2, b.height * k - 1)))
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
    // the marks keep to the room the shape declares for them, so a brief of many images stops where eight ticks would;
    // on the rail the room is what the row has left of the rail's own width, since there is no more to give
    const t0 = x + bar + 4;
    const room = rail ? Math.max(0, w - t0 - 2) : 24 + SHAPE.tail;
    const tickRoom = rail ? Math.max(0, Math.min(24, room - 5)) : 24;
    let tx = t0;
    const ticks =
      face && b
        ? beyond
            .map((t) => {
              const image = t.type === "image";
              if (tx - t0 + (image ? 5 : 2) > tickRoom) return "";
              const tick = image ? `<rect class="tick image${ghost}" x="${tx + 0.5}" y="${y}" width="4" height="${h}" rx="1"/>` : `<rect class="tick${ghost}" x="${tx}" y="${y}" width="1.6" height="${h}"/>`;
              tx += image ? 7 : 3;
              return tick;
            })
            .join("")
        : "";
    tx += paras ? 2 : 0;
    const tailW = hidden > 0 ? clamp(3 + Math.sqrt(hidden) / 4, 3, rail ? Math.max(0, w - tx - 2) : SHAPE.tail) : 0;
    const tail = hidden > 0 && face && tailW >= 3 ? `<rect class="hidden${ghost}" x="${tx}" y="${y}" width="${tailW.toFixed(1)}" height="${h}" rx="1"/>` : "";
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
      (rail && touch ? "" : `<rect class="hit" data-press="go" x="${x - 3}" y="${top}" width="${bar + 5}" height="${height}"/>`) +
      (!(rail && touch) && (paras || hidden) ? `<rect class="hit" data-press="fold" x="${x + bar + 2}" y="${fy}" width="${Math.max(6, marksEnd - x - bar - 2)}" height="${fh}"/>` : "") +
      `${bars}${ticks}${tail}</g>` +
      above
    );
  });
  // the band stands half the rail's own inset clear of its rows, and the same clear of its edge, so it is not pressed
  // against the side of the page on one side and floating on the other
  const bx = rail ? SHAPE.pad / 2 : 0;
  return `<svg class="fig shape" data-k="${k}" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">${cells.join("")}<rect class="cursor" x="${bx}" y="${(4 + box.scrollTop * k).toFixed(1)}" width="${w - 2 * bx}" height="${(box.clientHeight * k).toFixed(1)}" rx="4"/></svg>`;
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
  return `<div class="cnode${zone ? " whole" : ""}" style="${tint(b.address)};--d:${Math.max(0, depthIn(b.address) - 1)}">${line}${zone}</div>`;
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
  const cells = Array.from({ length: n }, (_, i) => `<span class="dc${i + 1 <= unfolded ? " on" : ""}" data-depth="${i + 1}">${i + 1}</span>`).join("");
  return `<div id="depth" data-tip="how far the scope is unfolded">${cells}${badgePair("shallower", "deeper")}</div>`;
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
  view.y = canvasTop();
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
  const inside = r.top >= c.top + canvasTop() && r.bottom <= c.bottom - CANVAS_INSET && r.left >= c.left && r.right <= c.right;
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

type UI = { header: HTMLElement; crumb: HTMLElement; pull: HTMLElement; tip: HTMLElement; areas: HTMLElement; canvas: HTMLElement; scroll: HTMLElement; content: HTMLElement; lane: HTMLElement; notice: HTMLElement; parts: Record<AreaName, HTMLElement>; sheet: HTMLElement; card: HTMLElement; strips: HTMLElement };
let ui: UI;

const all = <T extends Element>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel));
const cssEsc = (s: string): string => s.replace(/["\\]/g, "\\$&");

/** A gutter's width: what an adjunct reads best in, and the least it still reads in when the wings have taken their room. */
const GUTTER = { want: 210, least: 132 };
/** The room beneath a wing's figures that its strip stands in, above the space every area keeps. */
const STRIP = 34;
/** The room the foot keeps clear: the strip's icons with as much above them as below. */
const FOOT = STRIP + 10;
/**
 * The room the foot keeps clear of the prose. Wide, it is the strip's own room, since the row of icons spans the page
 * and would otherwise sit on the text. Narrow, it is one gap: the mark is a single round thing over the middle of the
 * prose, and standing over the reading is the whole of what it is for, so the fade is what keeps it readable and the
 * prose keeps the room it would otherwise have lost.
 */
const footRoom = (): number => (narrow() ? state.settings.gap : FOOT);
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
  // a wing's figures clear the strip wide; narrow, the rail stands at the edge and the mark at the middle, so they
  // never meet and the rail reaches as far down as the prose does
  const foot = Math.max(narrow() ? s.gap : s.gap + STRIP, footRoom() + (h * s.fade) / 2 / 100);
  return { top: Math.round(top), height: Math.max(0, Math.round(h - top - foot)) };
}

/** What each area holds, as the settings keep it or as a press would leave it. */
type Held = Record<AreaName, string[]>;

/** How wide an area stands with what it holds: closed, nothing; a gutter its column; a wing its widest figure, its strip free to reach a little past it; the middle is laid apart. */
const widthIn = (held: Held, area: AreaName): number =>
  held[area].length === 0 || area === "middle" || area.startsWith("gutter") ? 0 : Math.max(...held[area].map((k) => (WIDGETS[k]?.kind === "figure" ? (WIDGETS[k] as Figure).width() : 0)));
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
type Fit = Record<AreaName, boolean> & { canvas: boolean; lane: boolean; /** the width each gutter stands in, once the wings have taken theirs */ gutter: number; /** the width the shape stands in as the rail, where every area has given way */ rail: number; /** the wing the rail stands in, which is the side the reader put the shape on */ railSide: WingName };
function fitsWith(held: Held): Fit {
  const s = state.settings;
  const on: Fit = { wingL: false, gutterL: false, middle: true, gutterR: false, wingR: false, canvas: false, lane: false, gutter: 0, rail: 0, railSide: "wingL" };
  AREAS.forEach(({ name }) => name !== "middle" && (on[name] = held[name].length === 0));
  // the middle first: the lane at its measure, the canvas at its least width beside it; too narrow for both, the canvas gives way, since the lane is the reading
  const panes = panesHeld(held.middle);
  on.lane = panes.includes("lane");
  on.canvas = panes.includes("canvas");
  let used = (on.lane ? s.measure + 2 * s.gap : 0) + (on.canvas ? CANVAS_MIN + (on.lane ? s.gap : 2 * s.gap) : 0);
  if (on.lane && on.canvas && used > ui.areas.clientWidth) (on.canvas = false), (used = s.measure + 2 * s.gap);
  for (const wing of ["wingL", "wingR"] as AreaName[]) {
    const need = held[wing].length ? widthIn(held, wing) + s.gap : 0;
    if (used + need > ui.areas.clientWidth) break;
    used += need;
    on[wing] = true;
  }
  // the gutters belong to the lane and stand only beside it, and they take the room the wings left them rather than a
  // width of their own: a narrower gutter is still a gutter, aligned to its lines and scrolling with them, where one
  // carried somewhere else is not. Below the least a preview reads in they give way as a pair
  const wanted = (["gutterL", "gutterR"] as const).filter((a) => held[a].length > 0);
  if (on.lane && wanted.length) {
    const room = ui.areas.clientWidth - used - wanted.length * s.gap;
    const each = Math.min(GUTTER.want, Math.floor(room / wanted.length));
    if (each >= GUTTER.least) {
      on.gutter = each;
      wanted.forEach((a) => (on[a] = true));
    }
  }
  // the exception at the end of the order of giving way: where every area has gone and the lane would stand alone, the
  // shape keeps standing as a narrow rail, if the reader has asked for it and the lane is left room enough to read in
  const stands = (a: AreaName) => on[a] && held[a].length > 0;
  // the rail stands on the side the reader put the shape on, as it does on a desk
  const side: WingName | null = held.wingL.includes("shape") ? "wingL" : held.wingR.includes("shape") ? "wingR" : null;
  if (on.lane && side && !(["wingL", "wingR", "gutterL", "gutterR"] as AreaName[]).some(stands)) {
    const w = railWidth();
    if (ui.areas.clientWidth - w - 2 * s.gap >= RAIL.lane) {
      on.rail = w;
      on.railSide = side;
      on[side] = true;
    }
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
  root.setProperty("--rim-foot", `${footRoom()}px`);
  // the theme picks a side of every colour; the system setting leaves it to the browser, so nothing flashes
  if (s.theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s.theme;
  const on = fits();
  // a viewport narrower than the measure gives the lane what there is, less what the rail takes: the rail stands at the
  // edge of the page, so it takes the space that stood there rather than a space of its own
  const measure = Math.min(s.measure, ui.areas.clientWidth - 2 * s.gap - on.rail);
  root.setProperty("--measure", `${measure}px`);
  // the gutters hug the lane at the gap, since what stands in them is aligned to its lines; only what the width allows
  // takes a column, since an absent element leaves the grid and would pull the lane into the empty track it left
  const inner = (["gutterL", "lane", "gutterR"] as const).flatMap((a) => (a === "lane" ? [measure] : on[a] && takesRoom(a) ? [on.gutter] : []));
  const mid = inner.reduce((x, y) => x + y, 0) + s.gap * (inner.length - 1);
  // every area is as wide as what it holds, and the spaces beside them are one: at the two edges of the viewport as
  // between the wings and the lane. The gap is the least a space is given, and what the width leaves over is shared
  // among the spaces evenly, so no area carries room it does not use
  // with the canvas standing, the spaces are the gap exactly and the canvas takes what is left; without it they share what is left
  // standing alone on a narrow screen the canvas takes the page whole, edge to edge: there is too little room to spend
  // any of it on a margin, and what falls outside is cut by the viewport as a map is
  const bleed = narrow() && on.canvas && !on.lane;
  const space = bleed ? "0px" : on.canvas ? `${s.gap}px` : `minmax(${s.gap}px, 1fr)`;
  // the rail hugs the edge it stands on, so the space at that edge is nothing and the rail takes it
  const railL = on.rail > 0 && on.railSide === "wingL";
  const railR = on.rail > 0 && on.railSide === "wingR";
  const tracks = [railL ? "0px" : space];
  const place = (el: HTMLElement, width: string) => {
    tracks.push(width, space);
    el.style.gridColumn = `${tracks.length - 1}`;
  };
  if (railL) place(ui.parts.wingL, `${on.rail}px`);
  else if (on.wingL && takesRoom("wingL")) place(ui.parts.wingL, `${widthOf("wingL")}px`);
  // the canvas grows to its greatest width and no further, so the row stays centred with its space around it
  // the canvas standing beside the lane keeps its least width; standing alone it takes whatever the width is, since
  // there is nothing to give way to and a floor would only overflow the page
  if (on.canvas) place(ui.canvas, bleed ? "1fr" : `minmax(${on.lane ? CANVAS_MIN : 0}px, ${Math.max(CANVAS_MIN, s.canvas)}px)`);
  if (on.lane) place(ui.scroll, `${mid}px`);
  if (railR) (place(ui.parts.wingR, `${on.rail}px`), (tracks[tracks.length - 1] = "0px"));
  else if (on.wingR && takesRoom("wingR")) place(ui.parts.wingR, `${widthOf("wingR")}px`);
  ui.areas.style.gridTemplateColumns = tracks.join(" ");
  ui.areas.style.columnGap = "0px";
  ui.content.style.gridTemplateColumns = inner.map((x) => `${x}px`).join(" ");
  ui.content.style.columnGap = `${s.gap}px`;
  ui.canvas.hidden = !on.canvas;
  ui.canvas.classList.toggle("bleed", bleed);
  // the lane off is kept laid out of sight rather than hidden, since the shape and the reading line measure it
  ui.scroll.classList.toggle("off", !on.lane);
  ui.scroll.style.width = on.lane ? "" : `${mid}px`;
  AREAS.forEach(({ name }) => name !== "middle" && (ui.parts[name].hidden = !(on.rail && name === on.railSide) && (!on[name] || !takesRoom(name))));
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
  // the trail's cells are small targets, and every move a reader makes is already in the browser's history, so where
  // the lane stands alone the platform's own back gesture is the trail and a better one
  const trail = narrow() ? [] : state.trail.filter((h) => brief(h.to));
  // narrow, the depth leaves the line: its cells crowd the placement, and unfolding a scope six levels deep is not
  // something a phone wants offered
  const depth = narrow() ? "" : depthHtml();
  // undo has no home on a phone, where a reader takes the platform's own back gesture rather than looking for a button
  const back = narrow() ? "" : badgeHtml("undo", undefined, true);
  // the run of levels goes down to the brief in focus, not only to the scope: a reader scrolling into a brief has its
  // heading off the screen, and the address of where they stand is what the line is for
  const run = prefixesOf(state.focus);
  ui.crumb.hidden = run.length < 2 && S === "" && trail.length === 0 && depth === "" && back === "";
  // narrow, the whole run would cut every name to a letter, so it keeps the level above and stands for the rest with
  // one mark, as the trail is cut at its root; the way out a level at a time is the badge beside it
  const kept = narrow() && run.length > 2 ? run.slice(-2) : run;
  const above = run.length - kept.length;
  // a step above the scope scopes out to it; one within it goes there; the brief in focus is where the reader stands
  const step = (a: string): string => {
    const cls = a === state.focus ? "step now" : a === S ? "step root" : "step";
    const takes = a === state.focus ? "" : depthOf(a) < depthOf(S) ? ` data-scope="${esc(a)}"` : ` data-go="${esc(a)}"`;
    return `<span class="${cls}" data-a="${esc(a)}"${takes} ${hued(a)}>${esc(brief(a)!.title)}</span>`;
  };
  const place =
    (above ? `<span class="step more" data-tip="${above} level${above > 1 ? "s" : ""} above, cut at the root">…</span>${CHEVRON}` : "") +
    kept.filter((a) => brief(a)).map(step).join(CHEVRON);
  const shown = trail.slice(-TRAIL_SHOWN);
  const cut = trail.length - shown.length;
  const way = trail.length ? `<span class="trail">${cut ? `<span class="step more" data-tip="${cut} earlier moves, cut at the root">…</span>` : ""}${shown.map(hopCell).join("")}</span>` : "";
  ui.crumb.innerHTML = `<span class="place">${place}${badgeHtml("widen", undefined, true)}</span>${depth}${way}${back}`;
  placeCrumb();
  trimPlace();
}

/**
 * Cuts the run at its root until every name it still shows can be read whole. A name squeezed to a letter says nothing,
 * where one mark says plainly that there is more above; and the brief in focus is never cut, since it is the answer the
 * line is there to give.
 */
function trimPlace(): void {
  const place = ui.crumb.querySelector<HTMLElement>(".place");
  if (!place) return;
  const cut = () => Array.from(place.querySelectorAll<HTMLElement>(".step:not(.more):not(.now)"));
  for (let guard = 0; guard < 24; guard++) {
    const steps = cut();
    if (!steps.some((el) => el.scrollWidth > el.clientWidth + 1) || steps.length === 0) return;
    // the chevron that followed the name goes with it
    steps[0].nextElementSibling?.matches("svg") && steps[0].nextElementSibling.remove();
    steps[0].remove();
    if (!place.querySelector(".more")) place.insertAdjacentHTML("afterbegin", `<span class="step more">…</span>${CHEVRON}`);
  }
}

/** The panes of the middle that stand on the screen. */
const panesShown = (): HTMLElement[] => [ui.canvas, ui.scroll].filter((el) => !el.hidden && !el.classList.contains("off"));

/** How far the nodes stand in from the canvas's rim. */
const CANVAS_INSET = 24;
/** How far in from the canvas's own top the nodes begin: past the way down where it stands over the canvas, since taking the page whole leaves no margin to stand it in. */
const canvasTop = (): number => Math.max(CANVAS_INSET, ui.crumb.hidden || !ui.canvas.classList.contains("bleed") ? 0 : ui.crumb.offsetTop + ui.crumb.offsetHeight + 10 - ui.canvas.getBoundingClientRect().top);

/** The canvas stands in the band the figures stand in: below the way down, above the strip's room at the foot. */
function placeCanvas(): void {
  const s = state.settings;
  // taking the page whole it keeps no margin either: the way down stands over it and the fade at its ends is what
  // keeps both readable, as the prose's fade does
  if (ui.canvas.classList.contains("bleed")) {
    ui.canvas.style.marginTop = "0px";
    ui.canvas.style.marginBottom = "0px";
    return;
  }
  const top = Math.max(s.gap, ui.crumb.hidden ? 0 : ui.crumb.offsetTop + ui.crumb.offsetHeight + 10);
  ui.canvas.style.marginTop = `${Math.round(top)}px`;
  ui.canvas.style.marginBottom = `${footRoom()}px`;
}

/**
 * The way down spans the middle, whatever it holds: the placement at its left edge, the depth beside the trail against
 * its right, so the cells keep their place as moves are added. With the lane alone it is as wide as the prose.
 */
function placeCrumb(): void {
  // the bar stands flush with the prose's edges and with the canvas's rim, and with the rail's edge where one stands,
  // so the placement has the whole row to read in and the depth stands over the rail
  const edges = [...panesShown(), ...(fits().rail ? [ui.parts.wingL] : [])].map((el) => {
    const r = el.getBoundingClientRect();
    return el === ui.scroll ? ui.lane.getBoundingClientRect() : { left: r.left, right: r.right };
  });
  const a0 = ui.areas.getBoundingClientRect();
  // the rail hugs the page's edge, but the way down is chrome and stands clear of it, so it keeps the same margin on
  // both sides rather than running into the left edge while the right one is a gap in from it
  const left = Math.max(Math.min(...edges.map((r) => r.left)), narrow() ? a0.left + state.settings.gap : -Infinity);
  const right = Math.max(...edges.map((r) => r.right));
  ui.crumb.style.left = `${Math.round(left - a0.left)}px`;
  ui.crumb.style.width = `${Math.round(Math.min(right, narrow() ? a0.right - state.settings.gap : Infinity) - left)}px`;
  // the pull's gauge lies over the top of the prose, just under the way down
  const lane = ui.lane.getBoundingClientRect();
  ui.pull.style.left = `${Math.round(lane.left - a0.left)}px`;
  ui.pull.style.width = `${Math.round(lane.width)}px`;
  ui.pull.style.top = `${ui.crumb.hidden ? 8 : ui.crumb.offsetTop + ui.crumb.offsetHeight + 4}px`;
  placeCanvas();
  // the prose is clear below the way down whatever the fade is doing, so no line reads under it
  // narrow, the fade begins above the way down rather than below it: the prose is never clear behind the line, so the
  // two read as one page and the reading keeps the room the clearance would have taken
  ui.scroll.style.setProperty(
    "--rim-crumb",
    ui.crumb.hidden ? "0px" : `${narrow() ? Math.round(ui.crumb.offsetTop + ui.crumb.offsetHeight / 2) : ui.crumb.offsetTop + ui.crumb.offsetHeight + 8}px`,
  );
}

/** Adjuncts stand in the gutter columns at the height of the line they belong to, pushed down where two would meet. */
function drawAdjuncts(): void {
  const on = fits();
  let overhang = 0;
  (["gutterL", "gutterR"] as const).forEach((area) => {
    const col = ui.parts[area];
    const widget = widgetOf(area);
    col.innerHTML = "";
    if (!on[area] || widget?.kind !== "adjunct") return;
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

/** The least height a growing figure is drawn into; below it the slot is left empty rather than drawn at no scale. */
const FIGURE_FLOOR = 48;

/**
 * Lays one wing whole. One figure has the wing's height; two stand at its top and its foot, with one space between. A
 * figure that takes only what it needs is drawn first and measured, and a figure that grows takes what is left, shared
 * evenly when both grow. The figures stand in the band the prose reads in, between the middles of its fades.
 */
function drawWing(area: "wingL" | "wingR"): void {
  const el = ui.parts[area];
  const s = state.settings;
  const on = fits();
  // the rail is the shape and nothing else, whichever wing the reader had it in
  const names = on.rail ? (area === on.railSide ? ["shape"] : []) : on[area] ? figureNames(area) : [];
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
    // a slot shorter than a figure can draw in is left empty rather than drawn at a scale below nothing
    if (x.f.grow) x.div.innerHTML = height >= FIGURE_FLOOR ? x.f.draw(W, Math.round(height)) : "";
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
 * The strip: one row at the foot of the page, centred, holding every choice once. The panes stand first, then the
 * adjuncts, then the figures, in three groups spaced apart, since a reader's question at the foot is one question and
 * not five. It stands wherever the middle stands, which is always, so nothing is ever out of reach at any width.
 */
function drawChooser(): void {
  if (narrow()) {
    // the mark gets out of the way as a reader reads; opening it brings the foot back, since a pill laid away would
    // answer a press with nothing
    if (!fits().lane) ui.strips.classList.remove("away");
    // the foot is one row and it is always drawn: the choices stand in it, and the acts of what is chosen stand beside
    // them, so nothing hides anything else and nothing is two presses away
    const acts = actingOnCanvas() ? `<div class="pill glass">${FOOT_ACTS.map((id) => footBadge(id, card.a!)).join("")}</div>` : "";
    ui.strips.innerHTML = `<div class="strip foot">${acts}<div class="pill glass">${narrowChoices().map(pickNarrowHtml).join("")}</div></div>`;
    return;
  }
  // widened, the row comes back whole and nothing stands open over the reading
  chooser.sheet = null;
  const group = (kind: Widget["kind"]) => `<span class="group">${choicesFor(kind).map(pickHtml).join("")}</span>`;
  ui.strips.innerHTML = `<div class="strip">${(["pane", "adjunct", "figure"] as const).map(group).join("")}</div>`;
}

// ### 3.12.1 The card at the foot
//
// A node on the canvas is a heading and a few marks, and pressing one told a
// reader nothing of what it held. So what they choose raises a card at the foot:
// its path, its heading and its face, with its acts standing on it, which is the
// least that says whether to go there. It rises to what it has to say and no
// further, and the reader draws it up for more: dragging up grows it to half the
// screen and then scrolls its prose, dragging down does the reverse and lets it
// go. What it draws is what the lane would draw, so nothing is written twice.

/** The card's heights: what it stands at when it is raised, the least it is held at before a release lets it go, and the most, as a share of the page. */
const CARD = { base: 210, least: 120, most: 0.52 };
/** How tall the card would be with none of its prose cut off. */
const cardFull = (): number => {
  const hold = ui.card.querySelector<HTMLElement>(".hold");
  return hold ? card.h + Math.max(0, hold.scrollHeight - hold.clientHeight) : CARD.base;
};
/** The most the card stands at: half the page, or what it has to say, whichever is less. */
const cardMost = (): number => Math.max(CARD.least, Math.min(Math.round(ui.areas.clientHeight * CARD.most), cardFull()));

/** Draws the card for what the reader chose, and takes it away when they have chosen nothing. */
function drawCard(): void {
  const b = chosen();
  const was = ui.card.dataset.a;
  ui.card.hidden = !b || !narrow() || fits().lane;
  if (ui.card.hidden || !b) {
    ui.card.innerHTML = "";
    delete ui.card.dataset.a;
    card.h = 0;
    return;
  }
  if (was !== b.address) {
    ui.card.dataset.a = b.address;
    card.h = CARD.base;
    ui.card.className = "glass";
    ui.card.innerHTML = `<div class="hold"><div class="said">${pathHtml(b.address)}<h3>${esc(b.title)}</h3>${blocks(blocksOf(b).slice(0, 1))}</div></div>`;
  }
  ui.card.style.height = `${Math.round(clamp(card.h, CARD.least, cardMost()))}px`;
}

/** Lets the card go, with what was chosen. */
function dropCard(): void {
  if (card.a === null) return;
  card.a = null;
  drawCard();
  drawChooser();
}

/**
 * A figure opened whole over the reading, where the lane stands alone: the outline, the radial or the settings, each
 * standing in the band the prose reads in and dismissed by pressing its icon again. The lane stays laid beneath it,
 * since the rail and the reading line measure it.
 */
function drawSheet(): void {
  const w = chooser.sheet ? WIDGETS[chooser.sheet] : undefined;
  const on = !!w && w.kind === "figure";
  ui.sheet.hidden = !on;
  if (!on) return void (ui.sheet.innerHTML = "");
  const s = state.settings;
  // narrow, a figure opened whole is the page: standing in a band left the prose showing above and below it, which
  // read as an overlay over a reading the reader had left
  const whole = narrow();
  ui.sheet.classList.toggle("bleed", whole);
  ui.sheet.style.top = whole ? "0px" : `${Math.round(Math.max(s.gap, ui.crumb.hidden ? 0 : ui.crumb.offsetTop + ui.crumb.offsetHeight + 10))}px`;
  ui.sheet.style.bottom = whole ? "0px" : `${footRoom()}px`;
  ui.sheet.innerHTML = `<div class="slot"></div>`;
  const slot = ui.sheet.firstElementChild as HTMLElement;
  slot.innerHTML = (w as Figure).draw(slot.clientWidth, slot.clientHeight);
}

/** One icon: what it is, whether it stands and on which side, and whether it can be taken at all. */
function pickHtml(k: string): string {
  const at = standsIn(k);
  const side = at === null || WIDGETS[k].kind === "pane" ? "" : at.endsWith("L") ? " side-l" : " side-r";
  // in use but with no room at this width: the choice stands and the width denies it, which is neither in use nor out of reach
  const denied = at !== null && !fits()[at === "middle" ? (k as PaneName) : at] ? " denied" : "";
  const quiet = offered(k) ? "" : at ? " fixed" : " off";
  return `<button class="pick${at ? " on" : ""}${side}${denied}${quiet}" data-widget="${esc(k)}" data-tip="${esc(pickTip(k))}">${icon(WIDGETS[k].icon)}</button>`;
}

function drawAll(): void {
  if (!state.body) return;
  drawLayout();
  drawLane();
  drawChooser();
  drawWingsAligned();
  drawSheet();
  drawCard();
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
  // a finger has no rest, so a press would raise a tooltip nobody asked for; what a touch reading tells, it tells in
  // the callout on the rail and in the card at the foot
  if (touch) return;
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
  const fig = el.closest("svg.fig, .tree, .keys, .settings, .history");
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
  quiet();
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
  // a going from a figure opened whole dismisses it: the jump is what the reader opened it for
  if (chooser.sheet !== null) {
    chooser.sheet = null;
    drawSheet();
    drawChooser();
  }
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
  quiet();
}

// ### 3.14.1 Pull past the top
//
// At the top of a scope, scrolling up beyond where the lane can go fills a
// gauge, and when it is full the reader is taken up a level, as some
// applications refresh when pulled past their top. A pull that stops drains.

/** How far a pull must go before it takes the reader up. */
const PULL = 300;
/** How much of a pull passes unseen, so the tail of a scroll that only just reached the top does not flash the gauge. */
const PULL_DEAD = 0.08;
let pulled = 0;
let pullTimer: ReturnType<typeof setTimeout> | undefined;
/** When the last wheel event came, and whether a push has been felt: momentum is an unbroken stream, a new swipe begins after a gap. */
let lastWheelAt = 0;
let pushing = false;
/** The gap in the stream that means a gesture has begun: momentum never pauses this long, and a finger touching the pad stops it dead. */
const PULL_GAP = 50;

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

// ### 3.14.2 The rail answers a finger
//
// A finger is only a fatter pointer, so the rail answers it as the shape
// answers a pointer, in a touch grain. The finger comes down and the lane is
// laid where it stands, live, so a reader sees what they are scrubbing past
// rather than a preview of it, and the callout says beside the thumb what
// stands there, on the side away from the edge, so the hand never covers the
// answer. Sliding away from the rail's own edge past a threshold arms a reset:
// the callout says so, and letting go there lays the lane back where it stood.
// Coming back onto the rail takes up the scrub again, so nothing is committed
// until the finger lifts. The reset is the undo the lane already keeps with a
// direction given to it: touching down records the lane, as every change does.

/** How far past the rail the thumb slides before letting go lays the lane back. */
const RESET = 60;
/** Whether the thumb has slid off the rail far enough that letting go would lay the lane back. */
let armed = false;

/**
 * Lays the lane at the point of the rail the finger is on, since that point is the place the reader is asking to see.
 * It is a preview while the finger is down: the lane follows it, the callout names what is there, and letting go
 * leaves it. Sliding off past the threshold arms the reset instead, and the lane is left where it is until the finger
 * lifts, which then lays it back.
 */
function railScrub(x: number, y: number): void {
  const svg = ui.parts[fits().railSide].querySelector<SVGSVGElement>("svg.shape");
  if (!svg) return;
  const r = svg.getBoundingClientRect();
  // away from the rail's own edge: right of a rail at the left, left of one at the right
  const right = fits().railSide === "wingL";
  armed = right ? x > r.right + RESET : x < r.left - RESET;
  if (!armed) {
    const k = Number(svg.dataset.k);
    ui.scroll.scrollTop = (y - r.top - 4) / k - ui.scroll.clientHeight / 2;
  }
  railCallout(y, right ? r.right : r.left);
}

/** The callout: what the finger is over, drawn as the tooltip draws a brief, or what letting go will do once the reset is armed. */
function railCallout(y: number, edge: number): void {
  const t = ui.tip;
  const b = brief(focusUnderLine());
  t.classList.add("callout");
  t.innerHTML = armed ? `<span class="name plain">let go to lay the lane back</span>` : b ? `${pathHtml(b.address)}<span class="name">${esc(b.title || state.body!.title)}</span>` : "";
  t.hidden = false;
  // beside the thumb on the side away from the edge the rail stands on, so the hand never covers the answer
  t.style.left = `${Math.round(fits().railSide === "wingL" ? edge + 14 : edge - 14 - t.offsetWidth)}px`;
  t.style.top = `${Math.round(clamp(y - t.offsetHeight / 2, 8, innerHeight - t.offsetHeight - 8))}px`;
}

/** How far a reader scrolls down in one run before the mark gets out of the way, and how far back up before it returns. */
const AWAY = { down: 140, up: 40 };
/** Where the lane stood at the last scroll, and how far the scrolling has run in one direction. */
const scrolled = { at: 0, run: 0 };

/**
 * The mark at the foot gets out of the way as a reader reads: it hides on a sustained scroll down and comes back on a
 * scroll up. A run in one direction is what counts, never a single delta, since the pull already reads the scroll's
 * direction at the top and the two must not fight.
 */
/** A scroll the page made is not the reader reading, so it neither hides the row nor counts towards hiding it. */
function quiet(): void {
  scrolled.at = ui.scroll.scrollTop;
  scrolled.run = 0;
  ui.strips.classList.remove("away");
}

function markAway(): void {
  const top = ui.scroll.scrollTop;
  const d = top - scrolled.at;
  scrolled.at = top;
  if (d === 0) return;
  scrolled.run = Math.sign(scrolled.run) === Math.sign(d) ? scrolled.run + d : d;
  // the mark leaves while a reader is reading; on the canvas there is no reading to leave, and going to a node scrolls
  // the lane out of sight, which would have taken the mark with it
  if (!narrow() || !fits().lane) return void ui.strips.classList.remove("away");
  if (scrolled.run > AWAY.down) ui.strips.classList.add("away");
  else if (scrolled.run < -AWAY.up) ui.strips.classList.remove("away");
}

/** Where the pointer last moved, and whether a scroll has come under it since. */
const pointer = { x: -1, y: -1, still: false };

/** Scrolling moves the focus and nothing else; the address follows without entering the history. */
function onScroll(): void {
  // a scroll takes the tooltip away, except the callout, which is the finger's own answer to the scrubbing it caused
  if (!ui.tip.classList.contains("callout")) hideTip();
  markAway();
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
  // the way down says where the reader stands, so it follows the reading
  drawCrumb();
  // on the canvas the focus is the brief the reader chose, and the foot carries its acts, so the row follows it
  if (narrow() && !fits().lane) drawChooser();
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
      if (act && act.can(badge.dataset.a)) act.run(badge.dataset.a);
      // an act taken from the foot changes what the foot has left to offer, and nothing else would draw it again
      return void (badge.closest(".strip") && drawChooser());
    }
    // on the canvas a row goes, and where there is no room to read it, it also raises the card that says what it holds
    const crow = t.closest<HTMLElement>(".crow");
    if (crow) {
      if (state.scrubbing || crow.classList.contains("root")) return;
      const a = crow.dataset.a!;
      if (narrow() && !fits().lane) card.a = a;
      goTo(a);
      drawCard();
      return void drawChooser();
    }
    const pc = t.closest<HTMLElement>(".pc[data-a]");
    if (pc) return void goTo(pc.dataset.a!);
    // a press on the canvas that is not a row lets the card go, as pressing away from a thing lets it go anywhere
    if (t.closest("#canvas") && !t.closest("#card") && card.a !== null && !state.scrubbing) dropCard();
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
      const k = pick.dataset.widget!;
      if (narrow()) return void chooseNarrow(k);
      if (!offered(k)) return;
      state.settings.areas = cycled(k);
      saveSettings();
      return void drawAll();
    }
    // a commit's row in the history figure takes the commit brief's own act
    const back = t.closest<HTMLElement>("[data-back]");
    if (back) return void ACTIONS.backTo.run(back.closest<HTMLElement>("[data-a]")?.dataset.a);
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
  let drag: { kind: "knob" | "shape" | "rail" | "canvas" | "card"; el: HTMLElement; x: number; y: number; start: number; vx?: number; vy?: number; moved: boolean } | null = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const knob = (e.target as HTMLElement).closest<HTMLElement>("[data-knob]");
    const held = (e.target as HTMLElement).closest<HTMLElement>("#card");
    const map = (e.target as HTMLElement).closest<HTMLElement>("svg.shape");
    const cv = (e.target as HTMLElement).closest("#depth") ? null : (e.target as HTMLElement).closest<HTMLElement>("#canvas");
    if (held && !(e.target as HTMLElement).closest("[data-act]")) drag = { kind: "card", el: held, x: e.clientX, y: e.clientY, start: card.h, moved: false };
    else if (knob) drag = { kind: "knob", el: knob, x: e.clientX, y: e.clientY, start: state.settings[knob.dataset.knob as Knob["key"]], moved: false };
    // on the rail the point the finger is on is the place the reader is asking to see, so the lane goes there at once
    // and the callout, beside the thumb, names it; the lane as it stood is recorded so the reset can lay it back
    else if (map && onRail() && touch) {
      e.preventDefault();
      record();
      drag = { kind: "rail", el: map, x: e.clientX, y: e.clientY, start: ui.scroll.scrollTop, moved: true };
      state.scrubbing = true;
      document.body.classList.add("scrubbing");
      railScrub(e.clientX, e.clientY);
    } else if (map) drag = { kind: "shape", el: map, x: e.clientX, y: e.clientY, start: ui.scroll.scrollTop, moved: false };
    else if (cv) drag = { kind: "canvas", el: cv, x: e.clientX, y: e.clientY, start: 0, vx: view.x, vy: view.y, moved: false };
    if (drag) (e.target as Element).setPointerCapture?.(e.pointerId);
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (drag.kind === "rail") return void railScrub(e.clientX, e.clientY);
    // the card takes the whole of the movement: it grows until it is as tall as it may stand, and what is left over
    // scrolls its prose; going the other way the prose comes back first and then the card comes down
    if (drag.kind === "card") {
      const hold = ui.card.querySelector<HTMLElement>(".hold");
      const up = drag.y - e.clientY;
      drag.y = e.clientY;
      if (Math.abs(up) > 1) drag.moved = true;
      if (up > 0) {
        const grow = Math.min(up, Math.max(0, cardMost() - card.h));
        card.h += grow;
        if (hold) hold.scrollTop += up - grow;
      } else {
        const back = Math.min(-up, hold?.scrollTop ?? 0);
        if (hold) hold.scrollTop -= back;
        card.h = Math.max(0, card.h - (-up - back));
      }
      ui.card.style.height = `${Math.round(card.h)}px`;
      return;
    }
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
      drag.el.classList.add("turning");
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
    // let down past the least it is held at, the card goes, with what was chosen; anywhere else it stays where the
    // finger left it, since the reader put it there
    if (drag?.kind === "card") {
      if (card.h < CARD.least) dropCard();
      else drawCard();
    }
    if (drag?.kind === "knob") drag.el.classList.remove("turning");
    if (drag?.kind === "knob" && drag.moved) (saveSettings(), drawChooser(), drawWingsAligned());
    if (drag?.kind === "rail") {
      document.body.classList.remove("scrubbing");
      ui.tip.classList.remove("callout");
      hideTip();
      if (armed) undo();
      // a scrub drags the pointer across the prose, and the browser takes that for a selection
      getSelection?.()?.removeAllRanges();
      armed = false;
    }
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

  // a machine may hold both a pointer and a screen, so the first touch settles which the reader is using and the page
  // is drawn again in that grain: the badges lose their caps, the presses gain their room
  window.addEventListener(
    "touchstart",
    () => {
      if (touch) return;
      touch = true;
      document.body.classList.add("touch");
      drawAll();
    },
    { passive: true },
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
    drawChooser();
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
      <div id="sheet" hidden></div>
      <div id="card" hidden></div>
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
    sheet: $("#sheet"),
    card: $("#card"),
    strips: $("#strips"),
    parts: { wingL: $('[data-area="wingL"]'), gutterL: $('[data-area="gutterL"]'), middle: $("#scroll"), gutterR: $('[data-area="gutterR"]'), wingR: $('[data-area="wingR"]') },
  };
  document.body.classList.toggle("touch", touch);
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
 * the branch hue reads it from --h, so it is set on every element and follows the branch the element stands under; its
 * chroma is scaled by --c, one unless an element sets it to nothing, which is how a brief goes grey at its own lightness
 * when the reading is of history and no commit asked for changed it. What is folded or out of the lane takes a breath of
 * the hue, so a folded cell still says which branch or which commit it is; grey itself is left to the sketches. A sketch
 * imports this and falls back to the light side where no page supplies the roles.
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
  rest: ["oklch(88% calc(0.045 * var(--c, 1)) var(--h))", "oklch(35% calc(0.04 * var(--c, 1)) var(--h))"],
  door: ["oklch(74% calc(0.085 * var(--c, 1)) var(--h))", "oklch(54% calc(0.07 * var(--c, 1)) var(--h))"],
  on: ["oklch(42% calc(0.072 * var(--c, 1)) var(--h))", "oklch(84% calc(0.055 * var(--c, 1)) var(--h))"],
  lit: ["oklch(60% calc(0.12 * var(--c, 1)) var(--h))", "oklch(74% calc(0.1 * var(--c, 1)) var(--h))"],
  glow: ["oklch(80% calc(0.08 * var(--c, 1)) var(--h))", "oklch(47% calc(0.06 * var(--c, 1)) var(--h))"],
  grey: ["oklch(90% 0 0)", "oklch(32% 0 0)"],
  folded: ["oklch(90% calc(0.035 * var(--c, 1)) var(--h))", "oklch(32% calc(0.035 * var(--c, 1)) var(--h))"],
  hub: ["oklch(92% 0.01 60)", "oklch(27% 0.01 60)"],
  glass: ["oklch(97.5% 0.002 60 / .82)", "oklch(26% 0.006 60 / .8)"],
  sheer: ["oklch(97.5% 0.002 60 / .6)", "oklch(26% 0.006 60 / .58)"],
  bezel: ["rgb(255 255 255 / .9)", "rgb(255 255 255 / .12)"],
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
/* a browser paints its own grey over what a finger taps, and it lingers over whatever the press then draws */
html { -webkit-tap-highlight-color: transparent; }
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
#crumb .step.root { flex: none; color: var(--muted); }
/* the last step is where the reader stands, so it is the one that is not faint */
#crumb .step.now { flex: none; color: var(--ink); cursor: default; }
#crumb .step.now.lit { color: var(--on); }
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
/* taking the page whole it keeps no rim and no corners, and fades at its ends as the prose does; its sides are cut by
   the viewport, since a map is read by moving it rather than by seeing all of it at once */
#canvas.bleed { border-radius: 0; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--edge), #000 calc(100% - var(--edge)), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 var(--edge), #000 calc(100% - var(--edge)), transparent 100%); }
#canvas.bleed::after { display: none; }
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
.crow .marks .tail { display: block; width: var(--w); height: 3px; border-radius: 1.5px; background: var(--folded); }
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

#strips { position: absolute; left: 0; right: 0; bottom: 0; height: 0; z-index: 8; pointer-events: none; }
/* one row, centred at the foot, holding every choice once: the panes, the adjuncts, the figures, three groups spaced
   apart by nothing but room. Four grades of ink: what cannot stand, what can, what is under the pointer, what is in use */
.strip { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; pointer-events: auto; }
.strip .group { display: flex; gap: 7px; }
.strip .group + .group { margin-left: 20px; }
.strip .pick { position: relative; width: 30px; height: 24px; display: grid; place-items: center; border-radius: 6px; color: var(--ink); opacity: .2; transition: opacity .15s, color .15s; }
/* the whole row lifts a little while the pointer is on it, so what cannot be had is still seen when a reader looks */
.strip:hover .pick { opacity: .34; }
.strip .pick.off, .strip .pick.off:hover { opacity: .1; cursor: default; }
.strip:hover .pick.off { opacity: .17; }
.strip .pick:hover { opacity: .6; }
.strip .pick.on, .strip:hover .pick.on { opacity: .9; color: var(--muted); }
/* asked for, but the width denies it: it stands between what is in use and what is not */
.strip .pick.on.denied, .strip:hover .pick.on.denied { opacity: .45; }
.strip .pick.on:hover { color: var(--ink); }
.strip .pick.fixed { cursor: default; }
/* a widget in use says which side holds it, as a dot beside its icon, level with the middle of it so it balances the
   round forms the icons are made of. It is the icon's own ink, three pixels across and three clear of the glyph */
.strip .pick.side-l::after, .strip .pick.side-r::after { content: ""; position: absolute; top: 50%; transform: translateY(-50%); width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
.strip .pick.side-l::after { left: 1px; }
.strip .pick.side-r::after { right: 1px; }
.icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }

.opening { margin-bottom: 40px; }
.opening h1 { font-family: var(--head-face); font-size: var(--t); font-weight: calc(600 - var(--thin)); line-height: 1.12; letter-spacing: calc(-.014em * var(--head-tight)); margin: 6px 0 .56em; }
.record { margin: 4px 0 24px; }

.brief { position: relative; margin: 0; padding-bottom: var(--after, 36px); opacity: calc(1 - var(--dim)); transition: opacity .3s; }
.brief.here { opacity: 1; }
.surface p { margin-bottom: 12px; }
.act { display: flex; align-items: center; gap: 10px; color: var(--ink); cursor: pointer; margin: -4px -8px 0; padding: 4px 8px; border-radius: 6px; transition: color .15s; }
.act:hover { color: var(--on); }
/* the badge: the key drawn as a cap, and what it does beside it. Its room is kept on every line, and it inks only on
   the brief the reading line stands on, which is the brief a key acts on, so nothing reflows as the reader moves */
.badge { display: inline-flex; align-items: center; gap: 6px; }
/* beside a brief a badge carries two caps in the same room: the key, on the brief the reading line stands on, since
   that is the brief a key acts on, and the pointer on every other, where a press is the only way to it */
.badge.aimed .cap.key { display: none; }
.brief.here .badge.aimed .cap.key { display: grid; }
.brief.here .badge.aimed .cap.pointer { display: none; }
.badge .chord { display: inline-flex; gap: 2px; }
/* the acts stand together at the right of the line, so the figures of every line begin at one edge */
.act .acts { display: inline-flex; align-items: center; gap: 12px; margin-left: 2px; }
.cap { width: 18px; height: 16px; display: grid; place-items: center; border-radius: 4px; background: var(--wash); color: var(--muted); transition: background .15s, color .15s; }
.cap svg { width: 12px; height: 12px; transform: none; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.badge .label { color: var(--ink); }
.act:hover .badge .cap, .badge:hover .cap { background: var(--track); color: var(--ink); }
.badge:hover .label { color: var(--on); }
/* a badge that cannot be taken keeps its room and goes quiet */
.badge.off { opacity: .35; pointer-events: none; }
/* an act that holds a state is marked while it does */
.badge.on .cap { background: var(--track); color: var(--ink); }
.badge.on .label { color: var(--on); }
.badge .held { color: var(--faint); font-size: 11px; }
/* the keys: the whole table in a wing, grouped by what each act works on, its caps always inked */
/* the history: a row per commit, the swatch its hue or grey, the subject cut to what the row leaves */
.history { width: 264px; display: flex; flex-direction: column; gap: 1px; font-family: var(--sans); font-size: var(--small); line-height: 1.35; color: var(--muted); }
.history .none { display: block; padding: 0 8px; }
.history .commit { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 3px 8px; border-radius: 6px; transition: background .15s; }
.history .commit:hover, .history .commit.lit { background: var(--wash); }
.history .commit.on { background: var(--wash); color: var(--ink); }
.history .when { flex: none; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
.history .swatch { flex: none; width: 9px; height: 9px; border-radius: 3px; background: var(--lit); }
.history .hash { flex: none; font-family: var(--mono); font-size: 11px; color: var(--faint); }
.history .commit.in .hash, .history .when:hover .hash { color: var(--on); }
.history .date { flex: none; color: var(--faint); font-size: 11px; }
.history .name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.history .commit.here .name, .history .commit.lit .name { color: var(--on); }
/* a block a commit within the reading touched: a wash behind it and a rule at its left in that commit's hue, the text kept ink */
.aged { position: relative; }
.aged > * { background: var(--rest); box-shadow: 0 0 0 6px var(--rest); border-radius: 2px; }
.aged::before { content: ""; position: absolute; left: -14px; top: 0; bottom: 0; width: 2px; border-radius: 1px; background: var(--door); }
.keys { width: 216px; display: flex; flex-direction: column; gap: 14px; font-family: var(--sans); font-size: var(--small); }
.keys .group { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
.keys .of { margin-bottom: 1px; }
.keys .badge { cursor: pointer; }
/* the caps are right-aligned in a fixed room, so every label in the column begins at one edge and the key nearest the
   word is always the one that names the act */
.keys .badge .chord { width: 40px; justify-content: flex-end; }
.keys .badge .cap { visibility: visible; }
.keys .badge:hover .cap { background: var(--track); color: var(--ink); }
/* on a strip the badge is its keys alone; two acts that share a modifier stand as one unit, the modifier drawn once */
.pair { display: inline-flex; align-items: center; gap: 1px; }
.pair .cap.lead { margin-right: 1px; }
#depth .badge, .pair .badge { cursor: pointer; }
#depth .pair { margin-left: 8px; }
#depth .cap, #crumb .cap { width: 18px; height: 18px; border-radius: 5px; background: none; }
#depth .cap svg, #crumb .cap svg { width: 13px; height: 13px; }
#depth .badge:hover .cap, #crumb .badge:hover .cap { background: var(--track); color: var(--ink); }
/* widening the scope stands at the right of the placement, which is the run it acts on; undoing stands past the trail,
   which is the record of what it takes back */
#crumb .place .badge { margin-left: 6px; }
#crumb > .badge { flex: none; margin-left: 10px; }
/* the figure on the line: the paragraphs a press gives, then the level that waits beyond them */
svg.fig.marks { flex: none; overflow: visible; }
svg.fig.marks .para { fill: var(--rest); }
svg.fig.marks .image { fill: none; stroke: var(--rest); stroke-width: 1.1; }
svg.fig.marks .head { fill: var(--door); }
svg.fig.marks .hidden { fill: var(--folded); }
svg.fig.marks .more { fill: var(--faint); font-family: var(--sans); font-size: 10px; }
.act:hover svg.fig.marks .para, .act:hover svg.fig.marks .head { fill: var(--lit); }
.act:hover svg.fig.marks .image { stroke: var(--lit); }
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
svg.ahead .hidden { fill: var(--folded); }
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
svg.shape .above .head { fill: var(--folded); }
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
svg.shape .tick { fill: var(--folded); }
svg.shape .tick.image { fill: none; stroke: var(--folded); stroke-width: 1; }
svg.shape .cell:has(.hit[data-press="fold"]:hover) .tick.image:not(.ghost) { fill: none; stroke: var(--lit); }
svg.shape .cell:has(.hit[data-press="fold"]:hover) .image { stroke: var(--door); }
svg.shape .cell.here:has(.hit[data-press="fold"]:hover) .image { stroke: var(--on); }
svg.shape .hidden { fill: var(--folded); }
svg.shape .cell.lit .hidden { fill: var(--glow); }
svg.shape .cursor { fill: var(--veil); pointer-events: none; }
/* under a finger the rail is taken hold of rather than aimed at, so the band the reader holds says so: a stronger fill
   with a rim around it, and a step darker while the finger is down */
body.touch svg.shape .cursor { fill: var(--wash); stroke: var(--track); stroke-width: 1; rx: 5; }
body.touch.scrubbing svg.shape .cursor { fill: var(--track); }
/* a scrub drags across the prose, and a drag over text is a selection unless the page says otherwise */
body.scrubbing, body.scrubbing #lane { user-select: none; -webkit-user-select: none; }
svg.shape { cursor: grab; }

svg.plate .cell path, svg.plate .cell circle { fill: var(--rest); }
svg.plate .cell.centre circle { fill: var(--hub); }
svg.plate .cell.on path { fill: var(--door); }
svg.plate .cell.here path { fill: var(--on); }
/* grey for anything not in the lane wins over the marks above, at every depth */
svg.plate .cell.away path { fill: var(--folded); }
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
/* a finger covers the knob it turns, so the value stands above it while it is turning, where the hand is not */
body.touch .knob .hint { top: auto; bottom: 100%; margin: 0 0 6px; }
body.touch .knob.turning .hint { opacity: 1; }
.switches { display: grid; grid-template-columns: auto auto; gap: 2px 8px; align-items: center; }
.switches .name { justify-self: end; color: var(--faint); }
.switches .values { display: flex; gap: 2px; }
.switches .pick { padding: 2px 5px; border-radius: 6px; color: var(--muted); }
.switches .pick.on { color: var(--ink); }
.switches .pick:hover { background: var(--wash); }

/* where the lane stands alone the row folds into one round mark at the foot, and a press opens it as a wide pill: the
   same table in a second grain. Both stand on a glass of their own, a muted surface over whatever the prose is doing
   beneath, with a light rim and a soft shadow, since a translucent grey alone read as a fade rather than as a thing */
#strips { transition: transform .42s cubic-bezier(.22,.9,.24,1), opacity .3s ease; }
#strips.away { transform: translateY(150%) scale(.92); opacity: 0; }
/* the foot is one row: what stands in it follows what the reader has chosen, with the mark always at its end */
.strip.foot { bottom: 22px; gap: 8px; }
/* two glasses, and the difference is deliberate: what a reader opened stands on the solid one, since they are looking
   at it; the mark, which stands there the whole time they read, is sheerer and quieter */
.glass { background: var(--glass); border: 1px solid var(--bezel); box-shadow: 0 1px 2px rgb(0 0 0 / .05), 0 10px 28px rgb(0 0 0 / .12); backdrop-filter: blur(28px) saturate(1.8); -webkit-backdrop-filter: blur(28px) saturate(1.8); }
.strip .mark.glass { background: var(--sheer); backdrop-filter: blur(16px) saturate(1.5); -webkit-backdrop-filter: blur(16px) saturate(1.5); }
/* the fold chevron in a tree is also called a mark and stands absolutely, so this one says where it stands: left to
   itself it hung out of the strip, which is what put it off centre and below the foot */
.strip .mark { position: relative; flex: none; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; color: var(--muted); transition: color .15s, transform .2s; }
.strip .mark:active { transform: scale(.94); }
.strip .mark:hover { color: var(--ink); }
.strip .mark .icon { width: 19px; height: 19px; stroke-width: 1.2; }
.strip .pill { display: flex; align-items: center; border-radius: 26px; padding: 3px; gap: 2px; animation: pill-in .26s cubic-bezier(.2,.9,.3,1); }
@keyframes pill-in { from { opacity: 0; transform: translateY(10px) scale(.92); } }
.strip .pill .pick { width: 40px; height: 40px; border-radius: 20px; opacity: .5; }
.strip .pill .pick.on, .strip .pill:hover .pick.on { opacity: 1; color: var(--ink); background: var(--wash); }
.strip .pill .pick:hover { opacity: .8; }
.strip .pill .pick .icon { width: 18px; height: 18px; }
/* an act in the row is a glyph in the same round button a choice stands in, and inks as one in use does */
.strip .pill .pick[data-act] { opacity: .85; color: var(--ink); }
.strip .pill .pick[data-act]:active { background: var(--wash); }

/* the card at the foot: what the reader chose on the canvas, told as the lane tells it, on the same glass the foot
   stands on. It is anchored to the foot and grows upward, and the row of acts stands over the room it keeps beneath */
#card { position: absolute; left: 0; right: 0; bottom: 0; z-index: 4; overflow: hidden; border-radius: 18px 18px 0 0; touch-action: none; }
#card .hold { height: 100%; overflow: hidden; padding: 16px var(--gap) 80px; }
#card .said { font-family: var(--sans); }
#card .path { display: block; margin-bottom: 2px; }
#card h3 { margin: 0 0 6px; font-family: var(--head-face); font-size: var(--h4); font-weight: calc(600 - var(--thin)); line-height: 1.2; color: var(--ink); }
#card .surface, #card p { font-family: var(--prose-face); font-size: calc(var(--body) * .94); line-height: 1.5; color: var(--muted); margin: 0 0 10px; }
/* a hairline at the top says the card is a thing that can be drawn up, without a handle standing for it */
#card::before { content: ""; position: absolute; top: 7px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 2px; background: var(--track); }

/* a figure opened whole over the reading, where there is no wing to stand it in: it takes the band the prose reads in,
   on the page's own ground, and the reading stands where it stood beneath it */
#sheet { position: absolute; left: 0; right: 0; z-index: 3; background: var(--ground); display: flex; justify-content: center; }
#sheet .slot { position: static; width: 100%; height: 100%; padding: 0 var(--gap); }
/* taking the page whole it keeps the foot's room clear beneath, since the row of choices stands over it */
#sheet.bleed { z-index: 6; }
#sheet.bleed .slot { padding-bottom: 88px; }

/* A touch reading. A finger is a fatter pointer, so everything it presses is given room it can find, near the forty-four
   pixels a hand asks for; a badge carries its word alone, in a target of its own; and nothing waits on hovering */
body.touch .tree .row { padding-top: 9px; padding-bottom: 9px; }
/* the chevron that folds a row is the one small target in the outline, so a finger is given the room around it */
body.touch .tree .row .mark { width: 30px; height: 34px; top: 0; left: calc(-5px + var(--d) * 14px); }
body.touch .switches .pick { padding: 9px 8px; }
/* the depth strip is scrubbed rather than aimed at, so its cells grow for a finger without taking the whole line */
body.touch #depth { gap: 4px; }
body.touch #depth .dc { width: 28px; height: 28px; font-size: 12px; }
/* the rail and the canvas take their gestures whole, so the page does not scroll under a finger that is scrubbing the
   one or panning the other */
svg.shape, #canvas { touch-action: none; }
/* the tooltip in a touch grain: the callout beside the thumb, on the side away from the edge the rail stands on */
#tip.callout { max-width: 210px; padding: 9px 12px 10px; }
body.touch .act { min-height: 44px; padding: 8px; margin: -4px -8px 0; }
body.touch .act .acts { gap: 2px; margin-right: -10px; }
/* a press with no key to draw is a word alone, so under a finger it is given a surface and reads as the button it is */
body.touch .badge.worded { padding: 9px 13px; border-radius: 9px; background: var(--wash); }
body.touch .badge.worded .label { color: var(--ink); }
body.touch .badge.worded.off { background: none; }
/* and the acts take a row of their own beneath the figure, since sharing the line with it left neither room to read */
body.touch .act { flex-wrap: wrap; row-gap: 9px; padding-bottom: 12px; }
body.touch .act .acts { flex-basis: 100%; margin-left: 0; gap: 10px; }
body.touch .badge.worded .label { color: var(--muted); }
body.touch #crumb { gap: 2px; }
body.touch #crumb .step { padding: 10px 5px; }
body.touch #crumb .place { gap: 2px; }
`;

// The run, last, so that everything it calls stands above it.
if (import.meta.main) run();
