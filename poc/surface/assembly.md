---
under: the rule
kind: brief
status: open
---

# The surface, assembled again

The surface's code has grown from 1,223 lines to 7,945 in eighteen days. Most of the growth is not new function but the same function reached twice: two worlds made by copying one state in and out, two layouts kept side by side, one thing drawn by three renderers, and what to draw again written out by hand wherever something changes.

Assembled again on the lore of building programs, the page's script keeps every behaviour in roughly a sixth fewer lines of code and up to half its comments. The larger gain is not the lines: each part does one thing that can be named, and the copying, the second layout, the second renderer and the redraw by hand have no place left to grow from.

*Open, the session's, 2026-10-01, asked by the author: "what is really the function, and how may it really be assembled", with "the foundational lore as wisdom about building programs … such as unix, functional programming" there as the sister project's principles hold it, "of course not changing behaviour", and "there must be immense simplification possible under that wisdom". Read cold three times, as a brief and against the code, until a round changed only words; each move says beneath it when it is built.*

## 1. What the program is for

A reader takes in a body of knowledge laid by the gradient, at the depth they need, and always sees where they stand in it. Beside it they can read how it came to be, git's history, laid the same way. Everything the page does serves that, and it comes to four parts, with a shell around them.

Where the page is too narrow for anything beside the prose, which may be a phone or a narrow window, the lane stands alone: that is what the code calls narrow, a width below the measure, three gaps and the least gutter, and this brief calls it so.

1. **The reading: where the reader stands.** One reading of one body: its scope, the fold of every brief, the focus, what the pointer rests on, what is selected and open on the map, and how the reader came here. Two readings stand at once, the body's and the history's, and the reader's settings stand beside them.
2. **The views: what they see.** The prose, the canvas and the figures. Each is a projection of one reading, drawn from it and from what the shell has measured of the page.
3. **The layout: where each view stands.** It follows from the settings and the screen.
4. **The acts: what a key, a press or a drag changes.** An act changes a reading or a setting, and the page is drawn again from them.

Around the four stands the shell, which holds what is neither a reading nor a setting. Some of it is what the browser has laid out: where the prose's ends fall, how the map was fitted to its pane, how much room the gutters hang below the lane. The rest is what is under way: a drag in progress, a key held, a move still scrolling to its place, the history being read, a timer waiting. A view draws from a reading, and where it must know what the browser laid out, it measures that after drawing and keeps it in the shell.

The process that traces the body and the history and serves the page is apart from all four, and already in good order.

*Reasoned, the session's, 2026-10-01, from the whole file read through; that the surface is for reading a body at the depth one needs is [the surface's own](README.md).*

## 2. What the code is now

The file has three parts.

- **The process**, 984 lines of code. It stands in the order the lore asks: the substrate's types first, pure functions beneath them, and the effects at the edge.
- **The page's script**, 4,069 lines of code and 1,374 of comment, besides the substrate's 160 lines, which the process and the page share.
- **The style**, 700 lines.

The pilot's script was 915 lines of code in all.

The type checker finds two unused names, so the weight is not dead code. It is the same thing done more than once:

- **A world is copied, not held.** The history's reading is made by copying twenty-one fields of one global state, and the elements it is drawn in, out to a record and the other world's in, and back when done. A copy held across a nested call goes stale, and a helper was added for each case found. Of the cold reviews' faults in the two worlds, at least three were stale copies or a shared global left behind.
- **Two layouts.** Wide, the page is the row laid by hand. Where the lane stands alone it is still the five areas the row superseded, with their own grid, wing drawing, slots and fitting. The wide row is translated back into the areas' terms so the rest can ask the old questions, which it does through `fits()` 32 times and `narrow()` 45. The settings keep both arrangements.
- **One thing, several renderers.** A commit's line is drawn three times, and so is the line of acts beneath a brief. A figure's slot is drawn by the stacks and again by the wings. The programs are described by five overlapping tables.
- **What to draw again, by hand.** About eighteen places each draw again a hand-picked part of the page. Some drawing also changes the reading: drawing the map decides what is selected and open.
- **The gestures in one function.** One function of 594 lines wires 25 listeners. A press is a chain of some thirty cases, and the acts it reaches are spread through it.
- **Dead paths.** Some code can never run: the gutters where the lane stands alone, which the width forbids; an act nothing calls; knobs that no longer exist; and style for markup no longer drawn.

The comments carry the dated story of many decisions, which [the briefs](implementation.md) and [the repository's record of its commits](../../history.md) already hold.

*Measured, the session's, 2026-10-01, of the code as it stood at commit 25ee761, by reading and by count; the faults by the reviews of 977f285, 1a54efb and f927248.*

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

One part of the shape is not taken: the update here changes the reading in place rather than giving a new one. A reading is one object that a few hundred functions read, the undo already keeps the reading as it stood before each change, and a new reading at every scroll would be a copy made to be thrown away.

*Reasoned, carried from the Elm architecture as Czaplicki described it, 2012 onward; not checked. Not taking the new model at each update is the session's.*

### 3.4 The sister project's principles

The author holds these, and every move is weighed against them:

- **Simplicity and coherence.** The simplest way that meets the need, and one pattern for one kind of thing.
- **Dumb is smart.** Plain repetition beats a clever abstraction, and few abstractions beat many. So it stays vanilla TypeScript, with no currying and no piping; that it also takes no framework is [the surface's own decision](implementation.md#8-plain-functions-before-a-framework).
- **Describe over instruct, and data over logic.** A table of cases rather than a branch for each.
- **Pure functions, effects kept apart, one thing well.** Large things are composed of small ones.
- **A single source of truth.** Flat, normalized data, derived when needed, flowing one way.

From the project's rules, three more apply here: code documents itself where it can, a single line tells the story behind a solution where it would otherwise be overrun, and nothing fails silently.

*Preferred, the author's, carried from the sister project, the first five from its principles and the last three from its rules; not checked here.*

## 4. How it is assembled

Each move keeps every behaviour, names the principle it serves, and says roughly what it removes. Together they remove about 670 to 780 lines of the page's code, and 300 to 600 of its comments.

*Reasoned, the session's, 2026-10-01; the estimates are a cold reader's, made against the code at 25ee761 and not yet measured. None of the moves is answered by the author.*

### 4.1 What can never run goes

The gutters can never stand where the lane stands alone, since that width is too narrow for them. The act that turned the lone pane to the history is drawn nowhere, since the switch acts directly. The formatting kept for two knobs that are already gone still stands. The style still holds rules for markup the page no longer draws.

All of it goes, and nothing a reader can reach changes, since none of it can be reached. With it went two unused names, two aliases, a class that only ever landed on what was hidden, and the band a figure opened over the reading kept for a wide page that never opens one.

*Simplicity. Fulfilled, 2026-10-01, in 3c3aeca: 65 lines, the harness equal and a cold review finding no change.*

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
- the elements it is drawn in;
- and, kept apart within it as the shell's, what was measured of it: its map's view and how that view was fitted, where its prose's ends fall, and the room its gutters hang.

The page holds two worlds. "The world now" points at one of them, and acting in the other sets the pointer and sets it back. Since both are the live objects, nothing is copied and no copy can go stale. A timer or a frame that waits captures the world it began in, not a copy of it.

The copying, the list of fields to copy, the helpers that patched stale copies, and the four wrappers with their different nesting rules all go. Each world's elements carry its name, so which world an element belongs to is read off the element, not reckoned; what belongs to neither, the figures, the foot and the card above it, takes the world the keys are in, as it does now. About 100 to 130 lines.

The pointer is chosen over handing each function its world as an argument. The world is read some 340 times, across most of the page's functions, and threading one more argument through all of them is the clever form of what one variable says plainly. The views still change nothing: they read only the world now and the shell. What is under way across both worlds, a drag, a key held and the pointer's last world, stays the shell's and outside any world, as it is outside the copying today.

The move is mechanical but wide: every reading of the view, the ends or a world's elements becomes a reading of the world now, so the change touches hundreds of lines while it removes a hundred.

*A single source of truth, and dumb is smart. Reasoned, the session's; a cold reader preferred the argument for its purity, and that is weighed here and not taken. It supersedes the world set in the state's place of [the implementation](implementation.md#651-the-history-is-the-lane-and-the-canvas-over-a-world-of-its-own) and of [the framework's shared state](framework.md#4-one-shared-state-and-a-few-verbs), where they say so.*

### 4.4 What the map decides before it draws

Drawing the map today also decides what is selected and what stands open, and drawing a row records which column it stands in.

These cannot move out to the acts, as was first proposed, without changing behaviour. The map makes its decisions only while it stands, and what it leaves open is kept for the reader's next visit. Made with no map on the page, the same decisions would keep something different. So they stay where they are, as one named step at the head of the map's draw: the map settles what it shows, then draws it. The column a row was drawn in is a measure of what was drawn, as the lane's ends are, and is kept with the shell's measures.

This removes no lines. It makes plain the one place a view decides anything.

*Unidirectional flow, as far as keeping behaviour allows. Reasoned, the session's, 2026-10-02, while building the world; it revises the move as first proposed, which said the decisions would move to the acts.*

### 4.5 The settings are a table

The settings are the page's, apart from both worlds. Today they are checked by hand, one setting at a time. The switches already list each setting's legal values, so the check becomes one pass over that list. The dated repairs to settings kept from before 2026-09-17 are [the author's to let go](#5-what-only-the-author-can-let-go).

About 30 lines.

*Data over logic. Reasoned. A setting that is not checked today, such as the nesting line or the flick, is checked once it is in the table, which changes nothing for a value the page itself wrote.*

### 4.6 One layout, as a function of the settings and the screen

Where each program stands is computed by one pure function of four things: the settings, the screen's width and height, and whether the reader has a finger. It returns where each program stands, how wide, and which gave way. One function then places the elements, and every other part asks the layout, not the areas.

Where the lane stands alone the arrangement is not the wide row, and it stays what it is. What it needs of the settings are the pane it shows, the side its rail stands on, and the figures it has room for beside a map. Those are read from the areas as they are kept now, so a reader's saved arrangement still lays it. The areas' grid, wing drawing and slots then go, and the figures there are drawn by the same stack code as the wide page's. About 250 to 300 lines.

This is the move most likely to move a pixel. Today the grid lays the lone pane and the browser rounds, and the one function will place in whole pixels. Two fixed figures in one wing stand at its top and its foot, where a stack sets them one under the other. And the wings give way in their own order. Each such case is matched, not let go, and [the harness](#6-how-the-behaviour-is-kept) finds any that is missed.

*One pattern for one kind of thing, and pure functions. Reasoned, the session's; the lane alone exactly as it is today. It leaves [the framework's five areas](framework.md#2-the-areas) standing only as what the lane alone keeps, and says so there.*

### 4.7 One draw, at a few levels

An act changes a reading or the settings, and never draws. When it is done, the shell draws the page at one of a few named levels:
- **all**: the layout, both proses, the map and the figures;
- **the lanes**: both proses and the map;
- **the figures**;
- **the light**: what is lit.

A discrete act draws at all where that is fast enough, and the cost is measured first. All draws a world's prose again only where that world's reading changed, since laying a prose anew loses what a reader holds in it: a selection of its text, the focus of an element, an image already decoded, and where the browser anchored the scroll. A continuous gesture keeps its own narrow redraw, named, since a scroll, a drag or a turned knob must not lay the whole page again under the hand. The two places where one measure settles another stay explicit: the prose's ends with the shape's slot, and the gutters with the room they hang below the lane.

An act that changes a reading marks that world, and that mark is all the draw asks; there is no tracking of what depends on what, which would be a small framework. About 40 to 60 lines.

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

A comment says what is not plain from the code: in a line, why it is so and what it guards against, which is the story the sister project's rules ask for where code would otherwise be overrun. The longer story of how a decision was reached, with its dates, stands in the briefs and in the record of the repository's commits, which already hold it, and it leaves the code. About 300 to 600 lines.

*Self-documenting code, and its context in a line. Reasoned. The comments are written in the author's voice, so which go is his to see in the diff before it is committed.*

### 4.11 One file, or a few

[The implementation](implementation.md#7-one-file-laid-by-the-gradient) keeps the surface in one file because it is the proof of concept. It says that once the file outgrows reading by depth, each widget becomes a file of its own.

The page's script is cut out of the file by its comment headings and transpiled. Bun would bundle it from a few files as it serves the page, with no build step of its own. The parts would be the process, the substrate, the readings, the layout, the views, the acts with their gestures, and the style. A split saves no lines, but it replaces cutting by headings, which breaks on a renamed heading, with imports.

*Small parts that each do one thing. Whether it is time is the author's, since it reverses his decision of 2026-09-12. Every move above holds either way, and each is a seam a file could be cut along.*

## 5. What only the author can let go

Keeping behaviour keeps some that exists only because of how the code grew. Each would simplify further, and each is the author's to let go or keep:

- **The lane alone kept by the areas.** Where the lane stands alone the page could be laid from the row as a narrow screen, instead of from the five areas the row superseded. That would make the areas go as data too, but it changes the page there, a phone first among it.
- **The figures beside a map on a screen just too narrow for the prose's gutters.** They stand there today only because the areas fit them there.
- **Settings kept from before 2026-09-17.** The repairs for a fade, an area that held one name, and the areas before the row change nothing for a reader who has opened the page since.
- **The heavy tier of git's history, what each commit changed line by line.** It is served and written, but no part of the page reads it yet. [The surface's brief on git's history](history.md) plans it, so it is not dead, only waiting.

*Seen in the code, 2026-10-01; each is unanswered.*

## 6. How the behaviour is kept

Nothing a reader sees or does may change, and that is shown, not argued.

A harness drives the page in a browser through scenarios. It runs at several widths, in both themes, with a pointer and with a finger, and in both worlds. It covers:
- arriving, scrolling, folding, scoping, following links and undoing;
- the map and git's history;
- dragging programs, pulling gaps, the dock, the knobs and the switches;
- a phone's foot, its card and its rail, and a narrow window with a pointer;
- a reload that resumes, and the browser's back.

After every step it takes the screen as a picture, and the facts a reader could observe: the address, the settings kept, each scroll, the visible text, where each brief stands on the screen, the markup, the selected text and the focused element. It also records how much of each prose survived the step unrebuilt, so a draw that lays a prose anew where it did not before shows, though the picture is the same.

The page as it stands and the page after a move are served side by side, against one frozen copy of the repository, so neither the body nor the history moves while the work goes on. The web fonts are left out, so both lay the prose in the same faces. Animations are stilled, and so is the blur behind a frosted pane.

A move is committed only when every record is equal, or each difference has been looked at and found to be only how the markup is written. The type checker passes at every step, and the process's own outputs are compared the same way: the check, the history and the written page. Then each move has a cold review, and the author looks at the page.

The harness sits outside the surface and ships nothing. The scenarios cover what they list, so a cold reviewer reads each move for what they do not.

*Measured, 2026-10-01: the page run against itself through the harness, 166 records over twelve scenarios, comes out equal. Two things had to be stilled first: the rasteriser's shade at a rounded corner, which the comparison sets aside below a few pixels, and the blur behind a phone's frosted pill, which the harness turns off on both sides. Reasoned, of the rest.*

## 7. The order of the work

Each move is one commit, after the harness, the type checker and a cold review are each clean. The removals come first, then what makes one thing one, then the world, which every later move stands on. Then the layout, the draw, the acts and the gestures.

1. What can never run goes. *Built, 3c3aeca.*
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
