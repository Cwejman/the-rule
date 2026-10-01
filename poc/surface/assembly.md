---
under: the rule
kind: brief
status: open
---

# The surface, assembled again

The surface's code has grown from 1,223 lines to 7,945 in eighteen days, and most of the growth is not new function but the same function reached twice: two worlds made by copying one state in and out, two layouts kept side by side, and a list of what to draw again written out by hand at every place something changes.

This brief says what the code is for, the lore it is built on, and how it is assembled again on that lore without changing anything a reader sees or does.

*Open, the session's, 2026-10-01, asked by the author: "what is really the function, and how may it really be assembled", with "the foundational lore as wisdom about building programs … such as unix, functional programming" there, as the sister project's principles hold it, and "of course not changing behaviour".*

## 1. The lore it stands on

Two traditions say most of what is known about building programs that stay small, and the sister project's [principles](https://github.com/Hjulverkstan/hjulverkstan/blob/main/GUIDELINES.md#principles-) carry both into plain TypeScript. Each move [beneath](#4-how-it-is-assembled) names the principle it serves, so a reader can weigh the move against the lore and not against taste.

*Established, of the two traditions; the principles are the author's, carried from the sister project, where [the implementation](implementation.md#71-taste-in-the-rule-itself) brought them as taste and this brief brings them as ground.*

### 1.1 Unix: small parts that each do one thing

A program is made of parts that each do one thing well and are joined by a plain interface: in Unix, text through a pipe. A part is understood alone, replaced alone, and tested alone, and what is clever lives in how parts compose rather than inside any of them. Data stands in a form any part can read.

Here the plain interface is data: the body is already handed from the process to the page as flat data, and the same holds within the page, where a part takes a value and gives a value.

*Established: McIlroy's summary of the Unix philosophy, 1978, and its long practice.*

### 1.2 Functional programming: a pure core in an imperative shell

A function that returns the same result for the same input and touches nothing else can be read, reasoned about and tested on its own.

A program cannot be only that, since it must draw and listen, so the side effects are gathered at the edge, a thin shell, around a core of pure functions. State is a value with one owner, derived values are computed from it rather than stored beside it, and data flows one way: from the state through the functions to what is drawn, and from a reader's act back to the state.

*Established, as functional programming has long practised it; the shell and core as Bernhardt named them in 2012.*

### 1.3 The sister project's principles

These are the two traditions as the author holds them, and the measure every move here is weighed against:

- **Simplicity and coherence.** The simplest way that meets the need, and one pattern for one kind of thing, so the code is predictable.
- **Dumb is smart.** Plain repetition is better than a clever abstraction, and few abstractions are better than many. So vanilla TypeScript, and no currying, piping or framework.
- **Describe over instruct.** What is wanted, not how to get it step by step.
- **Data over logic.** Restructure the data so the logic falls away: a table of cases rather than a branch for each.
- **Pure functions, side effects decoupled, one thing well.** Larger things are composed from parts that each do one thing.
- **A single source of truth.** Data is flat and normalized, derived values are computed when needed, and data flows one way.
- **Context and decisions are documented.** The code says why where it is not plain, and a decision is written where it is made.
- **Never fail silently.**

*The author's, carried from the sister project.*

## 2. What the program is for

The surface reads a body: a flat list of briefs, traced once by the process and handed to the page as data. It answers four questions, and that is the whole of its function.

1. **Where does the reader stand?** A reading of one body: its scope, the fold of every brief in it, the focus, what the pointer rests on, what is selected and open on the map, and how the reader came here. There are two such readings at once, of the body and of git's history.
2. **What do they see?** Views, each a projection of one reading: the prose, the canvas, and the figures beside them.
3. **Where does each view stand?** The page's arrangement, from the reader's settings and the screen.
4. **What does an act change?** A key, a press or a drag changes a reading or a setting, and the page is drawn again from them.

Everything else is either the process that makes the body, which is already apart and in good order, or one of these four done more than once.

*Reasoned, the session's, 2026-10-01, from the whole file read through.*

## 3. What the code is now

The file has three parts. The process, which traces the body and git's history and serves or writes the page, is 984 lines of code, and it stands in the order these principles ask: the substrate's types first, pure functions beneath them, the effects at the edge.

The page's script is 4,069 lines of code and 1,374 of comment, and its style is 700 lines. The pilot's script was 915 lines of code in all.

Almost nothing in the script is dead: the type checker finds two unused names. The weight is four things done twice:

- **A world is copied, not held.** The history's reading is made by copying twenty-two fields of one global state and its elements out to a record, copying the other world's in, and back again when done. Copies held across a nested call go stale, and the code carries a helper for each case found: one maps a stale copy back to the live world, one reaches the body's world from inside the history, and one reads a copy of the history held one step out. Several of the faults the cold reviews of the two worlds found were this.
- **Two layouts.** Wide, the page is the row laid by hand; on a phone it is still the five areas the row superseded, with their own grid, their own wing drawing, their own slots and their own fitting. And the wide row is translated back into the areas' terms so the rest of the code can go on asking the old questions: `fits()` is asked 32 times and `narrow()` 45.
- **What to draw again is written out by hand.** One function draws everything. Beside it, place after place draws again a hand-picked part of the page, for a fold, a resize, the fonts arriving, an image loading, a pulled gap or a turned knob, and each list was written apart.
- **The acts branch on where the keys are.** Most actions ask in each of their four parts whether the keys are on the map or the prose, so one entry holds two acts.

The comments carry much of the history of decisions, dated, which [the briefs](implementation.md) and [the history](../../history.md) already hold.

*Measured, the session's, 2026-10-01, at commit c3cfaa4.*

## 4. How it is assembled

Each move keeps every behaviour, and each says the principle it serves.

*Proposed, the session's, 2026-10-01; none is answered yet.*

### 4.1 A world is a value the page points at

A reading is one object, a world: its body and index, its scope, folds, focus, pointer and selection, what stands open, its trail, undo and redo, its map's view and how that view was fitted, and the elements it is drawn in.

The page holds two, the body's and the history's. "The world now" is a pointer to one of them, and doing something in the other world sets the pointer and sets it back, so nothing is ever copied and no copy can go stale.

The copying, the record of fields to copy, the helpers that patched stale copies and the nesting rules between the two worlds all go. What is left is one line: run this with that world set.

*A single source of truth: each fact of a reading has one home. Proposed, the session's.*

### 4.2 The settings are the page's, apart from the worlds

The settings are one value, the reader's, kept in the browser. They are held apart from any world, since they belong to no reading, and they are read and written in one place.

*A single source of truth, and flat data. Proposed, the session's.*

### 4.3 One layout, a pure function of the settings and the screen

Where each program stands is computed by one pure function from the settings, the screen's width and height, and whether the reader has a finger.

It returns where each program stands and how wide, and which gave way. On a phone it returns the one pane the phone shows, the rail beside it where it stands, and the figures where a narrow screen still has room for them beside a map. One function then sets the elements where the layout says, and every other part asks the layout where a program stands, not the areas.

The five areas, their grid, the wing drawing beside the stacks, the slots kept apart for each and the translation of the row into the areas' terms all go. A phone draws its figures with the same stack code the wide page does.

*One pattern for one kind of thing, and pure functions with effects at the edge. Proposed, the session's. A phone's layout is exactly what it is today, area for area, and where the one function cannot reproduce a pixel of today's phone, that is found by [the harness](#5-how-the-behaviour-is-kept) before anything is committed.*

### 4.4 A view is a function from a reading to markup

Each view draws from a world and the settings and returns markup: the lane, a card, the map's columns, the way down, every figure, the dock. The few that must measure what the browser laid out, such as the lane's ends, the gutters beside the lines and the map's edges, are a second step after the markup is set, and they are named as such.

Most of the views already are this. What changes is that each reads the world it is handed, not whichever world a global happens to hold.

*Pure functions, and one thing well. Proposed, the session's.*

### 4.5 One draw, from what changed

An act changes a world or the settings, and says what it changed: the reading, the folds, the focus, the pointer, the layout or a setting. One function draws again what depends on that, in one order, every time. The hand-written lists go, and so do the cases where one list forgot a part another remembered.

*Describe over instruct, and data flowing one way. Proposed, the session's. [The implementation](implementation.md#6-how-it-is-drawn) already says that every change draws again only what depends on it; this is that said once in the code.*

### 4.6 The acts as data, one table for each hand

What a key does on the prose and what it does on the map are two acts. So the actions become two tables, the lane's and the map's, and which hand holds the keys picks the table. A badge names an act in its own table. An entry no longer asks in its every part where the keys are.

*Data over logic. Proposed, the session's.*

### 4.7 The comments say why, and the briefs say how it came to be

A comment says what is not plain from the code: why it is so, and what it guards against. The story of how a decision was reached, with its dates, stands in the briefs and in the history, which already hold it, and leaves the code.

*Context and decisions documented, each in its place. Proposed, the session's. Which comments go is the author's to see in the diff, since the comments are written in his voice.*

### 4.8 One file, or a few

[The implementation](implementation.md#7-one-file-laid-by-the-gradient) keeps the surface in one file because it is the proof of concept, and says that once the file outgrows reading by depth, each widget becomes a file of its own.

At 7,945 lines it may have reached that point. Bun bundles a page's script from several files as it serves it, so a split would cost no build step: the process, the substrate, the page's state, the layout, the views, the acts and the style could each be a file.

*Small parts that each do one thing. Whether it is time is the author's: it reverses his decision of 2026-09-12. The assembly above holds either way, since every move here is a seam a file could later be cut along.*

## 5. How the behaviour is kept

Nothing a reader sees or does may change, and that is shown, not argued.

Before the first move, a harness drives the page in a browser through scenarios at several widths, in both themes, with a pointer and with a finger, in both worlds: arriving, scrolling, folding, scoping, following links, undoing, the map, git's history, dragging programs, pulling gaps, the dock, the knobs and switches, the phone's foot, its card and its rail. After every step it takes the screen as a picture, together with the address, the settings kept, each scroll and what the page drew.

The page as it stands now and the page after each move are run side by side against the same body. A move is committed only when every picture and every fact is equal, or when each difference has been looked at and is only in how something is written, never in what is drawn or done. The process's own outputs, the check, the history and the written page, are compared the same way.

Then each move gets a cold review, as every build here does, and the author looks at the page.

*Proposed, the session's, 2026-10-01; the author's ask was that behaviour not change.*

## 6. The order of the work

Each step is one commit, and the harness is equal after each.

1. The harness, and the page as it stands recorded through it.
2. Two unused names go, and the dated stories of the comments leave for the briefs that hold them.
3. The worlds become values the page points at, with the settings apart.
4. One layout, and the phone drawn by it.
5. One draw from what changed.
6. The acts as two tables.
7. Files, if the author wants them.

The order puts the moves that only remove first, and the one that touches every part, the world, before the ones that build on it.

*Proposed, the session's, 2026-10-01.*

## 7. What this leaves open

- Whether the file is split into a few, [above](#48-one-file-or-a-few).
- How far the comments are cut back. The proposal moves the dated stories to the briefs and keeps the reasons.
- Whether anything can be simplified beyond keeping behaviour. A behaviour that exists only because of how the code grew, such as figures standing beside a map on a screen just too narrow for the prose's gutters, is kept unless the author lets it go.

*Open, 2026-10-01.*
