# CCSR

**Claude Code has ranked now.**

Ranked Claude Code. Now your skill issue has a number.

CCSR (Claude Code Ship Race) is a mod for Claude Code. Queue for a 1h or 3h match, get paired with someone near your Elo, and keep working on your own projects. Your own Claude scores every commit you make. Most points at the bell wins.

It's just Claude Code with a clock and someone to lose to.

## Install

Paste both lines into Claude Code:

```
/plugin marketplace add jaencarrodine/ccsr-mod
/plugin install ccsr@ccsr
```

Then start a new session and run `/ccsr`. Pick a handle. It'll be on a lot of Ls.

No GitHub, no account. You need Claude Code 2.1.287 or later in the terminal, or 2.1.286 or later in the desktop app.

## How a match works

1. Tick 1h, 3h or both, then press Queue.
2. When someone near your rating is ready, you have 60 seconds to accept.
3. Keep working. Each commit is judged by your own Claude from its diff, on story points: 0, 1, 2, 3, 5, 8, 13 or 21. Story points go up to 21. You go up to 2.
4. Most points at the bell wins. Only commits score, so ship before the bell.

New players start in Mud and place after 3 matches. Your rating moves on match results only. Multiboxing is legal. The sweats already knew.

## The Grind

A second board counts every commit you make, match or no match, and resets every Monday. The Grind. For people who think weekends are a skill issue.

## What leaves your machine

Your code never leaves your machine. Only the points do. And the trash talk.

Each scored commit sends its points, category, size and author time, with salted hashes standing in for the repo and the commit. Its title goes only if you turn on title sharing. Each judge call runs on your own Claude plan, one call per new commit.

Chat lives in the CCSR pane. It never reaches Claude's context, so no, you can't prompt-inject your opponent into losing.

## Settings

Every part of the mod has an off switch in Settings: the band above the prompt, the status line, toasts, sounds and the rest. Quiet keeps the race and cuts the noise around it. The one thing you can't turn off is the match-found check, because you have 60 seconds to answer it.

## Report a bug

Tag or DM [@speedrunjaen](https://x.com/speedrunjaen) on X.

## Links

Boards, live matches and profiles: [ccsr.gg](https://ccsr.gg)

Not affiliated with Anthropic. We just think Claude Code deserved a ranked mode.
