# Proposal: academy context discovery and continuity

## Evidence from this task

- The Education entrypoint identifies preserved packages by custody date, not an exhaustive lesson-history index. A date without a matching local package is unknown coverage.
- October 21 and October 26 lesson evidence lived in different owner repositories. A saved-context MCP returned an older snapshot, while the October 26 private source held a later scoped lesson close and DailyRecord readback.
- A pinned live-admission range and native student bindings were independent of both the user request and the saved-evidence index. An outdated access route could therefore be mistaken for missing student history.
- Lesson preparations must preserve book edition, unit, activity, occurrence, evidence stage, attributable teacher decisions, and later scoped corrections. Regular attendance and makeup lessons cannot be inferred from weekdays alone.

## Recommended operating model

1. Maintain one private metadata-only source index in the integrated repository, organized by business date, class, student, source owner, source revision, and precise read entry. Record coverage and freshness as explicit fields. Do not copy student bodies into the index, and do not treat a locator as permission or a runtime effect.
2. Keep original source data with its existing owner. Add owner-approved pointers to independently held packages, including October 26, only after the exact repository, commit, path, custody policy, and user-approved scope are qualified. If a source is unavailable, keep a named gap and preserve other evidence.
3. For each student and lesson, build an ephemeral evidence view from selected sources. Preserve occurrence dates and observed/reported/retrieved clocks. Apply a correction only to the exact edition, unit, activity and occurrence it addresses; retain superseded historical states and never infer that an absent row means nonperformance.
4. Maintain a small student/class continuity checkpoint with current assignments, verified teacher completions, unresolved questions, next action, and source references. Its creation or update requires the applicable record-write permission; it is not an LMS save, parent transmission, or substitute for source verification. Current direct teacher instructions remain authoritative in their exact scope.
5. For live reads, publish a consistent owner-qualified release and show each session the effective backend, admission, availability, observation time and coverage. Saved snapshots stay explicitly distinct from a fresh server read. A failed lookup must not silently become an empty checklist or an inferred overdue item.
6. Keep one shared source index and well-defined owner adapters across agent sessions. Sessions should refresh and cite the current index rather than maintain separate unsynchronized long-form memories. A session reload cannot grant data access, alter an owner's custody, or create classroom effects.

## Adoption order

- First inventory source owners and exact read-entry points without ingesting private bodies. Resolve stale or missing links and name gaps.
- Next implement a narrow date/class/student selector and test its coverage against synthetic cross-source corrections and pagination. Test no-source and stale-source cases explicitly.
- Then run a teacher-reviewed private pilot for one class day, comparing the resulting checklist against independently verified current records. Obtain separate approval before persisting a checkpoint, moving data, registering native bindings, or changing production.

Success means the teacher can identify what is known, its source and time, which later corrections apply, and exactly what remains unknown; it does not mean all historic content is available or current.
