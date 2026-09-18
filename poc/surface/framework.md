---
under: the rule
kind: brief
status: in force
---

# Five areas, and what stands in them

The lane is one of five areas in a row: a wing, a gutter, the lane, a gutter, a wing. The gutters hold what stands beside a brief, aligned with it and scrolling with it. The wings hold figures, the widgets that draw [the body](README.md#2-what-it-is-handed) and stand on their own. A reader chooses what each area shows from a light row of icons at its foot, and settings are a figure like any other.

That is a small framework, kept small on purpose. It is what lets a new drawing be tried by adding one function, and what keeps every drawing in step, since all of them read one shared state and act through the same few verbs.

*Reasoned, the author's, 2026-09-13.*

## 1. Three kinds of widget

A gutter, a wing and the middle want different contracts, and naming the difference is what keeps every widget small.

An adjunct stands in a gutter. Given a brief in the lane, read from the shared state, it returns what should stand beside that brief, aligned with it and scrolling with it: a link's target beside the link's own line, what points at the brief at its foot, and later a commit or a person. It never draws the body.

A figure stands in a wing. Given the body and the shared state, it returns a drawing that stands on its own: the tree, the shape beneath the focus, the lane as laid, the body whole. It never touches the prose.

A pane stands in the middle, and there are two: the lane, which is the reading, and [the canvas](canvas.md), which is the scope as nodes. Each draws itself from the shared state through its own functions, and both act through the same verbs.

*Reasoned, the author's, 2026-09-13; the pane 2026-09-15.*

## 2. The areas

Each area is as wide as what it holds and no wider, and no ink stands around any of them, no boxes, no borders, the flat page [the design language](https://github.com/Cwejman/OpenLight/blob/main/@md/spec/design.md#why-flat--the-newspaper-precedent) asks for. So the page is the prose and what orients it, and nothing else asks for the eye.

![A row of five areas across the page: a narrow wing on the left holding small bars and blocks with a shaded viewport over them, an empty gutter, a wide lane of grey prose lines with one coloured link in its third line, a gutter holding a short note level with that link, and a narrow wing on the right holding bars and a framed block; a thin rule beneath each area and its name under the rule, lane in bold](.img/areas.svg)\
The five areas as they stand by default: [the shape](widgets.md#3-the-shape) in the left wing, the left gutter empty, the lane, [the links](widgets.md#5-links) beside the lane's link in the right gutter, and [the ahead](widgets.md#4-the-ahead) in the right wing.

*Reasoned, the author's, 2026-09-13.*

### 2.1 Widths

The lane keeps its measure, the width of its line of text, which is a setting. The gutters are wider than an editor's gutter, since what stands there is read, and they take the room the wings have left them rather than a width of their own: as wide as an adjunct reads best in where there is room, narrower where there is not, and out as a pair below the least it still reads in.

A wing is as wide as the widest figure it holds, and every figure declares a width that never changes with what it draws, so nothing beside it moves as it redraws. A wing's [strip](#3-the-strip) is free to reach a little past it into the space beside.

*Reasoned, the author's asks of 2026-09-14.*

### 2.2 The spaces between are one

No area carries room it does not use, so the spacing is the spaces between them, and those are one: the space at either edge of the viewport is the space between a wing and the lane.

The gap setting is the least a space is given, and what the width leaves over is shared among the spaces evenly. The gutters are the exception to the sharing, standing exactly a gap from the lane, since what stands in them is aligned to its lines.

*Reasoned, the author's ask of 2026-09-14, when a lone wing was seen standing further from the edge than the lane stood from the other.*

### 2.3 A wing's figures reach as far as the prose

Vertically a wing's figures reach no further up or down than the prose does. They stand between the middles of the lane's fades at its top and its foot, so they follow [the fade setting](#5-settings-are-data-and-a-figure-edits-them), keeping at least a gap at the top and the strip's room at the foot, with one gap between two figures.

*Reasoned, the author's, 2026-09-14.*

### 2.4 Closing by hand

Any area empties by hand, from [the strip](#3-the-strip), where a widget is cycled off the side that held it. An area holding nothing takes no room at all, and the strip stands where it always stands, so the area fills again from there.

*Reasoned, the author's, 2026-09-13; the cycle, 2026-09-16.*

### 2.5 Giving way

As the screen narrows the areas give way in one order: the canvas first, when it stands beside the lane, then the gutters as a pair, then the right wing, then the left, until the lane stands alone.

A gutter narrows before it gives way, and comes back when a wing gives way and frees its room, since a narrower gutter is still a gutter, aligned to its lines and scrolling with them.

An area given no room is gone from the row until the screen widens, and [its icon says so](#31-four-grades-of-ink) rather than leaving the foot.

The order has one exception at its end, and it is written where it was found: where the lane would stand alone, [a touch reading](touch.md#9-what-this-asks-of-the-framework) keeps one narrow figure beside it, the shape as a rail.

*Reasoned, the author's, 2026-09-13; the canvas first, 2026-09-15, since the lane is the reading. The exception is a trial, 2026-09-16, and waits on the author's word before it is written in here.*

### 2.6 What an area holds

A wing holds up to two figures, one at its top and one at its foot. A figure of fixed size, [the plate](widgets.md#7-the-plate) or [the settings](widgets.md#6-settings), takes only the height it needs; a figure that grows, the shape, [the tree](widgets.md#2-the-tree) or the ahead, takes what is left, shared evenly when both grow. A gutter holds one adjunct. Nothing nests further, splits, or is dragged.

*Reasoned, the author's, 2026-09-13; the second figure the author's ask of 2026-09-14.*

### 2.7 The middle holds one pane or two

The middle holds the lane, the canvas, or both, the canvas at the left and the lane at the right, and it is never empty: its strip toggles a pane, and the last one cannot be taken away.

With both standing, the lane keeps its measure and the canvas takes what is left, no narrower than a floor and no wider than a setting, its greatest width, so a wide screen keeps its space around the row. The gutters belong to the lane and stand only beside it, so no gutter ever stands beside the canvas, and the wings do not care what the middle holds.

*Reasoned, the author's, 2026-09-15, so that the three cases, the lane, the canvas, or both, are one rule and nothing is tiled.*

## 3. The strip

One row of icons stands at the foot of the page, centred, holding every choice once: the panes first, then the adjuncts, then the figures, three groups spaced apart by room alone. A reader's question at the foot is one question, what stands around the reading, so it is asked in one place rather than in five.

An icon cycles when it is pressed: nowhere, the left, the right, nowhere again, so one icon carries both whether a widget stands and which side holds it. A side the width cannot hold is stepped over rather than offered, so a press never sends a widget where it would not stand, and what the next press will do is said on pointing. A pane toggles instead, since the middle holds its panes in one order and the last one cannot be taken away. A widget in use carries a dot beside its icon, at the side that holds it and level with the middle of it, so the row shows the whole arrangement at a glance.

The row stands where the middle stands, which is always, so no choice is ever out of reach at any width.

*Reasoned, the author's decision of 2026-09-16, from a survey of [the row per area](refused.md#x-a-row-of-icons-at-the-foot-of-every-area) across eighteen widths and seven configurations.*

### 3.1 Four grades of ink

The row is light at rest, so the page stays the prose and what orients it. Four grades say what a reader may do: what cannot stand at this width is quietest, what can stand is light, what the pointer rests on is darker, and what is in use is darkest.

Every choice is always drawn, so the row never changes length as the screen does, and one that cannot be had says why on pointing. The whole row lifts a step while the pointer is on it, so what is out of reach is still seen by whoever looks for it. A widget the reader has asked for that the width denies stands between the two grades, since the choice holds and only the room is missing.

*Reasoned, the author's asks of 2026-09-16.*

## 4. One shared state, and four verbs

Every widget reads one state and nothing else, and acts through the same four verbs. A widget is a plain function in a table keyed by its name, and adding one is adding a function and a name.

The state is the body and its index of [addresses](implementation.md#32-the-address-is-the-path-of-titles), the address in focus, the address the pointer rests on, the scope, the grade of every brief in the lane, and the settings. The verbs are to go to an address, to point at one, to fold one, and to scope to one, [making it the root of the lane](lane.md#7-scoping-the-lane).

Everything drawn that names a brief carries that brief's address. That one convention is what keeps the widgets in step: pointing at a brief in any of them lights it in all of them, and pressing it anywhere goes.

*Reasoned, carried from [the first program](README.md#6-the-programs-before-this-one), 2026-09-12.*

### 4.1 Every act is one entry in one table

A key has to be named where it is drawn as well as where it is pressed, so the acts a reader can take are a table as the widgets are: each entry gives the chords that fire it, what it is called, the sentence that helps, the other ways to the same thing, and the doing. The keys are wired from it, [the badges](widgets.md#17-a-key-stands-as-a-badge-where-its-act-stands) are drawn from it, and adding an act is adding an entry.

An entry also says whether its act can be taken at all, so a badge for an act out of reach goes quiet rather than vanishing, and a key that would do nothing does nothing. And an act works on an address: the one a badge beside a brief passes, or, from a key, the focus, which is the brief the reading line stands on.

*Reasoned, the author's ask of 2026-09-16, when the keys were named nowhere but in the branch of code that fired them.*

## 5. Settings are data, and a figure edits them

The settings are one object of values. They apply as style variables and layout facts, and they live in the browser's own storage, never in the address. A figure edits them, [the settings widget](widgets.md#6-settings), which is a wing widget like any other.

The type: the zoom on the prose, the ratio by which each heading register grows over the body, the height of the prose's lines, and the lane's measure. The page: the gap between areas, the dim on every brief but [the highlighted one](lane.md#4-where-you-are-is-the-brief-in-focus), and the fade at the edges. The reading: where the reading line stands, the flick, and the weight, each [as the lane gives it](lane.md#4-where-you-are-is-the-brief-in-focus). The look: the theme, the face of the headings and the face of the prose. And the widget of each area, which by default is the shape in the left wing, nothing in the left gutter, the links in the right gutter and the ahead in the right wing.

*Reasoned, the author's, 2026-09-13; that headings scale by depth departs from [the design language's register rule](https://github.com/Cwejman/OpenLight/blob/main/@md/spec/design.md#rhythm--depth-derived-never-stated-twice), at the author's ask.*

## 6. What this is a small copy of

[The pilot's view layer](https://github.com/Cwejman/OpenLight/blob/main/@md/spec/view.md) has components, mounts, one context handed to each, and an offer flowing down the tree. This framework is that in miniature, and it stays dumb on purpose, so that it never grows into a second one. What it finds is recorded as findings for that layer rather than built here.

*Reasoned, 2026-09-13.*
