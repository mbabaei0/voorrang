# CBR answer conventions: ties, pedestrians when turning, roundabout cyclists

Research for ticket [0007](../0007-research-cbr-ties-and-pedestrians.md). Written 2026-10-25. Builds on [dutch-priority-rules.md](dutch-priority-rules.md) (abbreviations RVV, RP-B, CBR-plan, CBR-types as defined there). Everything in that file is not repeated here.

## Sources

| Tag | Source | Read | Trust |
|---|---|---|---|
| **CBR-types** | CBR "Soort vragen tijdens theorie", <https://www.cbr.nl/nl/rijbewijs-halen/auto/theorie-examen-auto/soort-vragen-tijdens-theorie> | 2026-10-25 | Exam owner |
| **CBR-GIF** | The animated example on that page, <https://www.cbr.nl/upload_mm/1/3/7/31764_fullimage_1.%20sleepvraag.gif> (342 frames, 850×514). I extracted frames and looked at them. | 2026-10-25 | Exam owner. It is a UI demo ("Tafel 1 Dummy"), not a published answer key. |
| **CBR-plan** | CBR "Theorie-examenplan auto", incl. §7 Bronvermelding, <https://www.cbr.nl/nl/rijbewijs-halen/auto/theorie-examen-auto/theorie-examenplan-auto> | 2026-10-25 | Exam owner |
| **RP-B** | CBR Rijprocedure B, version 1 Jan 2024, <https://www.cbr.nl/nl/service/nl/artikel/rijprocedure-b-printversie> (the URL serves the PDF directly) | 2026-10-25 | CBR's own reading of the RVV, for the practical exam. CBR-plan lists it as a source for the theory exam. |
| **RVV** | RVV 1990, <https://wetten.overheid.nl/BWBR0004825/2026-07-01> | 2026-10-25 | Primary law |
| **WVW** | Wegenverkeerswet 1994 art. 1, <https://wetten.overheid.nl/BWBR0006622/> | 2026-10-25 | Primary law |
| **NvT** | Stb. 1990, 459 (the RVV 1990 decree and its nota van toelichting), <https://zoek.officielebekendmakingen.nl/stb-1990-459.pdf>. Page numbers are the printed Staatsblad pages. | 2026-10-25 | Primary law plus the legislator's own explanation |
| **TK-2009** | Minister of Verkeer en Waterstaat (Eurlings) to the Tweede Kamer, 25 Aug 2009, reply to the SWOV roundabouts factsheet, TK document 2009D39067. I read it via the tkconv mirror of the Tweede Kamer open-data file, <https://berthub.eu/tkconv/getraw/2009D39067>. | 2026-10-25 | Government letter (primary). The mirror is third-party, but the document ID is the Kamer's own. |

**Blocked or unavailable:**
- SWOV (factsheet page and `ss101.pdf`): Cloudflare/Turnstile bot check. Not bypassed.
- CROW (publication 126 "Eenheid in rotondes", 1998, and the ASVV/Handboek Wegontwerp): paywalled, and no crow.nl page turned up in search. The CROW recommendation below is cited through TK-2009, a primary government source that describes it.
- CBR publishes **no official practice exams or answer keys**. I found no cbr.nl page that offers them; only third-party apps exist. So no CBR "expected answer" for a specific question could be checked. The conclusions below rest on CBR's format rules, RP-B and the law.

---

## Q1. Can two road users share a number in a sleepvraag?

**Answer: no. Treat the CBR passing order as strict, with every number used exactly once. Confidence: medium-high.**

Evidence:
- CBR-types wording: "Sleep de cijfers naar de juiste plaatsen in de afbeelding. Degene die als eerste mag geef je nummer 1, de volgende nummer 2 en de laatste geef je nummer 3." This describes a sequence (first, next, last). Nothing anywhere mentions equal numbers.
- CBR-GIF, what the interface shows:
  - At the start there is a tray of **exactly three tokens, 1, 2 and 3, under a picture with three road users**: the CBR car, a moped from the left and a cyclist at top right.
  - Each token **leaves the tray when it is placed**, and the tray is empty at the end. The demo even moves a token from one road user to another.
  - So there is **one token per number**. The interface as shown cannot give two road users the same number.
  - Final placement in the demo: car 1, moped 2, cyclist 3.
  - My reading of the picture: the car is on the priority road (B1 diamond). The moped and cyclist both face haaientanden on opposite side roads, so they come towards each other; the moped goes straight on and the cyclist turns left, so art. 18(1) puts the moped before the cyclist. That gives a strict, legally determined 1-2-3.
- CBR-plan does not mention "gelijktijdig", "tegelijk" or the sleepvraag at all. Its K+ example question is "Wat is de juiste volgorde van voor laten gaan?" ("volgorde" in the singular).
- Exam assumption (CBR-plan): other road users obey the rules. A question designer who wants one correct answer must therefore choose scenes where the legal relations produce a total order. **(interpretation)** Scenes with truly independent movements (two opposing right turners, etc.) are presumably avoided, or are asked as a different question type: single-sleepvraag ("who goes first"), yes/no, or multiple choice.

Not verified: whether the real exam engine (as opposed to this demo) ever offers duplicate tokens. No public source says so.

**Implication for the app (interpretation):** CBR-faithful puzzles should have a unique strict order. If the app keeps "simultaneous moves" (map preference), label them as a non-CBR extension. Either accept any order between independent road users, or let users mark a group as "together", and say in the explanation that the CBR exam does not ask this.

---

## Q2. Pedestrians crossing the side road you turn into

**Answer: under the law the turning driver must let them go (art. 18(1), "voor laten gaan"). This is not "voorrang", which is why CBR's statement does not contradict it. In the exam, expect the answer "let the pedestrian go" when a pedestrian walks straight on along your road and crosses the road you turn into. Confidence: medium. The law is clear, but no CBR exam question was available to confirm the expected answer.**

The law chain:
- **RVV 18(1)**: "Bestuurders die afslaan, moeten het **verkeer** dat hen op dezelfde weg tegemoet komt of dat op dezelfde weg zich naast dan wel links of rechts dicht achter hen bevindt, voor laten gaan."
- **RVV 1**: "verkeer: alle weggebruikers"; "weggebruikers: voetgangers, fietsers, …"; "bestuurders: alle weggebruikers behalve voetgangers". So art. 18 (which uses "verkeer") covers pedestrians, while art. 15 and B6/haaientanden (which use "bestuurders") do not.
- **WVW 1(1)(b)**: "wegen: alle voor het openbaar verkeer openstaande wegen of paden met inbegrip van … de tot die wegen behorende paden en bermen of zijkanten". The pavement belongs to the same road, so a pedestrian on it is traffic "op dezelfde weg". **(interpretation)**
- **NvT p.102 (art. 18)**: 18(1) is "inhoudelijk niet [afwijkend]" from RVV 1966, except that "hinderen" became "voor laten gaan". **NvT p.118 (art. 49)**: "ongehinderde doorgang verlenen", which is close to voorrang, is "gereserveerd voor bestuurders die elkaar op een kruispunt naderen". For all other priority relations the term "voor laten gaan" is used. So the legislator deliberately separated the two concepts.

Why CBR's line is not a contradiction:
- RP-B p.27: "Hoewel op kruispunten aan voetgangers wettelijk gezien geen **voorrang** hoeft te worden verleend, dient onder bepaalde omstandigheden nadrukkelijk met hun belang rekening te worden gehouden." Strictly, this is about *voorrang* (arts. 15/80, owed to bestuurders), and that is correct.
- RP-B p.72 repeats it: "De voorrangsverplichting geldt slechts ten opzichte van bestuurders." It adds that a pedestrian crossing a junction is assessed under "vertragen, remmen, stoppen", not under voorrang. On the same page: "Bij het afslaan wordt het verkeer dat daarop recht heeft voorgelaten." This uses "verkeer", the art. 18 term.
- CBR-plan topic 2 lists three separate items: "Voorrang geven op kruispunten, **voor laten gaan bij afslaan** en **voor laten gaan van voetgangers**." Pedestrians are explicitly part of the voor-laten-gaan material.

Boundaries (interpretation from the article text):
- **Covered**: pedestrians walking along your road (in your direction or towards you) who cross the side road you turn into. In art. 18 terms they are "naast / dicht achter" you or oncoming on the same road.
- **Not covered by art. 18**: pedestrians crossing the road you are leaving, or crossing elsewhere on the junction, unless they are on a zebra (art. 49(2)). The same goes for pedestrians who walk along the side road and step onto it. Towards them only the general duty of care applies (WVW 5; RP-B p.27, "rekening houden").
- Zebra: always let go (49(2)), except where the pedestrians face red or flashing yellow lights (49(4)).
- Uitrit / special manoeuvre: let all pedestrians go (54), as already established in dutch-priority-rules.md.
- Exam assumption "others obey the rules": a pedestrian crossing a road with no zebra is allowed to do so. They are not breaking a rule, so the scene is valid exam material.

**Implication for the app:**
- Model pedestrians in turning scenarios through art. 18(1): a turning car lets go a pedestrian who goes straight on along the same road.
- Never call it "voorrang" in the UI text. Use "voor laten gaan" / "let go first", matching CBR and RVV vocabulary.
- Pedestrians in other positions yield, unless a zebra or uitrit applies.

---

## Q3. Roundabout cyclists: law or design convention?

**Answer: it is never law. "Cyclists in de voorrang inside built-up areas, uit de voorrang outside" is a non-binding CROW recommendation, carried out with signs and markings. In the exam, the signs and haaientanden in the picture decide. Confidence: high for the legal position. Medium-high for the exam assumption (inferred from CBR's rules, not from a seen question).**

Evidence:
- **RVV** has only two roundabout articles: 47 (driving other than on the right) and 48 (overtaking on the right). Neither says anything about priority. "Bebouwde kom" appears in the RVV only in speed, lighting, parking, bus-stop and slow-vehicle rules, never in priority rules (full-text search of the consolidated RVV, 2026-07-01).
- **NvT p.116–117**: the draft RVV 1990 proposed a general rule that traffic on the roundabout has priority. This was dropped: on official D1 roundabouts such a rule is not allowed under the Vienna Convention, and a separate roundabout status met objections. The legislator wrote that priority for traffic on the roundabout "zal echter met borden moeten worden aangegeven". The same passage reminds drivers that those leaving a roundabout must let go traffic that stays on it, "met name … de rechtdoorgaande fietsers en bromfietsers op het fietspad dat deel uitmaakt van het verkeersplein" (that is the art. 18(1) mechanism).
- **TK-2009** (minister, 2009):
  - "Het CROW beveelt aan om fietsers binnen de bebouwde kom «in de voorrang» en buiten de bebouwde kom «uit de voorrang» te houden."
  - "De aanbevelingen van de CROW zijn niet verplicht." The road authority decides per roundabout.
  - In 2009 about 60% of roundabouts inside built-up areas followed the recommendation. Outside built-up areas, cyclists were "bijna altijd" uit de voorrang.
  - On roundabouts *without* a separate cycle path (then about 45–60%), cyclists ride on the carriageway and "wettelijk gezien altijd voorrang hebben", like all circulating traffic, because the approaches carry B6/haaientanden.
- **CBR-plan §7** lists "CROW – Wegontwerp binnen de bebouwde kom (inclusief ASVV)" and "… buiten de bebouwde kom (inclusief Handboek Wegontwerp)" among its sources, next to RVV, Rijprocedure B and SWOV. CBR uses CROW for how roads look. The rules come from the RVV.
- **RP-B p.51–52**: check for "(brom)fietsverkeer dat van rechts nadert" and "de aanwezigheid van verkeerstekens". On entering, "aan de wettelijke voorrangsverplichting voldaan". On leaving, let go traffic that stays on the roundabout, "ook … het verkeer op een vrijliggend fietspad". RP-B does not mention a binnen/buiten bebouwde kom rule.

What the exam assumes (interpretation from RVV 63/80, the CBR-plan "others obey the rules" assumption, and RP-B):
- **Haaientanden (or B6) facing the cyclists on the cycle ring** where it crosses your entry or exit: cyclists yield, and you go.
- **Haaientanden facing you on the car road at the cycle crossing**, or no markings for the cyclists while their path belongs to the roundabout: let the cyclists go. If the markings are absent, the legal basis on exit is art. 18(1).
- **The bebouwde-kom sign (H1) on its own decides nothing.** An answer must never depend on "we are inside the built-up area, so cyclists have priority".
- **Roundabout with no priority signs at all**: art. 15, so the right-hand rule. Already in dutch-priority-rules.md §4.4.

**Implication for the app:**
- Always draw the cycle-ring haaientanden (or their absence) explicitly. Score from the markings, not from location.
- The binnen/buiten convention can appear as background ("you'll usually see…") but must not decide a correct answer.

---

## Gaps

1. No CBR exam question, answer key or official practice exam was available. Q1 and Q2 conclusions about the *expected exam answer* rest on CBR's format text, the CBR demo GIF, RP-B and the law.
2. The CBR-GIF is an interface demo. That it allows one token per number is an observation about the demo, not a CBR policy statement.
3. SWOV (bot check) and CROW (paywall) were not read directly. The CROW recommendation is taken from TK-2009, a 2009 government letter. Current CROW guidance may have been refined since; the legal position cannot have changed without an RVV amendment, and none exists in the 2026-07-01 consolidation.
4. TK-2009 was read via a third-party mirror (tkconv) of the Tweede Kamer open-data document 2009D39067, not via tweedekamer.nl directly.
