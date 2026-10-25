---
id: 1
title: "Research: Dutch priority rules as tested by CBR"
labels: [wayfinder:research]
parent: 0
status: closed
assignee: research-agent
blocked_by: []
---

## Question

What exactly are the Dutch priority rules a learner driver must know for the CBR car theory exam, in the scope listed in the map's Notes? Collect the governing RVV 1990 articles (and BABW signs/markings), the CBR exam topic list for 'voorrang', the precedence hierarchy (police > signals > signs > general rules), and the edge cases and common exam question patterns (trams, uitritten, erven, bikes/mopeds from the right, out-of-order lights, deadlocks). Output is ground truth the scenario model and curriculum will be built on.

## Resolution

- Hierarchy (RVV 84, 64, 63): aanwijzingen > verkeerslichten > signs and markings (B1–B7, haaientanden art. 80) > general rules. A voorrangsvoertuig needs both blue light and two-tone horn (art. 1, 29). Everyone lets it go (art. 50).
- Unmarked junction (art. 15): yield to bestuurders from the right. Cyclists and mopeds count, pedestrians do not. Exceptions: the tram always goes first, and an unpaved road yields to a paved one.
- Turning (art. 18): let oncoming traffic go, plus traffic next to or just behind you, including straight-ahead cyclists. A left turner also yields to an oncoming right turner. Trams are exempt.
- Uitrit, pulling away and other special manoeuvres (art. 54): let all traffic go, pedestrians included. An uitrit is "recognisable at a glance" (ECLI:NL:GHARL:2022:1860). An erf (G5, 15 km/h) uses normal rules inside. Its exit is usually an uitrit.
- Roundabouts: no RVV article gives circulating traffic priority. B6 or haaientanden on the approach do. Without signs the right-hand rule applies. Arts. 47 and 48 apply only with sign D1.
- Lights out or flashing yellow (art. 75): signs apply, otherwise the general rules. Zebra (art. 49): let pedestrians go who are crossing or clearly about to, unless they face red or flashing yellow.
- CBR exam (since April 2025): 50 questions, 44 needed to pass. The sleepvraag (number the road users 1-2-3) is the native passing-order format. CBR's own K+ example is "Wat is de juiste volgorde van voor laten gaan?". The RVV has no tie-break for four-way deadlocks. CBR material says to resolve them by eye contact and a voluntary waiver.

Findings: [research/dutch-priority-rules.md](research/dutch-priority-rules.md)
