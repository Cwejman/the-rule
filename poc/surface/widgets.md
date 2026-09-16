---
under: the code
kind: brief
status: in force
---

# The widgets

## 1. What every widget keeps

Every shape is computed from the substrate and none is invented, because a picture a reader cannot trust is worse than no picture at all. What the widgets share beyond that is the rules beneath, and keeping them is what makes six drawings one family.

*Reasoned, 2026-09-13, carried whole from the first model's figures.*

### 1.1 Nothing is drawn too small to read

Every figure has a floor, the smallest cell a pointer can hit and an eye can place, and rather than shrink through it a figure shows less: it merges what it cannot draw into one cell and marks that the cell holds more.

That is the gradient turned on a picture, and it is [the design language's rhythm floor](https://github.com/Cwejman/OpenLight/blob/main/@md/spec/design.md#rhythm--depth-derived-never-stated-twice) met in a figure instead of in a layout. A figure that is for the whole body may go beneath the floor, and says so where it is described.

*Reasoned, 2026-09-13.*

### 1.2 No figure mixes its two sizes

A brief has two sizes: its own prose, which is what stopping to read it costs, and that prose with everything beneath it, which is what the branch holds. A row shows at most the first, and a figure of branches, one that draws the levels beneath a brief, shows the second.

*Reasoned, 2026-09-13.*

### 1.3 An image is never passed off as prose

Wherever a figure draws a brief's blocks it draws an image as a frame, where a paragraph is a filled block, and the caption beneath the image as the text it is. A figure that draws blocks as [the lane](lane.md) presents them draws the image at the size it is presented, since a figure that scrubs the lane has to stay true to it, and a figure that weighs a brief weighs its images [as the weight setting says](#62-the-switches).

*Reasoned, the author's, 2026-09-14.*

### 1.4 One brief is lit wherever it is drawn

Every widget draws the same briefs from the same sizes, so the brief highlighted, [the focus or the one under the pointer](lane.md#4-where-you-are-is-the-brief-in-focus), lights in all of them at once. Where a figure has merged past the brief being pointed at, the cell holding it is lit instead.

*Reasoned, 2026-09-13.*

### 1.5 Ink is spent only where a reader has asked

No widget repeats what is in view, and a mark is spent in proportion to how live the fact behind it is, which is [the design language's measure](https://github.com/Cwejman/OpenLight/blob/main/@md/spec/design.md#the-graduated-scale--one-mark-per-live-fact). Colour says only where in the body a thing sits, by the branch it stands under.

*Reasoned, 2026-09-13.*

### 1.6 One tooltip, beneath the pointer

A cell in any figure, a step or a cell of the way down, an icon on a strip, and a link in the lane when no gutter tells of it, each says what it is a moment after the pointer rests on it: for a brief, its path drawn as the way down draws one, then its name, and for a link the opening words of its face.

It is one element on the page's own ground, never under the pointer, and it goes with any scroll or press. Where it would hide what is looked at it moves aside: beside a figure, on the side nearest the lane and level with the cell, since a tooltip over the shape covers the very cell pointed at; beside a node on the canvas, past its ports; and beneath anything else. The ahead keeps naming its pointed cell beneath the figure as well.

*Reasoned, the author's ask of 2026-09-15; [an overlay that repeats what is in view](refused.md#j-an-overlay-at-all) stays refused, and this tells only what is not in view.*

### 1.7 A key stands as a badge where its act stands

An act the reader can take stands on the page as a badge: its key drawn as a cap, and what the act does beside it in a word. It stands where the act's object stands, [on the brief's own line](lane.md#61-the-action-line-is-the-press) or on the strip it moves, so a reader meets the few acts that are at hand rather than a bar of every act there is.

The keys are drawn rather than set in type, since a shift, a return and an arrow taken from three faces sit at three heights and no two weigh the same. Each is one path in one box, so a row of caps reads level. Where the room is tight the badge is its keys alone, since a badge that stands on the very thing it acts on has its place to say what it does, and two acts that share a modifier stand as one unit with the modifier drawn once, so a pair reads as the pair it is.

Beside a brief the cap says how that brief is reached. On the brief the reading line stands on it shows the key, since that is the brief a key acts on; on every other it shows the pointer, which is the only way to that one. The two take the same room, so no line shifts as the reading moves.

A badge that cannot be taken now keeps its room and goes quiet, so a row never shifts under the pointer. Pressing one does what its key does, and [the tooltip](#16-one-tooltip-beneath-the-pointer) tells the rest: what the act does, what the same key with shift does, and the other ways to the same thing.

Where there is no key to draw, the badge carries the word alone, which is [its third grade](touch.md#7-a-badge-without-a-key).

*The author's ask of 2026-09-16, that every act a key fires be visible where it makes sense; the glyphs drawn rather than set, the author's ask the same day.*

## 2. The tree

The tree is a [wing](framework.md#2-the-areas) widget: the lane as an outline, one row per brief in the lane, each nested under its parent, unfolded where the brief is whole. It is not a second state: folding a row folds the brief in the lane and unfolding one unfolds it, so what the tree shows is exactly what the lane holds, and a reader folds a whole region from the tree without scrolling to it.

Pressing a row's name goes to the brief. A line lies across the highlighted row and glides as the highlight moves. The wing scrolls only to keep the focus in view, driven by the lane and never free.

When the lane is [scoped](lane.md#7-scoping-the-lane), the levels above stand as dim rows over the root, each a way out.

*Reasoned, the author's, 2026-09-13; [columns of siblings](refused.md#o-the-path-as-columns-of-siblings-stacked) and [a tree with an unfolding of its own](refused.md#u-a-tree-with-an-unfolding-of-its-own) were built first and refused. It does not stand on a phone, where it [read poorly whole](touch.md#42-the-outline-and-the-radial-are-not-ready-for-a-finger), 2026-09-16.*

## 3. The shape

The shape is the left wing's first widget: the lane as laid, drawn small, so the reader sees the shape of the prose and the nesting it stands in at once, and fold state shows as length.

Each brief in the lane stands as its blocks, a heading a short bar and a paragraph a block as tall as it is drawn, shifted right by the brief's depth. Every block a brief has is drawn, a list or a table as readily as a paragraph, and an image as a frame as wide and as tall as it stands in the lane.

Where every other area has given way it stands narrow, as [the rail](touch.md#5-the-minimap-is-a-rail-not-a-mode), nesting a step tighter and giving its marks whatever room each row has left.

*Reasoned, the author's, 2026-09-13, from the wish for a minimap that moves the briefs and their paragraphs right and left by where they stand in the nesting; the rail, 2026-09-16.*

### 3.1 A folded brief tells what it hides

Beside its face a folded brief carries a grey tick for every paragraph and a small grey frame for every image, as many as the room beside it holds, then, where a level lies beneath, a grey tail as long as that level is heavy. So a reader sees at a glance where the lane is folded, whether paragraphs or levels wait there, and how much.

*Reasoned, the author's, 2026-09-13.*

### 3.2 The levels above the scope

When the lane is scoped, the levels above the scope stand to the left of the opening's row, a grey tick per ancestor, outermost leftmost, and each is a press that scopes out to that level, as the ticks to the right are what a fold hides.

*Reasoned, the author's, 2026-09-13.*

### 3.3 The viewport scrubs the lane

The viewport, the part of the lane on the screen, is drawn over the shape as a shaded band, and dragging it scrubs the lane, so the shape is also the way to move fast through a long body.

*Reasoned, the author's, 2026-09-13.*

### 3.4 Two presses, read from where they land

A brief has two presses, and what a press does is read from where it lands, so no modifier key is needed. Its blocks go to it. The room to their right, where its ticks and tail stand when it is folded and nothing stands when it is unfolded, folds or unfolds it, and folding from there never scrolls the lane.

The room reaches only as far as the marks do, and keeps to its own row, since rows touch and a room reaching into its neighbour would light one row while pointing at another. A row thinner than six pixels is given six there, so it can be hit.

Pointing at the room points at the brief, so [the ahead](#4-the-ahead) shows what the brief hides before the press unfolds it, and the brief lights elsewhere as it would. In the shape itself its blocks stay unlit and only the marks answer: over a folded brief its ticks and tail light, and over an unfolded one they show as a grey ghost of what a fold would hide. So resting on the room reads apart from resting on the blocks.

Neither press is there under a finger, where [the rail takes none](touch.md#53-the-rail-takes-no-presses) and is scrubbed instead.

*Reasoned, the author's, 2026-09-13; the room pointing at its brief, 2026-09-14, so the ahead previews a fold from there too; the rail without presses, 2026-09-16.*

## 4. The ahead

The ahead is the right wing's first widget: what the highlighted brief hides. It answers for the focus, or for the brief under the pointer, whenever that brief is folded and hides something, paragraphs beyond its face or a level beneath, and it draws nothing at all when the brief is whole, since then the reader can simply read on.

*Reasoned, the author's, 2026-09-13; built first [as an icicle](refused.md#s-the-ahead-as-columns-by-depth), which the author narrowed to what is not in view.*

### 4.1 It draws in the shape's form

It draws [as the shape draws](#3-the-shape), so a reader learns one figure and not two: first the brief itself with the paragraphs its face hides, then everything beneath it, each brief a heading bar and its paragraphs as blocks, shifted right by nesting. So unfolding a brief that is only more paragraphs is understood as exactly that, before it is pressed.

No names are drawn in the cells; the cell under the pointer is named beneath the figure, and above it the brief whose hidden part is drawn is named by its whole path, since the path is its address. The figure is only as large as what it draws needs, and it keeps its root while the pointer moves within it, so it does not redraw under the pointer. Pressing a cell goes there, which unfolds it.

*Reasoned, the author's ask of 2026-09-13.*

### 4.2 A ladder down when it does not fit

Where what it draws is too large for its paragraphs to stay legible it steps down a ladder that never loses the structure.

First, one block per brief, its own size, with every brief still in place. Where that still does not fit, the deepest level is dropped and the brief that held it carries a grey tail as long as the dropped level is heavy, [as the shape marks a fold](#31-a-folded-brief-tells-what-it-hides), until what is left fits. The caption says which step it stands on.

*Reasoned, the author's, 2026-09-13; [a step that merged a whole level into one block](refused.md#v-a-level-merged-into-one-block) was refused.*

## 5. Links

Links is the right [gutter's](framework.md#2-the-areas) first widget. Beside each link in a brief, on the link's own line, it tells the target: where it stands, its whole path drawn as the way down draws one, then its title and the opening words of its face, or that it leads out of the body, or that the brief is not yet written.

The link itself is underlined in its target's branch hue, so the colour says where a link leads before it is pointed at. At the brief's foot it tells what points at the brief. Pointing at any of them lights the target wherever it is drawn, and pressing goes.

This is what lets looking be free without [an overlay](refused.md#j-an-overlay-at-all). Everything an overlay told about a link now stands beside the link, and everything it told about a brief stands in the lane or in the wings.

As the width tightens [the gutter narrows](framework.md#25-giving-way) rather than moving anywhere, so what stands beside a link stays beside it, and only the opening words are cut shorter to keep the column a column.

*Reasoned, the author's, 2026-09-13; the narrowing the author's ask of 2026-09-16, which retired a figure that carried these into the wing as a list for the brief in focus.*

## 6. Settings

Settings is a wing widget that edits [the settings](framework.md#5-settings-are-data-and-a-figure-edits-them) by eye against real prose, since the page redraws as a value changes. It is meters for what has a range and switches for what has a few values.

*Reasoned, the author's, 2026-09-13; [a dial](refused.md#w-a-dial) was built first and refused.*

### 6.1 The meters

Each meter is a 270 degree arc with rounded ends, the value drawn in a warm red over a faint track, its icon in the middle, and its name and value told on pointing. Dragging a meter up or down turns it and the wheel steps it. A drag turns a meter in place and never redraws the wing under the pointer.

The first row sets the type: the zoom, the heading ratio, the line height and the measure. The second sets the page: the gap, the dim and the edge fade. The space beneath a heading grows with the heading, so a larger ratio opens the room between a heading and its prose as well.

*Reasoned, the author's, 2026-09-13.*

### 6.2 The switches

Each switch is a setting's name and its few values, a row apiece. The theme is light, dark, or whatever the system is set to, which is where a reader starts; how the two themes are composed is [one palette with two sides](implementation.md#64-one-palette-two-sides). The reading line stands [at the middle or easing to the ends](lane.md#41-where-the-reading-line-stands). [The flick](lane.md#66-the-flick-a-trial) is on or off.

The ahead answers for a brief that hides something, or always, for any highlighted brief with anything beneath it, so a reader may preview every level as they move. The weight is cost or experience: what a brief weighs in the tails and the plate. Cost is its text alone, which is what reading it costs and where a reader starts. Experience counts its images as well, as the text that would fill their room at the default measure.

*Reasoned, the author's asks of 2026-09-13 and 2026-09-14.*

### 6.3 The faces

Two of the switches set a face for the headings and one for the prose, each serif, sans or mono, so a reader who wants the prose quieter can keep the serif on the headings alone.

A face is sized to the serif's x-height, the height of its small letters, and the sans a step past it, since its narrower, lighter letters still read smaller; the lines keep the serif's spacing whichever face is set. So changing a face never changes how large the text reads or how far apart its lines stand.

*The author's ask of 2026-09-13. Measured in the browser: sans and mono stood about seven percent taller than the serif at one size. Preferred: the sans read small at that match, on the author's reading, and was lifted four percent by eye.*

## 7. The plate

The plate is a wing widget: the body whole in one square, drawn as droplets on a round plate. The root sits at the centre, its briefs are droplets around it, and each carries its own smaller droplets further out, level by level to the rim. The path to the focus and the focus are marked on it as everywhere, and what is folded out of the lane is grey at every depth.

*Reasoned, the author's, 2026-09-12, carried from [the first program's figures](README.md#10-what-was-tried-and-refused). It does not stand on a phone, where [no finger can land on a cell that small](touch.md#42-the-outline-and-the-radial-are-not-ready-for-a-finger), 2026-09-16.*

### 7.1 Droplets meet without merging

Each droplet is cut by its neighbours where they meet, so the plate is shared by what each brief [weighs](#62-the-switches), and a droplet stays compact however small it gets, where [a rectangle's cells degenerate](refused.md#f-a-rectangle-dividing-into-rectangles). Pressing a droplet goes there, and pressing with the modifier key held, command or control, folds or unfolds it in place, since a droplet has no room beside it for a second press.

*Reasoned, the author's, 2026-09-12.*

### 7.2 Every level draws to the rim

Every level draws to the rim, however small its droplets, since the plate is for the whole topology and a level left undrawn defeats it. This is the one figure that goes beneath [the floor](#11-nothing-is-drawn-too-small-to-read): a crowded level goes to slivers rather than away.

*Reasoned, the author's ask of 2026-09-13, after a plate that stopped two rings out.*

### 7.3 The figure is cut to what it draws

A body whose levels fill one side of the plate leaves the other empty, and that room is not kept, so the plate stands as wide and as tall as it draws.

*Reasoned, the author's, 2026-09-13.*

## 8. The keys

The keys is a wing widget: every act with the key that fires it, grouped by what each works on, the brief, the scope, the reading and the lane. Most acts stand as [a badge where their object stands](#17-a-key-stands-as-a-badge-where-its-act-stands); the arrows that move the reading have no object on the page, and this is where a reader meets them.

It answers for the focus, so what the space bar would do now is what it says, and an act out of reach stands quiet in its place. Every badge in it is pressable, and each tells what it does on pointing, so it is the help as well as the list.

*The author's ask of 2026-09-16, that every act available as a shortcut be visible somewhere; a figure rather than an overlay, since [an overlay stays refused](refused.md#j-an-overlay-at-all) and a figure is one function and one name. Whether it earns its place once the badges stand where the acts are is open.*
