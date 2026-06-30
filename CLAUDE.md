@AGENTS.md

## Claude Code specifics
- Use the `/plan` tool before any UI work (this enforces the planning rule in AGENTS.md).
- Never use `--dangerously-skip-permissions` outside a container.

## Marketing & social content

When the task involves Scout marketing, Instagram posts, captions, carousels, hooks, or content batches, use the scout-marketing skill in .claude/skills/scout-marketing/. It holds the brand system, content pillars, the angle bank, the caption formula, and the voice rules that keep copy from reading as AI-generated. Apply those voice rules to any Scout marketing copy even when not explicitly asked.

Durable brand facts (the skill has the full version):
- Audience: Cornell student-athletes and the alumni who mentor them.
- Product in one line: Scout helps athletes find relevant alumni and drafts outreach they review before sending. It never auto-sends.
- Accent color: Cornell carnelian #B31B1B. Background: warm cream, never pure white.
- Domain / tag: scoutcornell.com - free for Cornell athletes.
- Hard rule on copy: ration em-dashes, no "it is not X, it is Y," vary sentence length, no markdown emphasis in caption body, prefer a specific micro-story over a generic claim. Read it aloud before shipping.
