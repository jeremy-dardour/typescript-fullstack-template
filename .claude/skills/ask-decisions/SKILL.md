---
name: ask-decisions
description: Ask the user for product or technical decisions so that each one can be answered without opening the repo — the feature, what the docs say now, the options with their cost, a recommendation with its consequence, and a mockup for anything on screen. Use before work that needs the user's input, when writing a batch of decisions, or when a question for the user comes up mid-task.
---

# Ask the user for decisions

The user often answers hours or days after the spec was written, without the files open. An item they can't answer without searching the repo is an item not asked. Every item stands alone: no "see item 4", no plan shorthand.

## Each item, in this order

1. **Title**: the feature and the choice, not the answer ("Contacts: free text or one row per person", not "Structured contacts").
2. **The feature** in two sentences: who uses it, what for, which piece of work builds it.
3. **What the docs say now**, with the source (the spec section, the technical design, the design reference, the code path). Say where docs disagree with each other or with the code.
4. **Options**, at least two, the current plan always among them. For each: what it looks like on screen or in the data, rough build cost, and what it rules out or makes expensive later. Options rejected outright get one line each with the reason.
5. **Recommendation and its consequence**: what users and the code get if the answer is "ok". "Ok" has exactly one meaning.
6. **What you need back**: a letter, a yes/no, a number, or "ask someone else" (then record who and what).

## Visuals

An item about a screen, a form, navigation or an admin page carries an ASCII mockup of each option, with real labels and a realistic number of rows, at phone width when the page is used on phones. An item where options differ on several axes (limits, cost, risk) carries a small table, one row per option. Never describe a screen only in prose.

## Wording

Write what exists, not only what is dropped: "the email log lists failed emails; nothing in it sends one again" instead of "no resend buttons". Every number has its unit and what it bounds. Define any term not in the domain glossary.

## Batches and tools

Group coupled decisions in one item or mark the dependency. Order by when the work needs them, and say which items block the next piece of work. Mark routine items that can take the default with "ok". Split batches above about 15 items.

Use AskUserQuestion for 1–4 independent choices with at most 4 options each, UI choices above all: put each option's mockup in its preview, and keep the feature reminder and current spec in the question text. A batch, coupled decisions, or an item whose context needs more than a paragraph go into a written decision document committed with the project's docs (for example `docs/open-decisions.md`); then use AskUserQuestion for what stays open, a few items at a time.

## While waiting

Unanswered items need not stop the work when they are cheap to reverse: record the recommendation as provisional where the plan lives, build on it, and keep the item open. Build a reversible choice last so it can be dropped cleanly. A choice that is expensive to reverse waits for the answer.

## After the answers

Restate each answer in one line as the decision you will apply. An answer that asks a question back means the item failed: rewrite it by these rules, never resend the same text. Record the answer where the project's documentation map says, change already-built code if the answer differs from what was built, and close the item.
