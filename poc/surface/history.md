---
under: the rule
kind: brief
status: open
---

# History

History is how the knowledge came to be what it is where a reader stands: which commits touched it, and the stories told over them. Git's history is read as a holarchy of its own, with the stories as its briefs and the commits as the leaves beneath them.

Its data is built, its stories are traced, and it is drawn as a pane of its own, its stories and commits as nodes. It is to be a mode instead, read in the lane and on the canvas alike and filtered by the scope the reader stands in, and neither that nor what a selection touched is built yet. [What comes next](#6-what-comes-next) says in what order.

*Preferred, the author's design, settled in discussion with the session 2026-09-21 and laid again 2026-09-28 as a mode; the data as built 2026-09-21, the trace and the pane 2026-09-27, and the rest open.*

## 1. Why it is laid again

Git was given to the surface once already, on 2026-09-17, and [taken out the same evening](../../ideas/history.md): it slowed every request for the body, it laid the commits into the body as a level nobody wrote, and sixty commits in a list helped nobody understand what changed.

So this time nothing of git enters the body, and the data comes before any view, built to what the view will need.

*Seen, 2026-09-17; the author's direction of 2026-09-21: [the foundation laid properly this time](../../author/ideas-2026-09-21.md#1-the-foundation-is-laid-properly-this-time).*

### 1.1 The body is measured before and after

Around anything of this that is built, the time the live process takes to hand the page its body and the weight of the built page are measured before and after. Neither may move by anything of history's: nothing of its data enters the body or the page.

The page's own code grows when it draws the history, and that is measured and said, since a page that grows for its drawing is not a page that carries the history.

*In force, from [the history of the first attempt](../../ideas/history.md#2-why-it-came-out); the author's rule since 2026-09-17, read by the session on 2026-09-27 as a rule on history's data, which is what the first attempt broke. Measured around both tiers of [the data](#5-the-data-in-two-tiers), 2026-09-21: the body stood at 0.71 to 0.75 seconds throughout, and the page's script did not change by a byte. Measured around the trace and the pane, 2026-09-27: the body stood at 0.75 seconds, no data of history's is in the page, and the page's script grew by 10 KB, the panes' two sides and the history's pane together.*

## 2. The history is a holarchy

Commits are one level, and the low one, and gathering them under a git branch leaves them at that level. What raises them is prose: a story tells what a run of commits did together, a larger story holds smaller ones, and the commits are the leaves at the foot of it all.

So the history is drawn as any reading is, and only its leaves are a kind of their own.

*Preferred, the author's, 2026-09-21: [commits are one level](../../author/ideas-2026-09-21.md#10-commits-are-one-level-and-the-low-one) and [a substrate for commits](../../author/ideas-2026-09-21.md#11-a-substrate-for-commits); that it is a holon with a holarchy is his of the same day.*

### 2.1 It stands at the root, and is never placed in the body

The stories live beside the entry of the root the surface is handed, as `history.md` first, and as a folder `history/` once one reading no longer holds them, as any file becomes one. Nothing places the file in the body, and the surface knows it by where it stands: it is traced when the history is asked for, and never for the body. The file is stamped as a record, [beneath](#24-it-is-a-record-whose-entries-are-holons).

The history there is the root's own: the commits that touched what lies under the root, which for this repository is the whole of it.

*Preferred, the author's, 2026-09-21; the file first on the session's proposal, taken; the root's own history, rather than the repository's, the session's from a fresh head, as the data was built.*

### 2.2 A story places its commits

A story is a brief of that file, a heading and its prose, and a larger story holds smaller ones as briefs beneath it, as any brief holds its level. A story names its commits by [placing them](../practice.md#37-a-lone-link-to-a-commit-places-it-in-the-history), each lone link standing a commit or a run of them there as leaves.

So the author can talk about the last three commits, a session adds a story of those three, and later a story of the last ten holds it, standing beside a story of the ten before.

A story's commits, all its links together, are one run: its first commit and every commit under the root that descends from it and leads to its last, with nothing left out between. So a run follows descent and not the calendar, and what was made on another branch in the same days is not in it. A larger story's run is its own commits and its smaller stories' together, and is one run as well.

No two stories overlap: a story may hold a smaller story whole, which is nesting, never overlap.

*Preferred, the author's, 2026-09-21, the runs as [he told them](../../author/ideas-2026-09-21.md#12-stories-told-over-runs-of-commits); contiguous on the session's proposal, and no overlap his. Read by descent, the session's, 2026-09-27, after a fresh head found a plain range taking in another branch.*

#### 2.2.1 The link names a commit or a run

The link's target is a commit's hash, or a run's first and last joined by two dots, after `git:`:

```markdown
[The keys belong to the map](git:d7a1138)

[The canvas spreads as a tree](git:152713e..b0b54e6)
```

A run holds both of its ends, where git's own two dots leave out the first; read by descent, it is what git calls the ancestry path from the first to the last, with the first itself. The target names no host, so it holds wherever the repository is read, in every project that takes it in as a submodule; on GitHub it reads as a link that goes nowhere, and the text still reads.

The trace resolves a short hash, and warns where one is ambiguous, where a run is not a sequence in the history, and where two stories overlap. It warns as well where a git link stands inside other prose, since that places nothing, and where a lone link names a file, since the history places commits and not files. The rest of what it can say, the surface's [`--history` flag](implementation.md#how-it-is-built) prints.

*Preferred, the session's proposal taken by the author, 2026-09-21; a compare address on GitHub was weighed and refused, since it ties the substrate to one host. The two further warnings as built, 2026-09-27, from a cold review of the trace.*

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

### 2.6 It is handed over flat, as the body is

The history's trace is handed to the page as [the body is](implementation.md#3-the-body-traced-and-flat): one flat list in reading order, which for a record is newest first, each brief carrying its address. Stories and leaves stand in the one list, a leaf being a brief whose address ends in its commit's hash, cut as git cuts one, to seven characters, and lengthened where two commits share their first seven.

A leaf carries its hash and no more of the commit, since the rest is in the history's data, [beneath](#51-the-light-tier-is-had-whole), and a fact has one home. Live, the trace is read from `history.md` whenever the history is asked for; published, the build writes it; either way it stands at `stories.json`, beside the data.

*Preferred, the author's, 2026-09-27, that the history travels flat as the briefs do; the name and the hash's length the session's. As built the same day.*

## 3. One code for both

The body and the history are the same structure, so the same code draws both: the canvas, the lane, selection, the keys and folding take a commit as they take a brief. A second code path for history would be a double standard, and every rule of the surface would then have to be kept twice.

As built, the canvas's code draws the history and the lane does not yet. [In the mode](#41-it-is-a-mode-not-a-pane) the lane draws it too: a story is prose like any brief, and a commit is [its face](#23-a-commit-is-a-brief-of-its-own-kind).

*Preferred, the author's, 2026-09-21; as built, 2026-09-27. The lane drawing the history, the author's, 2026-09-28: [a canvas alone is not enough](../../author/ideas-2026-09-28.md#2-a-canvas-alone-is-not-enough).*

## 4. What a reader sees

The history is a mode the middle is turned to, read from where the reader stands in the body, and what is selected in it shows what it touched there. Its canvas runs across, as a trunk.

*Preferred, the author's, 2026-09-21, laid again as a mode 2026-09-28; as built, a pane of its own, 2026-09-27.*

### 4.1 It is a mode, not a pane

The history needs both readings a body has, the prose and the map, and a pane of its own gave it only the map. So it is a mode: a switch in [the strip](framework.md#3-the-strip), standing first and apart from the panes, turns the lane and the canvas, wherever they stand, to the history, the lane to its stories and commits as prose and the canvas to them as a map, and turns them back.

What stands where does not change, and the history is not a pane. The widgets that follow the lane follow it into the mode: the shape, the tree and the ahead draw the history's lane, and the links tell of the links in its prose. The plate and the dish do not, and stay the body.

A pane's icon cycles it through the middle's sides; a mode has no side, so its icon is a switch. The page fetches the history's data when the reader reaches for the switch and not before, so a reader who never reads the history never pays for it.

*Preferred, the author's, 2026-09-28: [two alternatives](../../author/ideas-2026-09-28.md#3-two-alternatives), of which [the special thing](../../author/ideas-2026-09-28.md#5-the-special-thing-since-mounting-conflicts), a mode and not a pane; the reason, that mounting `history.md` in the body would make the history a place in it and the reader would stop standing where it is meant to filter by, is the session's, which he took. It supersedes the pane of 2026-09-27, as built. The plate staying the body is his; the dish with it, the widgets and the links following the lane, the switch, its place first in the strip and the fetch as the reader reaches for it are the session's. Its key, and whether the mode enters the page's address, are open. Superseded wide on 2026-10-01 by [git's prose and canvas as programs](layout.md#6-the-body-and-git-two-worlds) beside the body's; where the lane stands alone the mode stands as it was, its switch at the foot.*

#### 4.1.1 Turning to it never waits for what was read before

A history already read is turned to at once, and read again behind it where it has changed, so a reader never waits for what they have seen.

Only the first turn can wait, and it says so: the switch takes the weight it will have once the history stands and breathes, a quiet word beside it, or above it at the foot of a phone, says the history is being read, and a second press lets the waiting go. Nothing in the row moves while it waits.

The live process reads the history ahead of the reader, once the page has its body, and keeps it by where git's head stands, so even the first turn seldom waits. A published page has its history beside it as files, and says plainly where none was published.

*The author's ask of 2026-09-28, that the loading be a quality experience; the form is the session's. Measured the same day: a cold read of 565 commits took 9.4 seconds and a warm one 0.4, a repeat from memory 0.03, and the body stood at 0.85 to 0.97 seconds while the history was read ahead. Wide, from 2026-10-01, the history is read once anything of it stands, and while it is read git's prose says so and git's status tells how far it has got.*

### 4.2 Only the commits that touch where you stand

Where the reader stands, the history shows only the commits that touched it, and the stories that hold them.

Where the reader stands is the scope the lane and the canvas hold in the body, which [the mode](#41-it-is-a-mode-not-a-pane) keeps while the history is read. For a scope that is a whole reading, that is read from the files each commit touched; for a scope that is a brief within one, from the briefs each commit touched. A commit that touched several readings is among the commits of each, and at the root nothing is left out.

While the history is read, the way down names the body's scope it is filtered by, beside where the reader stands in the history, since a history filtered without saying so reads as one with holes in it.

The filter is as true as the commits are, which is why [a commit is one purpose](../practice.md#13-a-commit-is-one-purpose).

*Preferred, the author's, 2026-09-21: [the address shows only the commits that affect it](../../author/ideas-2026-09-21.md#16-the-address-shows-only-the-commits-that-affect-it); the scope as where the reader stands, his of 2026-09-28: [the history follows the scope](../../author/ideas-2026-09-28.md#1-the-history-follows-the-scope). That the way down says the filter is the session's; whether the reader can widen it to the whole history while scoped is open.*

#### 4.2.1 A story stands wherever any of its commits touched

A story tells a stretch of time, not a place, so it holds whatever its run holds. From where the reader stands, it stands if any of its commits touched there, and the commits of it that did not touch there fold into a count of how many stand elsewhere, so the run still reads unbroken and the story is seen to reach further than where the reader stands.

*Preferred, the session's proposal taken by the author, 2026-09-21.*

### 4.3 A selection shows what it touched

Selecting a commit, or a story that holds ten, in the history shows what it touched in the body.

It stays selected when the mode is left, beside whatever the reader selects in the body, and there [the shape](widgets.md#3-the-shape) greys everything and colours what was touched; the canvas lights the touched briefs it holds as nodes to go to; and the lane, where the reading it holds is one the selection touched, shows the change in place there. While the history is read, [the plate](widgets.md#7-the-plate), which stays the body, shows it beside the selection.

In place, the blocks that changed are marked and the rest is left as it is, and what was removed is shown only when asked; a finer marking may come later. Colour there says changed against unchanged, and no hue is given to a commit, since a hue already says which branch a thing stands under.

A change in place fetches from [the heavy tier](#52-the-heavy-tier-is-had-a-commit-at-a-time) exactly the commits it shows, one for a commit and ten for a story of ten, so what it asks is bounded by the story and never by the history.

*Preferred, the author's, 2026-09-21: [how a change affected the field](../../author/ideas-2026-09-21.md#9-how-a-change-affected-the-field) and [a selection shows the pieces affected](../../author/ideas-2026-09-21.md#15-a-selection-shows-the-pieces-affected); the plate staying the body, the author's, 2026-09-28, until the panes are managed some other way. The selection kept past the mode, and the plate showing what it touched, are the session's. The first cut of the change in place and giving up a hue per commit are the session's proposals, taken; that a story's change in place fetches its commits one by one is the session's, from a fresh head finding it unsaid.*

### 4.4 What is selected stands beside the switch

What is selected in the history reaches everything, since the body lights what it touched once the mode is left. So beside the switch stands what is selected there, a commit or a run, in a word or two, and pressing it lets that selection go, and the body goes back to its own colours.

*Preferred, the author's, 2026-09-28: [a status by the git glyph](../../author/ideas-2026-09-28.md#6-a-mode-a-status-and-the-roots-direction-for-every-canvas), for it affects everything, given by him as a perhaps; that pressing it lets go is the session's. Superseded on 2026-10-01 by [git's status](layout.md#71-gits-status-is-a-program), the author's word, where what is selected stands; letting it go there waits, as the selection reaching the body does.*

### 4.5 Its root's level runs left to right, a trunk

On the canvas the history's root level runs across, left to right, and each story's level hangs down beneath it, since the history is not a tree so much as a trunk with branches in one direction. Which way the root's level runs [may be a setting of every canvas](canvas.md#410-the-roots-level-runs-down-or-across), and the history's is across by default.

*Preferred, the author's, 2026-09-28: [a trunk and not a tree](../../author/ideas-2026-09-28.md#4-the-canvas-runs-left-to-right-a-trunk-and-not-a-tree), and the direction perhaps every canvas's [the same day](../../author/ideas-2026-09-28.md#6-a-mode-a-status-and-the-roots-direction-for-every-canvas). It supersedes the history drawn down the column for coherence, 2026-09-21, which left a toggle between the two directions for later. Which way time runs along the trunk is open.*

## 5. The data, in two tiers

What a reader sees decides what is fetched. The canvas, the colouring and the filter by where the reader stands span the whole history and need only which commits exist and what each touched; only a change shown in place needs the lines. So the data comes in two tiers: a light one had whole, and a heavy one had a commit at a time.

Locally both are read on demand, each commit once, and kept by its hash, which never goes stale since a commit never changes. Published, the pipeline writes them as files beside the page, since a static host answers no query.

*Preferred, the author's, 2026-09-21: [a shallow set and a deep set](../../author/ideas-2026-09-21.md#2-a-shallow-set-and-a-deep-set), [cached locally, files when published](../../author/ideas-2026-09-21.md#4-cached-locally-files-when-published); the split by what a view needs is the session's, on his asking whether a file per commit would bottleneck the canvas. As built the same day.*

### 5.1 The light tier is had whole

What a view needs of every commit at once is small, so it is had in one file, loaded once when the history is first read: every commit that touched the root, its hash, parents, author, date and subject, the files it changed with how many lines, code and images among them, and in a stamped file the briefs it touched.

The file is `history.json`, which shares a name with the stories' `history.md` and nothing else. Each root keeps a light tier of its own. It never stands inside the page, since it weighs a quarter of it.

*Measured, 2026-09-21, on 460 commits: 378 KB, 73 KB gzipped; read cold in 1.5 to 3.5 seconds and warm in 0.15 to 0.35. The headings are found by their lines rather than by lexing each version whole, which took 31 seconds, and the briefs so found match the trace's addresses in every stamped file.*

### 5.2 The heavy tier is had a commit at a time

The lines a commit changed in the stamped files, brief by brief, one file per commit at `commits/<hash>.json`, fetched only for [a change shown in place](#43-a-selection-shows-what-it-touched). A change that runs across a heading is cut there, each line going to the brief it stood in, and a change of nothing but blank lines is none.

Only the substrate is held. What a commit did to code or to images is counted in the light tier and not carried here, since the lane shows the prose in place and nothing else.

*Measured, 2026-09-21, on 460 commits: 3.6 MB together, 761 bytes at the median and 305 KB at the most; a commit read cold in 0.24 seconds and warm in 0.04.*

## 6. What comes next

Done: the data, 2026-09-21; the trace, the first stories and a pane drawn by the canvas's code, 2026-09-27; [the mode](#41-it-is-a-mode-not-a-pane) with the lane drawing the history, and [its root running across](#45-its-roots-level-runs-left-to-right-a-trunk), 2026-09-28. What is next is laid in the order each step stands on the one before, and a session taking this up begins at the first step not done.

1. Show [only the commits that touch where the reader stands](#42-only-the-commits-that-touch-where-you-stand), the body's scope, and say the filter in the way down.

2. Show [what a selection touched](#43-a-selection-shows-what-it-touched) in the body, on the plate while the history is read and on the shape, the canvas and in place in the lane once it is left, with [what is selected beside the switch](#44-what-is-selected-stands-beside-the-switch), fetching [the heavy tier](#52-the-heavy-tier-is-had-a-commit-at-a-time) as a change in place asks. It is felt rather than only specified, and so is the author's to see first.

*In force as the order, the session's, 2026-09-21; laid again 2026-09-27, and again 2026-09-28, when the author made the history a mode and answered where it stands from. The trunk was laid third that day and built second, on the author's word that the history running left to right had been clear; the order had put a step of his first requirement after one he had not asked for first. Each step is looked at on the page before the next.*

## 7. What this leaves open

How overlapping stories would be drawn, and so whether stories may overlap at all, or group commits along more than one line at once, which [the author doubts we are ready for](../../author/ideas-2026-09-21.md#14-partition-or-many-directions).

Whether lines across more commits than a story holds are ever wanted at once; if they are, the heavy tier is packed in runs of fixed length, fifty to a file, so a finished run never changes and only the newest grows.

How a session tells its story where another session's commits fall between its own, since a run leaves nothing out and stories do not overlap.

Whether the canvas opens the way to a touched brief the reader has not opened, or lights only what it holds.

Which way time runs along [the trunk](#45-its-roots-level-runs-left-to-right-a-trunk). As built the newest stands at the left, as the record is written and [so that now is what a reader meets](#24-it-is-a-record-whose-entries-are-holons), and the arrows walk it as it is drawn; the oldest at the left, as a timeline reads, is the author's to choose by looking.

Whether a reader scoped in the body can widen the filter to the whole history without leaving their scope, and whether a reader may scope within the history's own lane, and what that scope would then mean.

Whether the mode and what is selected in it enter the page's address, so a story can be handed to someone, and which key turns the mode.

How the panes are managed once the plate is not enough of a window onto the body while the history is read, which the author leaves for later.

*Open, 2026-09-21; the rest raised that day was answered the same day, and [the granularity of a commit](../practice.md#13-a-commit-is-one-purpose) went to the practice. How the history is opened was answered 2026-09-27 as a pane and again 2026-09-28 as [a mode](#41-it-is-a-mode-not-a-pane), which answered where it stands from as well: the body's scope. The last four were raised 2026-09-28.*
