# Reviewer outreach checklist (project owner only — NOT for the reviewer)

**Status:** pending. No reviewer has been contacted. Outreach is the project
owner's action; nothing here is sent automatically.

1. Identify 1–2 qualified reviewers (complementary laboratory, water-quality,
   or sample-investigation experience). Record conflicts of interest.
2. Personalize `validation/INDEPENDENT_REVIEW_INVITATION.md` (sign with your
   name and affiliation).
3. Build the blind handoff:
   `python3 validation/build_reviewer_handoff.py --out /tmp/reviewer-handoff.zip`
   The builder refuses to include forbidden files (engine source, expected
   decisions, answer keys, scorer). Verify the archive lists exactly 4 files.
4. Send ONLY the handoff ZIP. Do not attach engine source, comparison results,
   facilitator keys, or the scoring tool before the response is frozen.
5. Tell the reviewer the expected effort (13 cases, roughly 60–120 minutes)
   and the consent terms (anonymized technical comments quoted only with
   permission; identity kept private otherwise).
6. When a response arrives: freeze the original file, then run
   `python3 validation/score_independent_review.py --response <file> --out <dir>`.
7. Review disagreements without changing engine rules first; any rule change
   requires a regression test and a documented rationale.
8. Report the review as formative and synthetic-case-only, with the small
   sample stated.
