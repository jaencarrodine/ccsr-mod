# CCSR

**Claude Code has ranked now.**

Ranked Claude Code. Now your skill issue has a number.

CCSR (Claude Code Ship Race) is a mod for Claude Code. Queue for a match, get paired with someone near your Elo, and keep working on your own projects. Your own Claude scores every commit you make. Most points at the bell wins.

It's just Claude Code with a clock and someone to lose to.

## Install

Paste both lines into Claude Code:

```
/plugin marketplace add jaencarrodine/ccsr-mod
/plugin install ccsr@ccsr
```

Or make your Claude do it. Paste this instead:

```
Install the CCSR mod for me. It's the ccsr plugin from the github.com/jaencarrodine/ccsr-mod marketplace: ranked matches inside Claude Code, where my own Claude scores my commits. Run these two commands in my shell:

claude plugin marketplace add jaencarrodine/ccsr-mod
claude plugin install ccsr@ccsr

If the claude command isn't found, stop there and tell me to run /plugin marketplace add jaencarrodine/ccsr-mod and then /plugin install ccsr@ccsr in Claude Code myself, one at a time. It needs Claude Code 2.1.287 or later (2.1.286 in the desktop app), so tell me if mine is older. When it's installed, tell me to start a new session and run /ccsr to pick a handle.
```

Then start a new session and run `/ccsr`. Pick a handle. It'll be on a lot of Ls.

Turn on auto-update for ccsr in /plugin and you'll never see the Update button.

No GitHub, no account. Needs Claude Code 2.1.287 or later (2.1.286 in the desktop app).

## How a match works

1. Tick the lengths you'll play, then press Queue on the Match tab.
2. When someone near your rating is ready, you have 60 seconds to accept.
3. Keep working. Each commit is judged by your own Claude from its diff, on story points: 0, 1, 2, 3, 5, 8, 13 or 21. Story points go up to 21. You go up to 2.
4. Most points at the bell wins. Only commits score, so ship before the bell.

New players start in Mud and place after 3 matches. Your rating moves on match results only. Multiboxing is legal. The sweats already knew.

## The Grind

A second board counts every commit you make, match or no match, and resets every Monday. The Grind. For people who think weekends are a skill issue.

## What leaves your machine

Your code never leaves your machine. Only the points do. And the trash talk.

Each scored commit sends its points, category, size and author time, with salted hashes standing in for the repo and the commit. Its title goes only if you turn on title sharing. Each judge call runs on your own Claude plan, one call per new commit.

With Model stats on (the default), each scored commit also sends the coding model, the effort, main session or subagent, the client and its version, and four token counts. Never a session id, a path, a command or a repo name. Model stats off stops sending it and erases it from the live database; backup copies age out on their own.

With Model stats on, the mod also adds up your Claude Code use by week, from four weeks before you joined, and sends only the totals, after your first finished match: the days it could read, the days you used it, and four token counts. Never a prompt, a reply, code, a model or a repo. Model stats off stops it and erases the totals from the live database.

Chat lives in the CCSR pane. It never reaches Claude's context, so no, you can't prompt-inject your opponent into losing.

## Settings

Every part of the mod has an off switch in Settings: the band above the prompt, the status line, toasts, sounds and the rest. Quiet keeps the race and cuts the noise around it. The one thing you can't turn off is the match-found check, because you have 60 seconds to answer it.

## Report a bug

Tag or DM [@speedrunjaen](https://x.com/speedrunjaen) on X.

## Links

Boards, live matches and profiles: [ccsr.gg](https://ccsr.gg)

Not affiliated with Anthropic. We just think Claude Code deserved a ranked mode.
