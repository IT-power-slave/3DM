# Constitution (Global Guardrails)

## Purpose
This constitution defines non-negotiable rules for writing and executing specifications in a microfrontend-based system. It applies to all microfrontends (MFEs), the shell/container, and shared capabilities.

## Non-Negotiable Principles
1. **Boundary-first thinking**
   - Each requirement shall be assignable to exactly one owning MFE (or explicitly to the shell/container).
   - Cross-MFE behavior shall be expressed as contracts and observable outcomes, not internal implementation.

2. **Independence**
   - Each MFE shall be independently releasable.
   - Each MFE shall fail safely without preventing unrelated MFEs from operating (graceful degradation).

3. **Contracts over coupling**
   - All cross-MFE interactions shall be defined via explicit contracts (navigation, events/messages, shared state access, shared capabilities).
   - Contract changes shall include a compatibility strategy (e.g., backward compatibility window) and acceptance criteria.

4. **Single source of truth for responsibilities**
   - The spec shall clearly define ownership of UI regions, business rules, and user interactions.
   - Shared UI elements must have explicit ownership and change rules.

5. **User experience coherence**
   - The overall user journey shall be coherent across MFEs (consistent terminology, navigation expectations, error handling experience).
   - Global UX requirements shall be written at the shell/container level.

6. **Security & privacy as requirements**
   - Data access rules, sensitive data handling, and permissions shall be specified as requirements and acceptance criteria.
   - No specification may require exposure of sensitive data across MFE boundaries without explicit justification and constraints.

7. **Observability & operability as requirements**
   - Specs shall include required operational signals as acceptance criteria (e.g., user-visible error states, diagnostic events, supportability hooks), described without tooling specifics.

8. **Accessibility & compliance**
   - Accessibility and compliance requirements shall be explicitly stated for user-facing behavior.

## Spec Workflow Rules
- Work proceeds in this order: **spec.md → plan.md → tasks.md**.
- Any change request shall first update **spec.md** (and contracts), then update plan/tasks accordingly.

## Definition of Done (applies to all MFEs)
- Requirements are unambiguous and testable.
- Ownership is clear for every behavior.
- Contracts are defined and include compatibility expectations.
- Failure modes and degraded experiences are specified.
- Acceptance criteria cover happy path + key edge/error scenarios.
- Open questions are tracked and do not block agreed scope.