---
under: the rule
kind: brief
status: open
---

# History

History is how the knowledge came to be what it is where a reader stands: which commits touched it, and the stories told over them. Git's history is read as a holarchy of its own, with the stories as its briefs and the commits as the leaves beneath them.

Its data is built; the trace of its stories and its drawing on the page are not, and nothing of it is yet seen on the page. [What comes next](#6-what-comes-next) says in what order.

*Preferred, the author's design, settled in discussion with the session 2026-09-21; the data as built the same day, and the rest open.*

## 1. Why it is laid again

Git was given to the surface once already, on 2026-09-17, and [taken out the same evening](../../ideas/history.md): it slowed every request for the body, it laid the commits into the body as a level nobody wrote, and sixty commits in a list helped nobody understand what changed.

So this time nothing of git enters the body, and the data comes before any view, built to what the view will need.

*Seen, 2026-09-17; the author's direction of 2026-09-21: [the foundation laid properly this time](../../author/ideas-2026-09-21.md#1-the-foundation-is-laid-properly-this-time).*

### 1.1 The body is measured before and after

Around anything of this that is built, the time the live process takes to hand the page its body and the weight of the built page are measured before and after. Neither may move.

*In force, from [the history of the first attempt](../../ideas/history.md#2-why-it-came-out); the author's rule since 2026-09-17. Measured around both tiers of [the data](#5-the-data-in-two-tiers), 2026-09-21: the body stood at 0.71 to 0.75 seconds throughout, and the page's script did not change by a byte.*

## 2. The history is a holarchy

Commits are one level, and the low one, and gathering them under a git branch leaves them at that level. What raises them is prose: a story tells what a run of commits did together, a larger story holds smaller ones, and the commits are the leaves at the foot of it all.

So the history is drawn as any reading is, and only its leaves are a kind of their own.

*Preferred, the author's, 2026-09-21: [commits are one level](../../author/ideas-2026-09-21.md#10-commits-are-one-level-and-the-low-one) and [a substrate for commits](../../author/ideas-2026-09-21.md#11-a-substrate-for-commits); that it is a holon with a holarchy is his of the same day.*

### 2.1 It stands at the root, and is never placed in the body

The stories live beside the entry of the root the surface is handed, as `history.md` first, and as a folder `history/` once one reading no longer holds them, as any file becomes one. Nothing places the file in the body, and the surface knows it by where it stands: it is traced only when the history is opened. The file is stamped as a record, [beneath](#24-it-is-a-record-whose-entries-are-holons).

The history there is the root's own: the commits that touched what lies under the root, which for this repository is the whole of it.

*Preferred, the author's, 2026-09-21; the file first on the session's proposal, taken; the root's own history, rather than the repository's, the session's from a fresh head, as the data was built.*

### 2.2 A story places its commits

A story is a brief of that file, a heading and its prose, and a larger story holds smaller ones as briefs beneath it, as any brief holds its level. A story names its commits by [placing them](../practice.md#37-a-lone-link-to-a-commit-places-it-in-the-history), each lone link standing a commit or a run of them there as leaves.

So the author can talk about the last three commits, a session adds a story of those three, and later a story of the last ten holds it, standing beside a story of the ten before.

A story's commits, all its links together, are one run: a sequence in the root's history with nothing left out between its first and its last. A larger story's run is its own commits and its smaller stories' together, and is one run as well. No two stories overlap: a story may hold a smaller story whole, which is nesting, never overlap. How an overlap would be drawn is not known, and until it is there is none.

*Preferred, the author's, 2026-09-21, the runs as [he told them](../../author/ideas-2026-09-21.md#12-stories-told-over-runs-of-commits); contiguous on the session's proposal, and no overlap his.*

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

A commit leaf is a brief like any other in what the surface holds of it, which is what lets [one code draw both](#3-one-code-for-both): a parent, which is the story that placed it, or the history's own brief for a commit no story tells yet; an address, which is its parent's with the commit's hash beneath it; and a title, which is its subject.

What it carries instead of prose is the briefs it touched, and a way to the lines it changed in [the heavy tier](#52-the-heavy-tier-is-had-a-commit-at-a-time).

A brief it touched is named by its path within its file, from the file's own title down, since where a file is placed in the body changes and the commit does not; the page finds the brief by joining that path to where the file's own brief stands in the body, in every place the file is placed, and a file the body does not reach is shown by its path alone.

Its face and its figure are the only things drawn for it alone. The face says the subject, the author and the date. The figure says what it touched, where a folded brief's figure says what it hides: a bar for every reading it touched, each in that reading's branch hue. A local commit is one bar, and one that reached many readings a row of hues, whether one purpose propagated or several were conflated; the story over it says which.

*Preferred, the author's, 2026-09-21; the face, the figure and the naming are the session's reading of it, and that a row of hues does not itself say conflated is a fresh head's, taken.*

### 2.4 It is a record whose entries are holons

The history's file is [a record whose entries are holons](../practice.md#21-the-stamp-says-the-kind): its order is time and not importance, the newest first, so now is what a reader meets, and [the lane reads a record so](lane.md#8-a-record-is-ordered-by-time). Each entry is a story with its level beneath it, and within a story the commits of a run stand newest first as well; where separate links place commits out of time's order, the trace warns.

Commits no story tells yet stand among the stories in the order of time, each where it happened, and a story takes their place once it is written. So nothing is missing before it has been told, and the untold, mostly the newest, stand where a reader looks first.

And it [never retires](../practice.md#22-a-record-retires-once-its-conclusion-is-in-the-briefs), as other records do.

*Preferred, the session's proposal taken by the author, 2026-09-21; that it never retires is the author's.*

### 2.5 A session writes the story as its debrief

A stretch of work ends with [its debrief](../../rule.md#55-the-debrief): the conclusion goes to the surface and the detail stays beneath. Over commits, the story is that conclusion and the commits are the detail, so a session writes the story of its own commits before it ends, and the author ratifies it or comments on it.

So the history is told as the work is done, not afterwards, and what [many small commits](../practice.md#13-a-commit-is-one-purpose) cost is answered here.

*Preferred, the session's proposal taken by the author, 2026-09-21; that bloat is solved by something else is [his](../../author/ideas-2026-09-21.md#8-bloat-is-valuable-information-and-is-solved-by-something-else).*

## 3. One code for both

The body and the history are the same structure, so the same code draws both: the canvas, the lane, selection, the keys and folding take a commit as they take a brief. A second code path for history would be a double standard, and every rule of the surface would then have to be kept twice.

*Preferred, the author's, 2026-09-21.*

## 4. What a reader sees

A reader sees the history from where they stand, what they select shows what it touched, and it is laid as any reading is.

*Preferred, the author's, 2026-09-21.*

### 4.1 Only the commits that touch where you stand

Opening the history from an address shows only the commits that touched it, and the stories that hold them. For a reading, that is read from the files each commit touched; for a brief selected within it, from the briefs each commit touched. A commit that touched several readings is among the commits of each.

The filter is as true as the commits are, which is why [a commit is one purpose](../practice.md#13-a-commit-is-one-purpose).

*Preferred, the author's, 2026-09-21: [the address shows only the commits that affect it](../../author/ideas-2026-09-21.md#16-the-address-shows-only-the-commits-that-affect-it).*

#### 4.1.1 A story stands wherever any of its commits touched

A story tells a stretch of time, not a place, so it holds whatever its run holds. From an address it stands if any of its commits touched there, and the commits of it that did not touch there fold into a count of how many stand elsewhere, so the run still reads unbroken and the story is seen to reach further than where the reader stands.

*Preferred, the session's proposal taken by the author, 2026-09-21.*

### 4.2 A selection shows what it touched

Selecting a commit, or a story that holds ten, shows what it touched in three places: [the shape](widgets.md#3-the-shape) greys everything and colours what was touched; the map lights the touched briefs it holds as nodes to go to; and the lane, where the reading it holds is one the selection touched, shows the change in place there.

In place, the blocks that changed are marked and the rest is left as it is, and what was removed is shown only when asked; a finer marking may come later. Colour there says changed against unchanged, and no hue is given to a commit, since a hue already says which branch a thing stands under.

A change in place fetches from [the heavy tier](#52-the-heavy-tier-is-had-a-commit-at-a-time) exactly the commits it shows, one for a commit and ten for a story of ten, so what it asks is bounded by the story and never by the history.

*Preferred, the author's, 2026-09-21: [how a change affected the field](../../author/ideas-2026-09-21.md#9-how-a-change-affected-the-field) and [a selection shows the pieces affected](../../author/ideas-2026-09-21.md#15-a-selection-shows-the-pieces-affected); the first cut of the change in place and giving up a hue per commit are the session's proposals, taken; that a story's change in place fetches its commits one by one is the session's, from a fresh head finding it unsaid.*

### 4.3 History is drawn top-down, as any reading is

The history is drawn down the column, as any reading is, so the canvas stays one coherent picture. The author pictured it at first left to right with the commits along the bottom; a toggle between top-down and left-right belongs to the canvas as a whole, for every reading, and is a step of its own that history does not wait on.

*Preferred, the author's, 2026-09-21, turning from left to right for coherence in the canvas.*

## 5. The data, in two tiers

What a reader sees decides what is fetched. The canvas, the colouring and the filter by address span the whole history and need only which commits exist and what each touched; only a change shown in place needs the lines. So the data comes in two tiers: a light one had whole, and a heavy one had a commit at a time.

Locally both are read on demand, each commit once, and kept by its hash, which never goes stale since a commit never changes. Published, the pipeline writes them as files beside the page, since a static host answers no query.

*Preferred, the author's, 2026-09-21: [a shallow set and a deep set](../../author/ideas-2026-09-21.md#2-a-shallow-set-and-a-deep-set), [cached locally, files when published](../../author/ideas-2026-09-21.md#4-cached-locally-files-when-published); the split by what a view needs is the session's, on his asking whether a file per commit would bottleneck the canvas. As built the same day.*

### 5.1 The light tier is had whole

What a view needs of every commit at once is small, so it is had in one file, loaded once when the history is opened: every commit that touched the root, its hash, parents, author, date and subject, the files it changed with how many lines, code and images among them, and in a stamped file the briefs it touched.

The file is `history.json`, which shares a name with the stories' `history.md` and nothing else. Each root keeps a light tier of its own. It never stands inside the page, since it weighs a quarter of it.

*Measured, 2026-09-21, on 460 commits: 378 KB, 73 KB gzipped; read cold in 1.5 to 3.5 seconds and warm in 0.15 to 0.35. The headings are found by their lines rather than by lexing each version whole, which took 31 seconds, and the briefs so found match the trace's addresses in every stamped file.*

### 5.2 The heavy tier is had a commit at a time

The lines a commit changed in the stamped files, brief by brief, one file per commit at `commits/<hash>.json`, fetched only for [a change shown in place](#42-a-selection-shows-what-it-touched). A change that runs across a heading is cut there, each line going to the brief it stood in, and a change of nothing but blank lines is none.

Only the substrate is held. What a commit did to code or to images is counted in the light tier and not carried here, since the lane shows the prose in place and nothing else.

*Measured, 2026-09-21, on 460 commits: 3.6 MB together, 761 bytes at the median and 305 KB at the most; a commit read cold in 0.24 seconds and warm in 0.04.*

## 6. What comes next

The data stands, and what is next is laid in the order each step stands on the one before. A session taking this up begins at the first step not done.

1. Trace the history: read `history.md` when it is asked for, resolve its `git:` links against the light tier, make the commit leaves, stand the untold commits among the stories by time, and warn as [the link says](#221-the-link-names-a-commit-or-a-run). Tested alone, as the data was, before anything is drawn.

2. Write the first stories, over the commits that built the data, as [a session's debrief](#25-a-session-writes-the-story-as-its-debrief), so the trace has a real history to read.

3. Draw it: open the history on the canvas, top-down, with [only the commits that touch where the reader stands](#41-only-the-commits-that-touch-where-you-stand), after [how it is opened](#7-what-this-leaves-open) is settled with the author.

4. Show what a selection touched, on the shape, the map and in place in the lane, fetching [the heavy tier](#52-the-heavy-tier-is-had-a-commit-at-a-time) as a change in place asks.

*In force as the order, the session's, 2026-09-21, when the author paused the work after the data; none of the four is begun.*

## 7. What this leaves open

How overlapping stories would be drawn, and so whether stories may overlap at all, or group commits along more than one line at once, which [the author doubts we are ready for](../../author/ideas-2026-09-21.md#14-partition-or-many-directions).

Whether lines across more commits than a story holds are ever wanted at once; if they are, the heavy tier is packed in runs of fixed length, fifty to a file, so a finished run never changes and only the newest grows.

How a session tells its story where another session's commits fall between its own, since a run leaves nothing out and stories do not overlap.

How the history is opened: as a pane of its own, from the strip, or as what the canvas draws when asked.

Whether the map opens the way to a touched brief the reader has not opened, or lights only what it holds.

*Open, 2026-09-21; the rest raised that day was answered the same day, and [the granularity of a commit](../practice.md#13-a-commit-is-one-purpose) went to the practice.*
