---
under: the rule
kind: brief
status: open
---

# The surface, assembled again

The surface's code has grown from 1,223 lines to 7,945 in eighteen days. Most of the growth is not new function but the same function reached twice: two worlds made by copying one state in and out, two layouts kept side by side, one thing drawn by three renderers, and what to draw again written out by hand wherever something changes.

Assembled again on the lore of building programs, the page's script keeps every behaviour in roughly a sixth fewer lines of code and up to half its comments, and each part does one thing that can be named.

*Open, the session's, 2026-10-01, asked by the author: "what is really the function, and how may it really be assembled", with "the foundational lore as wisdom about building programs … such as unix, functional programming" there as the sister project's principles hold it, "of course not changing behaviour", and "there must be immense simplification possible under that wisdom". Read cold twice, once as a brief and once against the code, before anything is built.*

## 1. What the program is for

A reader takes in a body of knowledge laid by the gradient, at the depth they need, and always sees where they stand in it. Beside it they can read how it came to be, git's history, laid the same way. Everything the page does serves that, and it comes to four parts.

1. **The reading: where the reader stands.** One reading of one body: its scope, the fold of every brief, the focus, what the pointer rests on, what is selected and open on the map, and how the reader came here. Two readings stand at once, the body's and the history's, and the reader's settings stand beside them.
2. **The views: what they see.** The prose, the canvas and the figures. Each is a projection of one reading, drawn from it and from nothing else.
3. **The layout: where each view stands.** It follows from the settings and the screen.
4. **The acts: what a key, a press or a drag changes.** An act changes a reading or a setting, and the page is drawn again from them.

The process that traces the body and the history and serves the page is apart from all four, and already in good order.

*Reasoned, the session's, 2026-10-01, from the whole file read through; that the surface is for reading a body at the depth one needs is [the surface's own](README.md).*

## 2. What the code is now

The file has three parts.

- **The process**, 984 lines of code. It stands in the order the lore asks: the substrate's types first, pure functions beneath them, and the effects at the edge.
- **The page's script**, 4,069 lines of code and 1,374 of comment.
- **The style**, 700 lines.

The pilot's script was 915 lines of code in all.

The type checker finds two unused names, so the weight is not dead code. It is the same thing done more than once:

- **A world is copied, not held.** The history's reading is made by copying twenty-two fields of one global state, and the elements it is drawn in, out to a record and the other world's in, and back when done. A copy held across a nested call goes stale, and a helper was added for each case found. Of the cold reviews' faults in the two worlds, at least three were stale copies or a shared global left behind.
- **Two layouts.** Wide, the page is the row laid by hand. On a phone it is still the five areas the row superseded, with their own grid, wing drawing, slots and fitting. The wide row is translated back into the areas' terms so the rest can ask the old questions, which it does through `fits()` 32 times and `narrow()` 45. The settings keep both arrangements.
- **One thing, several renderers.** A commit's line is drawn three times, and so is the line of acts beneath a brief. A figure's slot is drawn by the stacks and again by the wings. The programs are described by five overlapping tables.
- **What to draw again, by hand.** About eighteen places each draw again a hand-picked part of the page. Some drawing also changes the reading: drawing the map decides what is selected and open.
- **The gestures in one function.** One function of 594 lines wires 25 listeners. A press is a chain of some thirty cases, and the acts it reaches are spread through it.
- **Dead paths.** Some code can never run: the gutters on a phone, which the width forbids; an act nothing calls; knobs that no longer exist; and style for markup no longer drawn.

The comments carry the dated story of many decisions, which [the briefs](implementation.md) and [the history](../../history.md) already hold.

*Measured, the session's, 2026-10-01, at commit 25ee761, by reading and by count; the faults by the reviews of 977f285, 1a54efb and f927248.*

## 3. The lore it stands on

The author's [principles](https://github.com/Hjulverkstan/hjulverkstan/blob/main/GUIDELINES.md#principles-) carry two traditions into plain TypeScript, and a third names this kind of program. Each move [beneath](#4-how-it-is-assembled) names the principle it serves, so it is weighed against the lore and not against taste.

*The principles are the author's, carried from the sister project, where [the implementation](implementation.md#71-taste-in-the-rule-itself) brought them as taste; this brief brings them as ground.*

### 3.1 Unix: small parts joined by plain data

A program is made of parts that each do one thing well, joined by a plain interface: in Unix, text through a pipe. A part is understood alone and replaced alone, and what is clever lives in how the parts compose. Here the interface is data. The body already crosses from the process to the page as flat data, and within the page a part should take a value and give one.

*Reasoned, carried from McIlroy's summary of the Unix philosophy, 1978; not checked against this code beyond the reading.*

### 3.2 Functional programming: a pure core in a thin shell

A function that returns the same result for the same input, and touches nothing else, can be read and tested on its own. A page must draw and listen, so its effects are gathered in a thin shell around a pure core.

State is a value with one owner. What can be derived from it is computed, not stored beside it, and data flows one way.

*Reasoned, carried from functional programming's long practice and Bernhardt's naming of the core and the shell, 2012; not checked.*

### 3.3 Model, view, update

A page like this one has a known shape:
- a **model**, the state;
- a **view**, a pure function from the model to what is drawn;
- an **update**, which takes an act and the model and gives the next model.

The program's four parts are that shape, with the layout as a view of the settings. Taken whole, as a framework, it would bring a compile step and a runtime the surface refused when it [chose plain functions](implementation.md#8-plain-functions-before-a-framework). Taken as a shape, it costs nothing and tells each function where it belongs.

*Reasoned, carried from the Elm architecture as Czaplicki described it, 2012 onward; not checked.*

### 3.4 The sister project's principles

The author holds these, and every move is weighed against them:

- **Simplicity and coherence.** The simplest way that meets the need, and one pattern for one kind of thing.
- **Dumb is smart.** Plain repetition beats a clever abstraction, and few abstractions beat many. So it stays vanilla TypeScript, with no currying, no piping and no framework.
- **Describe over instruct, and data over logic.** A table of cases rather than a branch for each.
- **Pure functions, effects kept apart, one thing well.** Large things are composed of small ones.
- **A single source of truth.** Flat, normalized data, derived when needed, flowing one way.

From the project's rules, two more apply here: a decision is documented where it is made, and nothing fails silently.

*The author's, carried from the sister project: the first five from its principles, the last two from its rules.*

## 4. How it is assembled

Each move keeps every behaviour, names the principle it serves, and says roughly what it removes. Together they remove about 600 to 750 lines of the page's code, and 300 to 600 of its comments.

*Reasoned, the session's, 2026-10-01; the estimates are a cold reader's, made against the code at 25ee761 and not yet measured. None of the moves is answered by the author.*

### 4.1 What can never run goes

The gutters on a phone can never stand, since a width narrow enough to be a phone is too narrow for them. The act that turned a phone to the history is drawn nowhere, since the switch acts directly. Two knobs and their formatting are gone from the page. The style still holds rules for markup the page no longer draws.

All of it goes, and nothing a reader can reach changes, since none of it can be reached. About 60 lines.

*Simplicity. Reasoned from the code; that each is unreachable is checked by the harness before it goes.*

### 4.2 One thing, one renderer

These are each written once and used where each is wanted:
- a commit's line: who made it, when, its hash and the readings it touched;
- a brief's line of acts;
- a hue against a body;
- a brief's path, title and face;
- a knob's value as it reads;
- a debounced write to the browser's storage.

The five tables that describe the programs become one: each program says how it draws, how wide it stands, whether it grows, what it answers and which world it is of. A program's height is then said once, where it is now said in two tables that can disagree. About 90 lines.

*One pattern for one kind of thing, and a single source of truth. Reasoned; each renderer's output stays character for character what it was.*

### 4.3 A world is a value the page points at

A reading is one object, a world. It holds:
- its body, its index, scope, folds, focus and pointer;
- what is selected and open on the map;
- its trail, undo and redo;
- its map's view and how that view was fitted;
- the elements it is drawn in.

The page holds two worlds. "The world now" points at one of them, and acting in the other sets the pointer and sets it back. Since both are the live objects, nothing is copied and no copy can go stale. A timer or a frame that waits captures the world it began in, not a copy of it.

The copying, the list of fields to copy, the helpers that patched stale copies, and the four wrappers with their different nesting rules all go. Each world's elements carry its name, so which world an element belongs to is read off the element, not reckoned. About 100 to 130 lines.

The pointer is chosen over handing each function its world as an argument. Some three hundred functions read the reading, and threading one more argument through all of them is the clever form of what one variable says plainly. The views are kept pure all the same: they read the world now and change nothing in it.

*A single source of truth, and dumb is smart. Reasoned, the session's; a cold reader preferred the argument for its purity, and that is weighed here and not taken.*

### 4.4 Drawing changes nothing

Drawing the map today also decides what is selected and what stands open, and drawing a row records which column it stands in. Each of those decisions moves to the act or the arrival that makes it, before anything is drawn, so data flows one way: an act changes the reading, and the views draw it. This removes no lines, but it removes the reason a draw could not be called twice.

*Unidirectional flow. Reasoned; the order of those decisions within an act stays what it is, which the harness checks.*

### 4.5 The settings are a table

The settings are the page's, apart from both worlds. Today they are checked by hand, one setting at a time. The switches already list each setting's legal values, so the check becomes one pass over that list. The dated repairs to settings kept from before 2026-09-17 are [the author's to let go](#5-what-only-the-author-can-let-go).

About 30 lines.

*Data over logic. Reasoned. A setting that is not checked today, such as the nesting line or the flick, is checked once it is in the table, which changes nothing for a value the page itself wrote.*

### 4.6 One layout, as a function of the settings and the screen

Where each program stands is computed by one pure function of four things: the settings, the screen's width and height, and whether the reader has a finger. It returns where each program stands, how wide, and which gave way. One function then places the elements, and every other part asks the layout, not the areas.

A phone's arrangement is not the wide row, and it stays what it is. What it needs of the settings are the pane it shows, the side its rail stands on, and the figures it has room for beside a map. Those are read from the areas as they are kept now, so a reader's saved arrangement still lays their phone. The areas' grid, wing drawing and slots then go, and a phone's figures are drawn by the same stack code as the wide page's. About 250 to 300 lines.

This is the move most likely to move a pixel. Today the grid lays the phone and the browser rounds, and the one function will place in whole pixels. Two fixed figures in one wing stand at its top and its foot, where a stack sets them one under the other. And the wings give way in their own order. Each such case is matched, not let go, and [the harness](#6-how-the-behaviour-is-kept) finds any that is missed.

*One pattern for one kind of thing, and pure functions. Reasoned, the session's; a phone exactly as it is today.*

### 4.7 One draw, at a few levels

An act changes a reading or the settings, and never draws. When it is done, the shell draws the page at one of a few named levels:
- **all**: the layout, both proses, the map and the figures;
- **the lanes**: both proses and the map;
- **the figures**;
- **the light**: what is lit.

A discrete act draws at all where that is fast enough, and the cost is measured first. A continuous gesture keeps its own narrow redraw, named, since a scroll, a drag or a turned knob must not lay the whole page again under the hand. The two places where one measure settles another stay explicit: the prose's ends with the shape's slot, and the gutters with the room they hang below the lane.

There is no tracking of what depends on what, which would be a small framework. About 40 to 60 lines.

*Describe over instruct, unidirectional flow, and dumb is smart. Reasoned, the session's. It departs from [the implementation](implementation.md#6-how-it-is-drawn), in force since 2026-09-13, that every change draws again only what depends on it: a discrete act may now draw more than it needs, where that costs the reader nothing.*

### 4.8 An act, and its other hand

The actions stay one table. About eleven of them act differently while the keys are on the map, and today they ask which hand holds the keys in each of their parts.

Each such entry gains one override for the map: a label, a help, a test and a doing, taken whole while the keys are there. Entries that act the same either way are written once, as now. A chord still goes to the first act that can take it, so return reads on the map before it scopes the prose.

About 20 to 30 lines.

*Data over logic, and an action named in one place. Reasoned; a cold reader showed that two tables would copy the twelve entries that do not care.*

### 4.9 The gestures, as data

A press is a table of what it can land on, the first match taking it: a badge, a row of the map, a fold line, a program in the dock, a gutter, a setting, a cell of the trail, a name in the way down, a cell of a figure. Each case says what it acts on.

A drag is a table of its kinds: a gap, a stack's gap, a program, a knob, the shape, the rail, the map's ground and a phone's card. Each kind says how it starts, follows the hand and lets go. The wheel, the keys and the pointer are each one small function. The acts they reach stand in the section of acts, not inside the wiring.

About 80 lines go. The rest becomes several readable parts instead of one function nobody reads whole.

*Data over logic, and one thing well. Reasoned, the session's; the order in which a press tries its cases is behaviour and stays as it is.*

### 4.10 The comments say why

A comment says what is not plain from the code: why it is so, and what it guards against. The story of how a decision was reached, with its dates, stands in the briefs and the history, which already hold it, and it leaves the code. About 300 to 600 lines.

*A decision documented where it is made, and once. Reasoned. The comments are written in the author's voice, so which go is his to see in the diff before it is committed.*

### 4.11 One file, or a few

[The implementation](implementation.md#7-one-file-laid-by-the-gradient) keeps the surface in one file because it is the proof of concept. It says that once the file outgrows reading by depth, each widget becomes a file of its own.

The page's script is cut out of the file by its comment headings and transpiled. Bun would bundle it from a few files as it serves the page, with no build step of its own. The parts would be the process, the substrate, the readings, the layout, the views, the acts with their gestures, and the style. A split saves no lines, but it replaces cutting by headings, which breaks on a renamed heading, with imports.

*Small parts that each do one thing. Whether it is time is the author's, since it reverses his decision of 2026-09-12. Every move above holds either way, and each is a seam a file could be cut along.*

## 5. What only the author can let go

Keeping behaviour keeps some that exists only because of how the code grew. Each would simplify further, and each is the author's to let go or keep:

- **A phone kept by the areas.** A phone could be laid from the row as a narrow screen, instead of from the five areas the row superseded. That would make the areas go as data too, but it changes a phone.
- **The figures beside a map on a screen just too narrow for the prose's gutters.** They stand there today only because the areas fit them there.
- **Settings kept from before 2026-09-17.** The repairs for a fade, an area that held one name, and the areas before the row change nothing for a reader who has opened the page since.
- **The heavy tier of git's history, what each commit changed line by line.** It is served and written, but no part of the page reads it yet. [The history](history.md) plans it, so it is not dead, only waiting.

*Seen in the code, 2026-10-01; each is unanswered.*

## 6. How the behaviour is kept

Nothing a reader sees or does may change, and that is shown, not argued.

A harness drives the page in a browser through scenarios. It runs at several widths, in both themes, with a pointer and with a finger, and in both worlds. It covers:
- arriving, scrolling, folding, scoping, following links and undoing;
- the map and git's history;
- dragging programs, pulling gaps, the dock, the knobs and the switches;
- a phone's foot, its card and its rail;
- a reload that resumes, and the browser's back.

After every step it takes the screen as a picture, and the facts a reader could observe: the address, the settings kept, each scroll, the visible text, where each brief stands on the screen, and the markup.

The page as it stands and the page after a move are served side by side, against one frozen copy of the repository, so neither the body nor the history moves while the work goes on. The web fonts are left out, so both lay the prose in the same faces. Animations are stilled, and so is the blur behind a frosted pane.

A move is committed only when every record is equal, or each difference has been looked at and found to be only how the markup is written. The type checker passes at every step, and the process's own outputs are compared the same way: the check, the history and the written page. Then each move has a cold review, and the author looks at the page.

The harness sits outside the surface and ships nothing. The scenarios cover what they list, so a cold reviewer reads each move for what they do not.

*Measured, 2026-10-01: the page run against itself through the harness, 166 records over twelve scenarios, comes out equal. Two things had to be stilled first: the rasteriser's shade at a rounded corner, which the comparison sets aside below a few pixels, and the blur behind a phone's frosted pill, which the harness turns off on both sides. Reasoned, of the rest.*

## 7. The order of the work

Each move is one commit, after the harness, the type checker and a cold review are each clean. The removals come first, then what makes one thing one, then the world, which every later move stands on. Then the layout, the draw, the acts and the gestures.

1. What can never run goes.
2. One thing, one renderer, and one table of programs.
3. The settings as a table.
4. A world as a value, and drawing that changes nothing.
5. One layout.
6. One draw, at a few levels.
7. An act and its other hand.
8. The gestures as data.
9. The comments, shown to the author before they are committed.
10. Files, if the author wants them.

*Reasoned, the session's, 2026-10-01; the order is a cold reader's, who put what only removes before what moves.*

## 8. What this leaves open

- Whether the file becomes a few, [above](#411-one-file-or-a-few).
- Which comments go.
- Each of [the things only the author can let go](#5-what-only-the-author-can-let-go).

*Open, 2026-10-01.*
