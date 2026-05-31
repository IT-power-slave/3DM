
# Plan: <Feature / Epic Name>

## 1. Objective
Summarize what will be delivered and what “done” means.

## 2. Impacted Components
### 2.1 Microfrontends & Shell/Container
- Shell/Container: <impacts>
- MFE A: <impacts>
- MFE B: <impacts>

### 2.2 External Dependencies (Conceptual)
- Identity / Authorization: <impact>
- Shared UI / Design System: <impact>
- Shared Data / Services: <impact>

## 3. Boundary & Responsibility Decisions
Document decisions that prevent scope creep.
- Decision: <boundary decision>
  - Rationale: <why>
  - Implication: <what this enables/blocks>

## 4. Contract Design Summary
### 4.1 Navigation Contracts
- <contract>:
  - Inputs: <semantics>
  - Outputs/Outcomes: <observable result>
  - Error behaviors: <observable>

### 4.2 Event/Message Contracts
- <contract>:
  - Producer/Consumers: <who>
  - Semantics: <meaning>
  - Compatibility approach: <how mixed versions are handled>

### 4.3 Shared Capability Usage Rules
- <capability>:
  - Constraints: <rules>
  - Compatibility expectations: <rules>

## 5. Data & State Ownership (Conceptual)
- State owned by MFE A: <what and why>
- State owned by MFE B: <what and why>
- State owned by Shell/Container: <what and why>
- Cross-MFE consistency strategy (observable): <what the user must see as consistent>

## 6. User Experience Consistency Plan
- Global UX constraints enforced by Shell/Container: <list>
- Per-MFE UX responsibilities: <list>
- Error handling consistency: <rules>

## 7. Verification Strategy (Spec-Driven)
Define how we will prove the system meets the spec.
- Contract verification:
  - What will be validated (inputs/outputs/outcomes)
  - How compatibility will be verified (mixed-version scenario coverage)
- Integration verification:
  - Cross-MFE scenario coverage (happy + key failure modes)
- Regression protection:
  - Which acceptance criteria are considered “must not regress”

## 8. Rollout & Risk Management (Conceptual)
- Rollout approach: <phased / toggle / limited audience> (describe conceptually)
- Key risks:
  - Risk: <risk>
    - Mitigation: <mitigation>
    - Detection: <how we notice it>

## 9. Documentation Updates
- Required updates to:
  - Ownership map
  - Contract registry (if you maintain one)
  - User-facing help/support notes (if applicable)
