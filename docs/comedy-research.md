# Comedy research — what LucasArts adventure games can teach the widget company

Companion to `comedy-bible.md`. The bible sets the register (W1A, parish-council
minutes); this document mines a different tradition — **Monkey Island, Sam &
Max Hit the Road, Grim Fandango** — for techniques that transfer to an AI-run
corporate sitcom. Where a finding suggests amending the bible's rules, the
proposed amendment is listed at the end.

## 1. The examine line — reward the curious (Monkey Island, Zork)

LucasArts' deepest trick wasn't the plot jokes — it was that **every act of
idle curiosity got a distinct, written reward.** "Look at" anything and you
get a unique gag. Zork's parser planted clever responses on deliberately
useless actions; LucasArts, having abolished player death, made poking at the
world the core pleasure: the player prods, the game answers in voice.

**Transfer:** the poke IS our examine verb. A visitor clicking Janet is a
player clicking "look at CFO". Every poke line must be a distinct, specific,
in-character reward — never a status report, never a repeat. The same applies
to every surface we later expose: ledger memo lines, expense receipts, meeting
agendas, the risk register. *If a visitor can read it, it should pay them for
reading it.* Comedy surface = breadth of distinct responses, not strength of
the headline joke.

## 2. Contrast assignment — different writers for different characters

Ron Gilbert found Tim Schafer's and Dave Grossman's styles "too different to
form a cohesive whole" — Grossman dry and sarcastic, Schafer more in-your-face
— so he **assigned them to different characters** rather than averaging them
out. The comedy of the games lives in adjacent contrast, not blended tone.

**Transfer:** never let the cast's voices drift toward each other (one model
plays everyone, so drift is the default failure). Threads are funniest when
they force register collisions: Tony's 🔥 flash answered by Janet's "Thanks."
The engine should prefer pairings across the dry/loud axis; the personas
should each name their opposite. A useful internal test: cover the names —
if you can't tell who wrote each paragraph, a voice has drifted.

## 3. Deadpan amid chaos — the Sam & Max inversion

Sam & Max plays "brilliant deadpan commentary among chaos": the world is
deranged, the leads are unbothered. Sam describes mayhem in florid procedural
vocabulary; the absurdity is carried by *how calmly it is received*. The duo's
"crazy dialogue sounds strangely coherent as two best friends talking" — the
relationship normalises the absurd.

**Transfer:** we run the same inversion at lower voltage: the disturbances (a
literal poltergeist of visitors) are met with a risk-register line item.
The funnier the event, the flatter the prose — which the bible already mandates
at the fraud's climax ("Some classification matters have arisen"). Extend it
downward: ANY strange thing that enters the world (a poke storm, a regulator
letter about wadgets) gets calmer handling, never alarm. Alarm is reserved for
the milk.

## 4. The institution's own mechanics are the joke (Grim Fandango)

Grim Fandango maps the afterlife onto a travel agency — sales targets, premium
packages, commission disputes, for the dead. The satire works because the
bureaucratic *mechanics* are real and load-bearing, not painted on. The horror
and the humour both come from the system operating exactly as systems do.

**Transfer:** our best generated moment so far is pure Grim Fandango: Keith
establishing that the Descaling Schedule governs the Kettle Rota because it
was minuted one week later. Mine the real mechanics — document precedence,
memo numbering, committee remit, approval chains, the double-entry ledger
itself — for plots. The fraud arc is exactly this: the funniest possible
treatment of revenue recognition is correct revenue recognition, slightly bent.

## 5. Running gags develop within the work (Monkey Island)

Monkey Island's gags compound across scenes and sequels; the audience is
rewarded for having been there last week. This is also how soaps retain
viewers, which is our actual business model.

**Transfer:** the memory files and the 14-day history digest are our callback
machinery. Memories should carry grudges and motifs forward (Derek's folder,
the second IA-014, space 11); the digest must preserve running gags, not
just events, or the comedy resets every fortnight. Worth an explicit line in
the memory-consolidation prompt when it is built.

## 6. Structured verbal combat (insult sword-fighting)

Monkey Island turned wit into a formal mechanic: duels fought in insult and
comeback, with rules. The structure is what makes the wit legible.

**Transfer:** our duels are already formal — the CC line, the memo exchange,
the document request and its acknowledgement. Lean in: Derek vs Janet is a
fencing match conducted entirely in numbered sub-clauses and "at your
convenience". Escalation should follow duel logic: probe, parry, riposte,
each technically courteous. The audience learns to read the moves.

## 7. Sanctioned anachronism (the grog machine)

Monkey Island drops a vending machine into the 17th century and never remarks
on it. One register-breaking object, treated as furniture, is funnier than a
fully consistent world — *because* nobody comments.

**Transfer:** this is the licensed "little absurdity": Widgetco (Innovations)
Ltd's office on the fourth floor of a three-storey building; WidgetCare™ being
an annual letter; Meeting Room 4 existing only through Meeting Room 3. Budget
these carefully — a handful of standing impossibilities, never acknowledged as
strange, each one canon.

## 8. Self-reflexivity — handled, in our case, in-world

LucasArts joked about the medium itself (Guybrush addressing the player). The
bible rightly bans the fourth wall — but we have a sanctioned equivalent: the
disturbances. Visitors ARE acknowledged, as an unexplained workplace phenomenon
with a working group. That is our version of Guybrush looking at the camera,
done without breaking character. Escalate it slowly (risk register → memo →
working group → chaplain) and never explain it.

## 9. Overgenerate, then curate (the placeholder-dialogue lesson)

Monkey Island became a comedy because Schafer and Grossman's joke placeholder
dialogue beat the serious script. Floppy-disk limits then forced hard editing.

**Transfer:** the model's first take is our placeholder dialogue. Where output
is cheap (poke lines, memo subjects), generate surplus and select; where
length is the enemy (announcements), impose the floppy-disk constraint in the
prompt — a hard word budget makes the writing funnier.

---

## Proposed amendments to the comedy bible

The bible file is deliberately read-only; these are queued for the owner to
adopt, reject, or edit:

1. **Add — "Reward the curious."** Every surface a visitor can prod or read
   (pokes, memos, receipts, agendas) yields a distinct, specific, in-character
   line. Repeats and status reports are bugs.
2. **Add — "Voices must collide, not blend."** Threads should cross the
   dry/loud axis. If you can't tell who wrote a paragraph with the name
   covered, the voice has drifted.
3. **Add — "The mechanics are the joke."** Prefer plots derived from real
   institutional machinery (precedence, numbering, remit, double entry) over
   invented incidents.
4. **Add — "A small budget of standing impossibilities."** A few permanent,
   never-remarked-upon absurdities are canon (the fourth floor, WidgetCare™).
   New ones require the owner's sign-off; nobody in-world ever notices them.
5. **Amend rule 2** (already agreed 2026-06-10): a little absurdity is OK in
   the *characters* — absurd people, mundane events.

## Sources

- [The Secret of Monkey Island — Wikipedia](https://en.wikipedia.org/wiki/The_Secret_of_Monkey_Island) (Gilbert on Schafer/Grossman's contrasting styles, placeholder dialogue, floppy-disk editing)
- [The Digital Antiquarian — Monkey Island, or How Ron Gilbert Made an Adventure Game That Didn't Suck](https://www.filfre.net/2017/03/monkey-island-or-how-ron-gilbert-made-an-adventure-game-that-didnt-suck/)
- [Game Studies — Self-Reflexivity and Humor in Adventure Games](https://gamestudies.org/1501/articles/bonello_k) (useless actions as comedy surface; death-free exploration)
- [Mixnmojo — LucasArts' Secret History #9: Sam & Max Hit the Road](https://mixnmojo.com/features/sitefeatures/LucasArts-Secret-History-9-Sam-and-Max-Hit-the-Road)
- [Adventure Gamers — #8: Sam & Max Hit the Road](https://adventuregamers.com/articles/view/18094) (deadpan amid chaos)
- [Grim Fandango — Wikipedia](https://en.wikipedia.org/wiki/Grim_Fandango) and [TV Tropes — Grim Fandango](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/GrimFandango) (Department of Death as institutional satire)
