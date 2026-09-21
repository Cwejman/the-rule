---
under: the rule
kind: brief
status: open
---

# History

History is how the knowledge came to be what it is where a reader stands: which commits touched it, and the stories told over them. Git's history is read as a holarchy of its own, with the stories as its briefs and the commits as the leaves beneath them.

Its data is built; the trace of its stories and its drawing on the page are not. What stands beneath is the design settled in talk, and the data built to answer what the view will ask of it.

*Preferred, the author's design, settled in discussion with the session 2026-09-21; the data as built the same day, and the rest open.*

## 1. Why it is laid again

Git was given to the surface once already, on 2026-09-17, and [taken out the same evening](../../ideas/history.md): it slowed every request for the body, it laid the commits into the body as a level nobody wrote, and sixty commits in a list helped nobody understand what changed.

So this time nothing of git enters the body, and the data comes before any view, built to what the view will need.

*Seen, 2026-09-17; the author's direction of 2026-09-21: [the foundation laid properly this time](../../author/ideas-2026-09-21.md#1-the-foundation-is-laid-properly-this-time).*

### 1.1 The body is measured before and after

Before anything of this is built, the time `/body` takes and the weight of the built page are measured, and after it they are measured again. Neither may move.

*In force, from [the history of the first attempt](../../ideas/history.md#2-why-it-came-out); the author's rule since 2026-09-17. Measured around both tiers of [the data](#5-the-data-in-two-tiers), 2026-09-21: `/body` stood at 0.71 to 0.75 seconds throughout, and the page's script did not change by a byte.*

## 2. The history is a holarchy

Commits are one level, and the low one, and gathering them in a git branch does not lift them. What lifts them is prose: a story tells what a run of commits did together, a larger story holds smaller ones, and the commits are the leaves at the foot of it all.

So the history is a reading like any other, and only its leaves are a kind of their own.

*Preferred, the author's, 2026-09-21: [commits are one level](../../author/ideas-2026-09-21.md#10-commits-are-one-level-and-the-low-one) and [a substrate for commits](../../author/ideas-2026-09-21.md#11-a-substrate-for-commits); that it is a holon with a holarchy is his of the same day.*

### 2.1 It stands at the root of the repository, and is never placed

The stories live at the root of the repository, as `history.md` first, and as a folder `history/` once one reading no longer holds them, as any file becomes one. Nothing places them, and the surface knows the history by where it stands: it is traced only when the history is opened, never into the body, and the check does not list it as an orphan. The file is stamped as a record, [beneath](#24-it-is-a-record-whose-entries-are-holons).

*Preferred, the author's, 2026-09-21; the file first on the session's proposal, taken.*

### 2.2 A story places its commits

A story is a brief of that file, a heading and its prose, and a larger story holds smaller ones as briefs beneath it, as any brief holds its level. A story names its commits as [a lone link places a part](../practice.md#3-a-lone-link-places-a-part): a paragraph that is nothing but a link to a commit, or to a run of them, stands the commits there as leaves.

So the author can talk about the last three commits, a session adds a story of those three, and later a story of the last ten holds it beside a story of the ten before.

A run is a sequence, from one commit to another with nothing left out between, and no two stories overlap: a story may hold a smaller story whole, which is nesting, never overlap. How an overlap would be drawn is not known, and until it is there is none.

*Preferred, the author's, 2026-09-21, the runs as [he told them](../../author/ideas-2026-09-21.md#12-stories-told-over-runs-of-commits); contiguous on the session's proposal, and no overlap his, since nobody knows yet how to draw it.*

#### 2.2.1 The link names a commit or a run

The link's target is a commit's hash, or a run's first and last joined by two dots, after `git:`:

```markdown
[The keys belong to the map](git:d7a1138)

[The canvas spreads as a tree](git:152713e..b0b54e6)
```

A run holds both of its ends, where git's own two dots leave out the first. The target names no host, so it holds wherever the repository is read, in every project that takes it in as a submodule; on GitHub it reads as a link that goes nowhere, and the text still reads.

The trace resolves a short hash, and warns where one is ambiguous, where a run is not a sequence in the history, and where two stories overlap.

*Preferred, the session's proposal taken by the author, 2026-09-21; a compare address on GitHub was weighed and refused, since it ties the substrate to one host.*

### 2.3 A commit is a brief of its own kind

A commit leaf is a brief like any other in what the surface holds of it: an address, which is the story's with the commit's hash beneath it, a title, which is its subject, and a parent, the story that placed it. What it carries instead of prose is the briefs it touched, and a way to the lines it changed in [the heavy tier](#52-the-heavy-tier-is-had-a-commit-at-a-time).

A brief it touched is named by its path within its file, from the file's own title down, since where a file is placed in the body changes and the commit does not; the page finds the brief by joining that path to where the file's own brief stands in the body.

Its face and its figure are the only things drawn for it alone. The face says the subject, the author and the date; the figure says what it touched, where a folded brief's figure says what it hides.

*Preferred, the author's, 2026-09-21; the face, the figure and the naming are the session's reading of it.*

### 2.4 It is a record whose entries are holons

The history's file is [a record](../practice.md#21-the-stamp-says-the-kind): its order is time and not importance, the newest first, as a debrief keeps its entries, so now is what a reader meets, and [the lane reads a record so](lane.md#8-a-record-is-ordered-by-time). What sets it apart from other records is that each entry is a holon, a story with its level beneath it, and within a story the commits keep time too.

Commits no story tells yet stand among the stories in the order of time, each where it happened, and a story takes their place once it is written. So nothing is missing before it has been told, and the untold, mostly the newest, stand where a reader looks first.

And it [never retires](../practice.md#22-a-record-retires-once-its-conclusion-is-in-the-briefs), as other records do: a record retires once its conclusion stands in other briefs, and the history's conclusions are its own stories, so it is substrate for as long as the repository is.

*Preferred, the session's proposal taken by the author, 2026-09-21; that it never retires, since it is substrate, is the author's.*

### 2.5 A session writes the story as its debrief

A stretch of work ends with [its debrief](../../rule.md#55-the-debrief): the conclusion goes to the surface and the detail stays beneath. Over commits, the story is that conclusion and the commits are the detail, so a session writes the story of its own commits before it ends, and the author ratifies it or comments on it.

So the history is told as the work is done, not afterwards, and what [many small commits](../practice.md#13-a-commit-is-one-purpose) cost is answered here.

*Preferred, the session's proposal taken by the author, 2026-09-21; that bloat is solved by something else is [his](../../author/ideas-2026-09-21.md#8-bloat-is-valuable-information-and-is-solved-by-something-else).*

## 3. One code for both

The body and the history are the same structure, so the same code draws both: the canvas, the lane, selection, the keys and folding take a commit as they take a brief. A second code path for history would be a double standard, and every rule of the surface would then have to be kept twice.

*Preferred, the author's, 2026-09-21.*

## 4. What a reader sees

A reader sees the history from where they stand, and what they select shows what it touched.

*Preferred, the author's, 2026-09-21.*

### 4.1 Only the commits that touch where you stand

Opening the history from an address shows only the commits that touched it, and the stories that hold them. For a reading, that is read from the files each commit touched; for a brief selected within it, from the briefs each commit touched.

The filter is as true as the commits are, which is why [a commit is one purpose](../practice.md#13-a-commit-is-one-purpose).

*Preferred, the author's, 2026-09-21: [the address shows only the commits that affect it](../../author/ideas-2026-09-21.md#16-the-address-shows-only-the-commits-that-affect-it).*

#### 4.1.1 A commit across many readings shows it by its figure

A commit's figure draws a bar for every reading it touched, each in that reading's branch hue. A local commit is one bar, and one that reached many readings a row of hues, whether one purpose propagated or several were conflated; the story over it says which. Opened from any reading it touched, it is among that reading's commits.

*Preferred, the session's proposal taken by the author, 2026-09-21; that a row of hues does not itself say conflated is the fresh head's reading, taken by the session.*

#### 4.1.2 A story stands wherever any of its commits touched

A story tells a stretch of time, not a place, so it holds whatever its run holds. From an address it stands if any of its commits touched there, and the commits of it that did not fold into a count of how many stand elsewhere, so the run still reads unbroken and the story is seen to reach further than where the reader stands.

*Preferred, the session's proposal taken by the author, 2026-09-21.*

### 4.2 A selection shows what it touched

Selecting a commit, or a story that holds ten, shows what it touched in three places: [the shape](widgets.md#3-the-shape) greys everything and colours what was touched; the map lights the touched briefs as nodes to go to; and the lane shows the change in place.

In place, the first cut marks the blocks that changed and leaves the rest as it is, and what was removed is shown only when asked. Colour there says changed against unchanged, and no hue is given to a commit, since a hue already says which branch a thing stands under.

A change in place fetches exactly the commits it shows, one for a commit and ten for a story of ten, so what it asks is bounded by the story and never by the history.

*Preferred, the author's, 2026-09-21: [how a change affected the field](../../author/ideas-2026-09-21.md#9-how-a-change-affected-the-field) and [a selection shows the pieces affected](../../author/ideas-2026-09-21.md#15-a-selection-shows-the-pieces-affected); the first cut of the change in place and giving up a hue per commit are the session's proposals, taken; that a story's change in place fetches its commits one by one is the session's, from a fresh head finding it unsaid.*

### 4.3 History is drawn top-down, as any reading is

The history is drawn down the column, as any reading is, so the canvas stays one coherent picture. The author pictured it at first left to right with the commits along the bottom; a toggle between top-down and left-right belongs to the canvas as a whole, for every reading, and is a step of its own that history does not wait on.

*Preferred, the author's, 2026-09-21, turning from left to right for coherence in the canvas.*

## 5. The data, in two tiers

What a reader sees decides what is fetched. The canvas, the colouring and the filter by address span the whole history and need only which commits exist and what each touched; only a change shown in place needs the lines. So the data comes in two tiers: a light one had whole, and a heavy one had a commit at a time.

Locally both are read on demand and kept by the commit's hash, which never goes stale since a commit never changes. Published, the pipeline writes them as files beside the page, since a static host answers no query.

*Preferred, the author's, 2026-09-21: [a shallow set and a deep set](../../author/ideas-2026-09-21.md#2-a-shallow-set-and-a-deep-set), [cached locally, files when published](../../author/ideas-2026-09-21.md#4-cached-locally-files-when-published); the split by what a view needs is the session's, on his asking whether a file per commit would bottleneck the canvas. As built the same day.*

### 5.1 The light tier is had whole

What a view needs of every commit at once is small, so it is had in one file, loaded once when the history is opened: every commit that touched the root, its hash, parents, author, date and subject, the files it changed, and in a stamped file the briefs it touched.

The file is `history.json`, which shares a name with the stories' `history.md` and nothing else. The root is the path the surface is handed, and each root keeps its own. It never stands inside the page, since it weighs a quarter of it.

*Measured, 2026-09-21, on 460 commits: 378 KB, 73 KB gzipped; read cold in 1.5 to 3.5 seconds and warm in 0.15 to 0.35. The headings are found by their lines rather than by lexing each version whole, which took 31 seconds, and the briefs so found match the trace's addresses in every stamped file.*

### 5.2 The heavy tier is had a commit at a time

The lines a commit changed in the stamped files, brief by brief, one file per commit at `commits/<hash>.json`, fetched only when a reader opens that commit in the lane. A change that runs across a heading is cut there, each line going to the brief it stood in, and a change of nothing but blank lines is none.

Only the substrate is held. What a commit did to code or to images is counted in the light tier and not carried here, since the lane shows the prose in place and nothing else.

*Measured, 2026-09-21, on 460 commits: 3.6 MB together, 761 bytes at the median and 305 KB at the most; a commit read cold in 0.24 seconds and warm in 0.04.*

## 6. What this leaves open

How overlapping stories would be drawn, and so whether stories may overlap at all, or run in several directions, which [the author doubts we are ready for](../../author/ideas-2026-09-21.md#14-partition-or-many-directions).

Whether lines across more commits than a story holds are ever wanted at once; if they are, the heavy tier is packed in runs of fixed length, fifty to a file, so a finished run never changes and only the newest grows.

*Open, 2026-09-21; the rest raised that day was answered the same day, and [the granularity of a commit](../practice.md#13-a-commit-is-one-purpose) went to the practice.*
