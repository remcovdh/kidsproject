# Running a Workshop — Guide for Teachers & Helpers

This is a practical guide for the adult running (or helping with) a Kids AI Workshop session —
no technical background needed. If something here doesn't match what you see on screen, ask
whoever set up the app for you (see [DEVELOPMENT.md](DEVELOPMENT.md) if that's you).

## Your workshop's web addresses

Whoever set up the app for you should fill these in:

| What | Address |
|---|---|
| **Kids' link** (the app the children use) | `________________________` |
| **Helper link** (this guide — what you use) | `________________________` |
| **Helper password** | `________________________` |

If you're testing on your own laptop before a real session, these are usually
`http://localhost:3000` (kids) and `http://localhost:3001` (helper).

---

## The short version

1. Open the **helper link** on your phone or laptop, log in.
2. Create a session, give it a name. You get a **join code** (e.g. `MTCS`).
3. Tell the kids the join code. They type it in on the kids' link and enter their name.
4. As each kid reaches the drawing step, they'll wait for you. Open their row in the roster,
   tap 📸, and take a photo of their drawing (and later, their world/background drawing).
5. Kids do everything else themselves — describing their character, picking a style, playing
   their game, adding sound, and publishing.
6. When you're done, tap **Share gallery with families** and send that link home.

The rest of this guide covers each of those steps in more detail.

---

## 1. Before the session — create it

1. Open the **helper link**. Log in with the shared helper password (ask your organizer if you
   don't have it — it's the same password for everyone helping that day, there's no individual
   account to set up).
2. You'll land on the **Sessions** screen. Fill in:
   - **Session name** — something you'll recognize later, e.g. "Class 4B" or today's date.
   - **AI provider** — leave this on the default unless someone technical told you otherwise.
   - **Show the AI prompt to kids** — on by default. This shows children the actual words sent
     to the AI, which is part of the "you are the director" lesson. Turn it off for younger or
     less confident readers if you'd rather keep the screens simpler.
3. Tap **+ Create session**. You'll land on that session's roster, and you'll see a **join code**
   at the top — a short 4-character code like `MTCS`. Write it on the board or read it out loud.

You can create a new session for every class or every run of the workshop — old sessions don't
disappear, they just stay in your **Sessions** list (with their own galleries, still shareable
later) so you can always find your way back to one.

## 2. Getting kids into the session

On the kids' link, a child who doesn't already have a direct link will see **"🔑 Enter your
code"**. They type the 4-character join code you gave them and tap **Join!**. From there they
enter their own name and pick a game.

Right after entering their name, each child gets a random animal next to their name (e.g.
**"Robin 🦁"**) shown at the top of their screen the whole time. This is just to tell kids with
the same first name apart when you're looking at your roster — the same animal is never given to
two kids in the same session, so "Robin 🦁" and "Robin 🐢" are always two different children.

## 3. Helping kids with photos — the main thing you'll be doing

**Every drawing photo in this app is taken by a helper, never by the child themselves.** This is
deliberate — it keeps a phone camera out of kids' hands and puts an adult in the loop for every
photo taken during the workshop. Both the **character drawing** and the (optional) **world /
background drawing** work the same way.

**On your phone:** open the helper link in your phone's browser (no app to install), log in, and
open the session's roster. As kids draw and reach the point where they need a photo, their
screen will show *"Waiting for your helper to take a photo…"* and your roster row for that child
will say **"No photo yet"** next to a 📸 button.

To take the photo:
1. Find the right child in the roster — use their name *and* animal to make sure it's the right
   one, especially if two kids share a first name.
2. Tap 📸 next to **Drawing** (or **World**, once they get to that step).
3. Your phone's camera opens — take a clear, well-lit photo of the paper drawing.
4. That's it. The status changes to **"Waiting for kid to confirm"**.

**What happens next is automatic and safe against mistakes:** the child's own screen instantly
shows the photo you took with **"Is this yours?"** and a Yes/No choice.
- If they tap **Yes**, the status becomes **"✅ Done"** and they move on by themselves.
- If they tap **No** (wrong drawing, blurry, whatever), the status becomes
  **"⚠️ Needs retake"** — that's your signal to go back and take it again for that child. The
  child never gets a "take it again" button themselves; only you do, from the roster.

This two-step check (you take it, they confirm it's theirs) is exactly what the animal+name
labeling is there to support — even if you tap the wrong row by mistake, the child catches it
before it goes any further.

You don't need to do anything else for that child's photo — once they say "Yes", the AI step and
everything after it happens on their own screen without you.

## 4. What kids do on their own

Once a photo is confirmed, kids handle the rest themselves:
- Answering a few simple questions about their character (what it is, how it feels, how it
  moves, and what art style to draw it in).
- The AI generates **two versions** of their character (and, later, their world) — one made
  purely from their description, one made directly from their photo — and the child picks
  whichever one they like better. There's nothing for you to do here; it's just worth knowing
  it's normal to see two pictures and a "which one do you like better?" screen.
- Playing an instant preview of their game after each step (character, world, sounds).
- Publishing to the shared gallery when they're happy with it — they have to try their sounds
  out at least once before the "put it on the wall" button unlocks, so nobody publishes a game
  they haven't actually played.

## 5. Keeping an eye on things

Your roster (refreshes automatically every few seconds, or tap **Refresh**) shows every child's
status for **Drawing**, **World**, and whether they've **Published** yet, all in one place. That's
usually enough to see who needs help and who's coasting ahead.

If a session has "Show the AI prompt to kids" turned on, you can also glance over a child's
shoulder at their screen to see the exact words being sent to the AI — useful if a child seems
confused about why their character came out differently than expected (that's the "AI makes
mistakes, you're the director" lesson in action, not a bug).

## 6. After the session — sharing with families

Once kids have published their games, you can share the whole session's gallery with parents so
kids can show off their game at home — no login needed on their end, and nothing for the kids to
copy or send themselves.

You'll find a **📤 Share** button in two places in the helper app:
- Next to every session in your **Sessions** list.
- At the top of that session's **roster** screen ("Share gallery with families").

Tapping it copies a link to your clipboard (or shows it in a popup if your browser blocks
clipboard access) — send that however you'd normally reach parents: email, a class chat app, a
QR code on a handout, whatever your school uses. Opening that link shows **everyone's** games
from that session together, exactly like the in-session gallery kids already played from — so
one link covers the whole class, not just one child.

The link keeps working after the session ends, for as long as the app stays running, so you can
send it out whenever's convenient afterward — it doesn't have to happen the same day.

## 7. Troubleshooting

| What you see | What to do |
|---|---|
| A kid says their join code "doesn't work" | Double-check they typed it exactly — codes never use the letters `O`, `I`, `L` or the digits `0`/`1` (to avoid mix-ups), so if a kid entered one of those, that's the mistake. |
| A child's "waiting for helper" screen isn't updating after you took the photo | Ask them to check their WiFi/connection; it checks automatically every few seconds so it shouldn't need a manual refresh, but a page reload never hurts. |
| The AI step is taking a while | Normal — character and world generation both take a few seconds up to about 20-30 seconds, longer if many kids are generating at once. |
| You captured a photo for the wrong child | No harm done — that child will see it and tap "No", which flags it back to you as "⚠️ Needs retake" so you can redo it for the right child. |
| Something looks broken / an error message appears | Note what the screen said and let whoever set up the app know — see the Troubleshooting section in [DEVELOPMENT.md](DEVELOPMENT.md) for the technical side of tracking it down. |

---

For anything about installing, configuring, or deploying the app itself, see
[DEVELOPMENT.md](DEVELOPMENT.md) instead — this guide is only about running a workshop with an
app that's already up and running.
