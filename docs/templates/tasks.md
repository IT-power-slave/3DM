# Tasks: <Feature / Epic Name>

## Tasking Principles
- Each task is independently reviewable.
- Each task maps back to one or more requirements in spec.md.
- Each task produces a verifiable outcome (a check, a review artifact, or a validated behavior).

## 1. Spec & Alignment Tasks
1. Finalize ownership map in spec.md (Section 2.2).
2. Confirm cross-MFE contracts are fully specified (Section 5).
3. Identify and resolve blockers from Open Questions (Section 9).

## 2. Contract Tasks (Cross-MFE Interfaces)
4. Define navigation contract details for each entry/exit point (spec.md 5.1).
5. Define event/message semantics and failure behaviors (spec.md 5.2).
6. Document compatibility expectations and mixed-version behavior (spec.md 6.1 + 7.4).

## 3. Per-MFE Requirement Tasks
> Repeat this section per owning MFE.

### 3.1 <MFE A>
7. Implement requirements from spec.md 4.2 (list requirement IDs or bullets).
8. Validate MFE A failure/degraded behaviors from spec.md 6.3.

### 3.2 <MFE B>
9. Implement requirements from spec.md 4.3.
10. Validate MFE B failure/degraded behaviors from spec.md 6.3.

## 4. Shell/Container Tasks (if applicable)
11. Implement shell/container responsibilities (spec.md 4.1).
12. Validate global UX consistency requirements (plan.md 6).

## 5. Verification Tasks
13. Verify acceptance criteria: happy path scenarios (spec.md 7.1).
14. Verify edge cases (spec.md 7.2).
15. Verify failure/degraded scenarios (spec.md 7.3).
16. Verify compatibility scenarios (spec.md 7.4).

## 6. Release & Operability Tasks
17. Ensure release notes cover contract changes and compatibility expectations.
18. Ensure supportability outcomes are met (spec.md 6.6).

## 7. Closeout
19. Confirm all Open Questions are resolved or explicitly deferred with rationale.
20. Confirm spec.md and plan.md reflect final delivered behavior (no drift).