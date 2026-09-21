---
under: the rule
kind: brief
status: open
---

# History

Git's history is read as a holarchy of its own: stories told over runs of commits, and the commits as the leaves beneath them. The canvas and the lane draw it as they draw any reading, and it is opened as a view apart, never mounted into the body.

Nothing of it is built. What stands beneath is the design settled in talk, laid before the data layer so that each tier is built to answer what the view asks of it.

*The author's, 2026-09-21, settled in discussion with the session; open, and nothing built.*

## 1. Why it is laid again, and how it differs

Git was given to the surface once already, on 2026-09-17, and [taken out the same evening](../../ideas/history.md): blaming every file on every retrace put seconds on each request for the body, the commits were laid into the body as a level nobody wrote, and sixty commits in a list helped nobody understand what changed.

This time the foundation comes first. Nothing of git enters the body, the trace or the check. The data is had in two tiers, the light one whole and the heavy one a commit at a time, and a commit's effect is read from its own diff mapped to the headings as they stood then, which [the first attempt found](../../ideas/history.md#3-what-holds) exact where blame is not.

*The author's, 2026-09-21: [the foundation laid properly this time](../../author/ideas-2026-09-21.md#1-the-foundation-is-laid-properly-this-time).*

## 2. The history is a holarchy

Commits are one level, and the low one, and grouping them in a branch does not lift them. What lifts them is prose: a story brief tells what a run of commits did together, a larger story holds smaller ones, and the commits are the leaves at the foot of it all.

So the history is a reading like any other, and only its leaves are a kind of their own.

*The author's, 2026-09-21: [commits are one level](../../author/ideas-2026-09-21.md#10-commits-are-one-level-and-the-low-one) and [a substrate for commits](../../author/ideas-2026-09-21.md#11-a-substrate-for-commits); that it is a holon with a holarchy, and one code for both, is his of the same day.*

### 2.1 A story places its commits

A story names the commits it tells as [a lone link places a part](../practice.md#3-a-lone-link-places-a-part): a paragraph that is nothing but a link to a commit, or to a run of them, stands the commits there as leaves. So the author can talk about the last three commits, a session adds a story of those three, and later a story of the last ten holds it beside a story of the ten before.

A run is a sequence, from one commit to another with nothing left out between, and no two stories overlap: a story may hold a smaller story whole, and that is nesting, never overlap. So stories nest cleanly and draw as layers. How an overlap would be drawn is not known, and until it is there is none.

*The author's, 2026-09-21, the runs as [he told them](../../author/ideas-2026-09-21.md#12-stories-told-over-runs-of-commits); contiguous on the session's proposal, and no overlap his, since nobody knows yet how to draw it.*

#### 2.1.1 The link names a commit or a run

The link's target is a commit's hash, or a run's first and last joined by two dots, after `git:`:

```markdown
[The keys belong to the map](git:d7a1138)

[The canvas spreads as a tree](git:152713e..b0b54e6)
```

A run holds both of its ends, which git's own two dots do not, so the practice says so. The target names no host, so it holds in every repository that takes this one in; on GitHub it reads as a link that goes nowhere, and the text still reads. The trace resolves a short hash, and warns where one is ambiguous, where a run is not a sequence in the history, and where two stories overlap.

*The session's proposal, 2026-09-21, taken by the author; a compare address on GitHub was weighed and refused, since it ties the substrate to one host.*

### 2.2 A commit is a brief of its own kind

A commit leaf is a brief like any other in what the surface holds of it: an address, a title, which is its subject, and a parent, the story that placed it. What sets it apart is what it carries instead of prose: the briefs it touched, and a way to the lines it changed.

Its face and its figure are the only things drawn for it alone. The face says the subject, the author and the date; the figure says what it touched, where a brief's says what it hides.

*The author's, 2026-09-21; the face and the figure are the session's reading of it.*

### 2.3 It is a record, newest first

The history is stamped as [a record](../practice.md#21-the-stamp-says-the-kind), whose order is time and not importance, and [the lane already reads a record so](lane.md#8-a-record-is-ordered-by-time). The newest stands first, as a debrief keeps its entries, so now is what a reader meets.

Commits no story tells yet stand among the stories in the order of time, each where it happened, and a story takes their place once it is written. So nothing is missing before it has been told, and the untold, mostly the newest, stand where a reader looks first.

*The session's proposal, 2026-09-21, taken by the author; it replaces gathering the untold at the end of the level, proposed the same day.*

### 2.4 A session writes the story as its debrief

A stretch of work ends with [its debrief](../../rule.md#55-the-debrief): the conclusion goes to the surface and the detail stays beneath. Over commits, the story is that conclusion and the commits are the detail, so a session writes the story of its own commits before it ends, and the author ratifies it or comments on it.

So the history is told as the work is done, not afterwards, and the bloat of many small commits is answered by the story over them rather than by fewer commits.

*The session's proposal, 2026-09-21, taken by the author; that bloat is solved by something else is [his](../../author/ideas-2026-09-21.md#8-bloat-is-valuable-information-and-is-solved-by-something-else).*

### 2.5 It stands at the root, and is never mounted

The stories live at the root of the repository, as `history.md` first, and as a folder `history/` once one reading no longer holds them, as any file becomes one. Nothing places them, and the surface knows the history by its place: it is traced only when the view is opened, never into the body, and the check does not list it as an orphan.

*The author's, 2026-09-21; the file first on the session's proposal, taken.*

## 3. One code for both

The body and the history are the same structure, so the same code draws both: the canvas, the lane, selection, the keys and folding take a commit as they take a brief. A second code path for history would be a double standard, and every rule of the surface would then have to be kept twice.

*The author's, 2026-09-21.*

## 4. The data, in two tiers

What a view asks decides the tiers. The canvas, the colouring and the filter by address need only which commits exist and what each touched; only a change shown in place needs the lines. So the light tier is had whole and the heavy one a commit at a time, and neither is ever fetched once per commit to draw a picture.

Locally both are computed on demand and cached by the commit's hash, which never goes stale since a commit never changes. Published, the pipeline writes them as files beside the page, since a static host answers no query.

*The author's, 2026-09-21: [a shallow set and a deep set](../../author/ideas-2026-09-21.md#2-a-shallow-set-and-a-deep-set), [cached locally, files when published](../../author/ideas-2026-09-21.md#4-cached-locally-files-when-published); the split by what a view needs is the session's, on his asking whether a file per commit would bottleneck the canvas.*

### 4.1 The shallow tier is had whole

Every commit that touched the root: its hash, parents, author, date and subject, the files it changed, and for a stamped file the briefs within it.

A brief is named by its path within its file, from the file's own title down, since where a file is placed in the body changes and the commit does not; the page lays that path onto the body when it draws. The commit leaves of the history's reading are made from these records when the history is traced.

It is one file, `history.json`, loaded once when the view opens, and enough to draw the canvas, colour the shape and filter by address. It is built by addition: a commit is read once, kept by its hash in the repository's git folder, a keeping per root, and never read again. It stands beside the page and never inside it, since it weighs a quarter of the page.

*As built, 2026-09-21. Measured on this repository's 456 commits: 373 KB, 73 KB gzipped, of which the paths of the briefs touched are 130 KB. Read cold in 3.5 seconds, the diffs in one git process and the file versions in another, and served warm in 0.15 to 0.35; lexing every version whole had taken 31, and finding the headings by their lines gave the same briefs for every commit.*

### 4.2 The deep tier is had a commit at a time

The lines a commit changed in the stamped files, brief by brief, one file per commit at `commits/<hash>.json`, fetched only when a reader opens that commit in the lane. A change that runs across a heading is cut there, each line going to the brief it stood in, and a change of nothing but blank lines is none.

Only the substrate is held. What a commit did to code or to images is counted in the light tier and not carried here, since the lane shows the prose in place and nothing else.

Should a view ever want lines across many commits at once, they are packed in runs of fixed length instead, fifty to a file, so a finished run never changes and only the newest grows. That waits until a view asks for it.

*As built, 2026-09-21. Measured on 460 commits: 3.6 MB together, 761 bytes at the median, 14 KB at the ninetieth percentile and 305 KB at the most; read cold in 0.24 seconds and warm in 0.04. Every diff with the code in it had been 10.5 MB. The whole build, both tiers with the page, takes 4.6 seconds.*

### 4.3 The body is measured before and after

Before anything of this is built, the time `/body` takes and the weight of the built page are measured, and after it they are measured again. Neither may move.

*In force, from [the history of the first attempt](../../ideas/history.md#2-why-it-came-out); the author's rule since 2026-09-17. Measured, 2026-09-21, around the light tier: `/body` 0.71 to 0.75 seconds and 1,279,090 bytes before and after, and the built page 1,466,094 bytes, 238,119 gzipped, the same to the byte.*

### 4.4 The pipeline clones the whole history

A pipeline's clone holds one commit unless told otherwise, and a history of one commit is no history. So the workflow that builds the page asks for every commit, and a tree without its history writes the one it has.

*As built, 2026-09-21; a clone of one commit was built from to see it.*

## 5. What a reader sees

What the reader sees is read from where they stand, and a selection shows its field.

*The author's, 2026-09-21.*

### 5.1 Only the commits that touch where you stand

Opening the history from an address shows only the commits that touched it, and the stories that hold them. For a reading, that is read from the files each commit touched, in the shallow tier; for a brief selected within it, from the briefs each commit touched.

That is also why a commit with a local purpose should stay local: then it is seen where its work is, and a reader looking there does not meet a commit that pertains to everything else.

*The author's, 2026-09-21: [the address shows only the commits that affect it](../../author/ideas-2026-09-21.md#16-the-address-shows-only-the-commits-that-affect-it).*

#### 5.1.1 A commit across many readings shows it by its figure

A commit's figure draws a bar for every reading it touched, each in that reading's branch hue. A local commit is one bar, and a conflated one a row of hues, so it is seen for what it is without anything saying so. Filtered by an address, it stands in every reading it touched, and so it is met in more places as well.

*The session's proposal, 2026-09-21, taken by the author.*

#### 5.1.2 A story stands wherever any of its commits touched

A story tells a stretch of time, not a place, so it holds whatever its run holds. From an address it stands if any of its commits touched there, and the commits of it that did not fold into a count of how many stand elsewhere, so the run still reads unbroken and the story is seen to reach further than where the reader stands.

*The session's proposal, 2026-09-21, taken by the author.*

### 5.2 A selection shows its field

Selecting a commit, or a story that holds ten, shows what it touched in three places: [the shape](widgets.md#3-the-shape) greys everything and colours what was touched; the map lights the touched briefs as nodes to go to; and the lane shows the change in place.

In place, the first cut marks the blocks that changed and leaves the rest as it is, and what was removed is shown only when asked. Colour there says changed against unchanged, and no hue is given to a commit, since a hue already says which branch a thing stands under.

*The author's, 2026-09-21: [how a change affected the field](../../author/ideas-2026-09-21.md#9-how-a-change-affected-the-field) and [a selection shows the pieces affected](../../author/ideas-2026-09-21.md#15-a-selection-shows-the-pieces-affected); the first cut of the change in place and giving up a hue per commit are the session's proposals, taken.*

### 5.3 Top-down first

The history is drawn as any reading is, down the column, so the canvas stays one coherent picture. The author pictured it at first left to right with the commits along the bottom; a toggle between top-down and left-right belongs to the canvas as a whole, for every reading, and is a step of its own that history does not wait on.

*The author's, 2026-09-21, turning from left to right for coherence in the canvas.*

## 6. What this leaves open

How overlapping stories would be drawn, and so whether stories may overlap at all, or run in several directions, which [the author doubts we are ready for](../../author/ideas-2026-09-21.md#14-partition-or-many-directions).

*Open, 2026-09-21; the rest raised that day was answered the same day, and [the granularity of a commit](../practice.md#13-a-commit-is-one-purpose-on-one-piece) went to the practice.*
