---
under: the rule
kind: brief
status: open
---

# A store with its requirements at the centre

What stands at the centre is not a store but what is asked of one. A simple store of our own is shipped first, and any other place data lives, someone's custom GPT, Google Drive, git, is joined to it by the same requirements, as master or as slave. So nobody is locked in or out.

*The author's, 2026-10-04, from [the day's thinking](../author/ideas-2026-10-04.md#5-our-own-data-layer-which-locks-no-one-in-or-out); open, and nothing beneath is built. Where the session proposed, the section says so.*

## 1. Why the requirements and not a common store

A common substrate, all of one's files in one suite, is a monolith, a bounded structural world. What is needed instead is a set of requirements on the data layer that let it be joined to other data layers, made the way MCP is made for AI. Then we ship our own and still give the very best way to lock no one in or out.

*The author's, 2026-10-04, [prompt 5](../author/ideas-2026-10-04.md#5-our-own-data-layer-which-locks-no-one-in-or-out).*

### 1.1 It reads the other way from OpenLight's integrations

[OpenLight's horizon](https://github.com/Cwejman/OpenLight/blob/main/@md/horizon.md#integrations--external-systems-projected-into-the-type-system) maps an outside system into the substrate, the outside system remaining the owner. That puts OpenLight's own store at the centre and the others around it. Here the requirements are the centre, and OpenLight's store is one thing that meets them.

*Seen, 2026-10-04, in OpenLight's horizon; the reading is the session's.*

## 2. Not git and folders, since compute is needed anyway

The rule runs today on markdown in folders, tracked in git, because that needed nothing built. But a page that writes, and a model that reads a place and writes back, needs compute whatever stores it. Once compute is there, folders are no longer the cheap choice, and a simple store will do, with typed data allowed. Git and folders may still be joined to it, as any other platform is.

*The author's, 2026-10-04, [prompt 10](../author/ideas-2026-10-04.md#10-if-compute-is-needed-anyway-the-requirements-are-the-centre), in answer to the session, which had proposed the rule's markdown in git as the first data layer.*

### 2.1 Most of the simple store exists

[OpenLight's db](https://github.com/Cwejman/OpenLight/blob/main/db/src/schema.sql) is 87 lines of SQLite: commits, branches, and versioned chunks and placements. What was heavy in the pilot was never the store but what stood on it, the engine, the VM and the chassis, and the pilot's order of work put writing last.

*Seen, 2026-10-04, in OpenLight's db and [pilot](https://github.com/Cwejman/OpenLight/blob/main/@md/spec/pilot.md#build-order); the session's.*

## 3. A first draft of the requirements

What a data layer must give to be joined, as the session first drew it; none of it is the author's yet.

- **A piece** has an address and a typed body.
- **A connection** joins two pieces; a comment is a piece connected to what it stands on, which it leaves whole.
- **A write** is a commit, saying who and when.
- **A read** can be made as of any moment.
- **The joining** is four verbs, read, write, history and watch, the same whichever side is master.

*Proposed, the session's, 2026-10-04; not answered.*

## 4. The cycles don't stop

Work, comments, a model's run and the change they lead to come round again, and never end. So the store keeps time first: a comment points at the moment of what it was about as well as the place, and what a model is handed is what is still open at the moment of asking, not all that was ever said.

*The author's, 2026-10-04, [prompt 8](../author/ideas-2026-10-04.md#8-the-cycles-dont-stop), the first sentence; what follows from it is the session's.*

## 5. What is open

- Whether the requirements are written as OpenLight's, as the rule's, or as a project of their own.
- Whether a comment that is folded into what it stood on retires, and how the trail still shows it was said, which [OpenLight's sketch](https://github.com/Cwejman/OpenLight/blob/main/@md/sketches.md#comments-on-holons) left open too.
- What the first other platform joined is, and on which side.

*Open, 2026-10-04.*
