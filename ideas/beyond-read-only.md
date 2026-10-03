---
under: the rule
kind: brief
status: open
---

# Beyond read-only

The pilot is read-only, and that is its biggest problem: it does not compute yet. This thread holds what would take it past that, in one place: work written around what it is about, as comments are, a simple store whose requirements are the centre, and a reading that brings its aspects in from the edge. Nothing here is built, and the surface is not touched until it is asked for.

*The author's, 2026-10-04, from [the day's thinking](../author/ideas-2026-10-04.md); open. Where the session proposed, the section says so.*

## 1. Work stands around what it is about

What if all the work done on knowledge is placed the way comments are placed on a post, around what is worked on, and the context a model runs on includes the comments? A comment is the smallest write: it leaves what it stands on whole, so the pilot can stop being read-only without anything being edited.

*The author's, 2026-10-04, [prompts 2 and 7](../author/ideas-2026-10-04.md#2-work-stands-around-what-it-is-about-like-comments); the last sentence the session's.*

### 1.1 It was sketched once, and the read-only step came first

[OpenLight's sketch of comments on holons](https://github.com/Cwejman/OpenLight/blob/main/@md/sketches.md#comments-on-holons), 2026-09-04, said the same, and its smallest build was a read-only list of holons. That step was taken, and is near what the surface became; the comments never followed. The pilot's own [order of work](https://github.com/Cwejman/OpenLight/blob/main/@md/spec/pilot.md#build-order) put writing last as well.

*Seen, 2026-10-04, in OpenLight; the session's.*

## 2. The requirements are the centre, and a simple store meets them

A common store, all of one's files in one suite, is a monolith. What is needed instead is a set of requirements on the data layer that let it be joined to other data layers, made the way MCP is made for AI, so that our own store is shipped and another, someone's custom GPT, Google Drive, git, is joined to it as master or as slave. Nobody is locked in or out.

Git and folders are not kept for their own sake: since compute is needed anyway, a simple store will do, with typed data allowed.

*The author's, 2026-10-04, [prompts 5 and 10](../author/ideas-2026-10-04.md#5-our-own-data-layer-which-locks-no-one-in-or-out).*

### 2.1 Most of that store exists

[OpenLight's db](https://github.com/Cwejman/OpenLight/blob/main/db/src/schema.sql) is 87 lines of SQLite: commits, branches, versioned chunks and placements. What was heavy was what stood on it, the engine, the VM and the chassis. OpenLight's [integrations](https://github.com/Cwejman/OpenLight/blob/main/@md/horizon.md#integrations--external-systems-projected-into-the-type-system) read the other way from this: its own store at the centre, the others mapped in.

*Seen, 2026-10-04; the session's.*

### 2.2 A first draft of the requirements

- **A piece** has an address and a typed body.
- **A connection** joins two pieces; a comment is a piece connected to what it stands on.
- **A write** is a commit, saying who and when.
- **A read** can be made as of any moment.
- **The joining** is read, write, history and watch, the same whichever side is master.

*Proposed, the session's, 2026-10-04; not answered.*

## 3. The cycles don't stop

Work, comments, a model's run and the change they lead to come round again and never end. So time comes first: a comment points at the moment of what it was about as well as the place, and a model is handed what is still open at the moment of asking, not all that was ever said.

*The author's, 2026-10-04, [prompt 8](../author/ideas-2026-10-04.md#8-the-cycles-dont-stop), the first sentence; what follows is the session's.*

## 4. Reading by aspects

Big type with less space between, mellowed and activated text, heading to heading in bold in the middle, and a splash of visualisation. Around it the aspects of the reading, where I am, this level in its order, a thread being followed, each small at the edge or toggled into the middle, where it shows the same headings bigger with more filled in beside them. Where I am shows what links to here and to the holarchy I stand in. Navigation may be adding and removing markers in a query filter.

*The author's, 2026-10-04, [prompt 9](../author/ideas-2026-10-04.md#9-big-type-and-the-aspects-come-in-from-the-edge).*

### 4.1 The reading and the store are one model

A marker is a place, as a read in OpenLight is an intersection of places: one added narrows the middle, one removed widens it. An aspect's sizes are the grades OpenLight's agent already gives, name, summary and body. So the reading and the store are the same model: places, markers, and how much of each is shown.

*Proposed, the session's, 2026-10-04; not answered.*

## 5. What is open

- Whether the harness comes in now, held lighter than OpenLight held it.
- Where the requirements are written: as OpenLight's, as the rule's, or as a project of their own.
- What the first other platform joined is, and on which side.
- Whether a comment folded into what it stood on retires, and how the trail still shows it was said.

*Open, 2026-10-04.*
