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

A run is a sequence for now, from one commit to another with nothing left out between, so stories nest cleanly and draw as layers. Whether a story may gather commits that are not neighbours, or two stories overlap, [waits](#6-what-this-leaves-open).

*The author's, 2026-09-21, the runs as [he told them](../../author/ideas-2026-09-21.md#12-stories-told-over-runs-of-commits); contiguous for now on the session's proposal, which he took. How the link to a commit is written is owed to the practice and not settled.*

### 2.2 A commit is a brief of its own kind

A commit leaf is a brief like any other in what the surface holds of it: an address, a title, which is its subject, and a parent, the story that placed it. What sets it apart is what it carries instead of prose: the briefs it touched, and a way to the lines it changed.

Its face and its figure are the only things drawn for it alone. The face says the subject, the author and the date; the figure says what it touched, where a brief's says what it hides.

*The author's, 2026-09-21; the face and the figure are the session's reading of it.*

### 2.3 It is a record, newest first

The history is stamped as [a record](../practice.md#21-the-stamp-says-the-kind), whose order is time and not importance, and [the lane already reads a record so](lane.md#8-a-record-is-ordered-by-time). The newest stands first, as a debrief keeps its entries, so now is what a reader meets.

Commits no story tells yet gather at the end of the history's own level, so nothing is missing from it before it has been told.

*The session's proposal, 2026-09-21, taken by the author.*

### 2.4 It stands at the root, and is never mounted

The stories live at the root of the repository, as `history.md` or as a folder `history/` once one reading no longer holds them. Nothing places them, and the surface knows the history by its place: it is traced only when the view is opened, never into the body, and the check does not list it as an orphan.

*The author's, 2026-09-21; which of the two forms comes first is not decided.*

## 3. One code for both

The body and the history are the same structure, so the same code draws both: the canvas, the lane, selection, the keys and folding take a commit as they take a brief. A second code path for history would be a double standard, and every rule of the surface would then have to be kept twice.

*The author's, 2026-09-21.*

## 4. The data, in two tiers

What a view asks decides the tiers. The canvas, the colouring and the filter by address need only which commits exist and what each touched; only a change shown in place needs the lines. So the light tier is had whole and the heavy one a commit at a time, and neither is ever fetched once per commit to draw a picture.

Locally both are computed on demand and cached by the commit's hash, which never goes stale since a commit never changes. Published, the pipeline writes them as files beside the page, since a static host answers no query.

*The author's, 2026-09-21: [a shallow set and a deep set](../../author/ideas-2026-09-21.md#2-a-shallow-set-and-a-deep-set), [cached locally, files when published](../../author/ideas-2026-09-21.md#4-cached-locally-files-when-published); the split by what a view needs is the session's, on his asking whether a file per commit would bottleneck the canvas.*

### 4.1 The shallow tier is had whole

Every commit as a leaf brief: its hash, parents, author, date and subject, the stamped files it touched, and the briefs within them. It is one file, loaded once when the view opens, and enough to draw the canvas, colour the shape and filter by address.

It is built by addition, an entry per new commit, and is never computed again for commits it already holds. It is not in the body, and not embedded in the page unless it stays as light as the body is.

*Measured by the session, 2026-09-21, on this repository's 453 commits: the log with the files each touched is 160 KB, 44 KB gzipped, and took 8.5 seconds cold. The briefs touched are not yet measured.*

### 4.2 The deep tier is had a commit at a time

The lines a commit changed, mapped to the briefs they fall in, one file per commit, fetched only when a reader opens that commit in the lane.

Should a view ever want lines across many commits at once, they are packed in runs of fixed length instead, fifty to a file, so a finished run never changes and only the newest grows. That waits until a view asks for it.

*Measured by the session, 2026-09-21: every diff together is 10.5 MB; one commit's is 7.6 KB at the median, 47 KB at the ninetieth percentile and 758 KB at the most.*

### 4.3 The body is measured before and after

Before anything of this is built, the time `/body` takes and the weight of the built page are measured, and after it they are measured again. Neither may move.

*In force, from [the history of the first attempt](../../ideas/history.md#2-why-it-came-out); the author's rule since 2026-09-17.*

## 5. What a reader sees

What the reader sees is read from where they stand, and a selection shows its field.

*The author's, 2026-09-21.*

### 5.1 Only the commits that touch where you stand

Opening the history from an address shows only the commits that touched it, and the stories that hold them. For a reading, that is read from the files each commit touched, in the shallow tier; for a brief selected within it, from the briefs each commit touched.

That is also why a commit with a local purpose should stay local: then it is seen where its work is, and a reader looking there does not meet a commit that pertains to everything else.

*The author's, 2026-09-21: [the address shows only the commits that affect it](../../author/ideas-2026-09-21.md#16-the-address-shows-only-the-commits-that-affect-it).*

### 5.2 A selection shows its field

Selecting a commit, or a story that holds ten, shows what it touched in three places: [the shape](widgets.md#3-the-shape) greys everything and colours what was touched; the map lights the touched briefs as nodes to go to; and the lane shows the change in place.

In place, the first cut marks the blocks that changed and leaves the rest as it is, and what was removed is shown only when asked. Colour there says changed against unchanged, and no hue is given to a commit, since a hue already says which branch a thing stands under.

*The author's, 2026-09-21: [how a change affected the field](../../author/ideas-2026-09-21.md#9-how-a-change-affected-the-field) and [a selection shows the pieces affected](../../author/ideas-2026-09-21.md#15-a-selection-shows-the-pieces-affected); the first cut of the change in place and giving up a hue per commit are the session's proposals, taken.*

### 5.3 Top-down first

The history is drawn as any reading is, down the column, so the canvas stays one coherent picture. The author pictured it at first left to right with the commits along the bottom; a toggle between top-down and left-right belongs to the canvas as a whole, for every reading, and is a step of its own that history does not wait on.

*The author's, 2026-09-21, turning from left to right for coherence in the canvas.*

## 6. What this leaves open

How a commit that touches many readings shows, so that a conflated commit is seen for what it is without the view scolding.

Whether a story may tell commits across several readings, and how it stands from an address only some of them touched.

Whether a run may be spread out, and whether stories must partition the commits so the whole reads as a directed graph, or may overlap and run in several directions, which [the author doubts we are ready for](../../author/ideas-2026-09-21.md#14-partition-or-many-directions).

Where the granularity of a commit is told: one purpose on one piece of the holarchy, a change that propagates for one reason still one commit, sessions never conflated. It is [the author's](../../author/ideas-2026-09-21.md#7-commits-at-a-granularity-that-does-not-conflate), and belongs in the practice once it is settled.

How a link to a commit or a run is written, and which of `history.md` and `history/` comes first.

*Open, 2026-09-21.*
