# Markdown To Requests And Tests Plan

## Goal

Build a workspace-level capability that can take one or more API documentation Markdown files, extract endpoint definitions, generate structured requests in Kest, generate runnable tests, and support batch execution with a consolidated result view.

Primary target input:

- `/Users/mingde/item/K/kest/docs/api/01-authentication.md`

Primary product outcome:

- A user can upload a Markdown API document and get:
  - generated requests
  - generated API specs when needed
  - generated test cases
  - batch execution results

## Execution Rules

- All implementation work for this plan must happen on a new branch created specifically for this effort.
- Use a dedicated branch name with the `codex/` prefix unless product or repo conventions require something else.
- Do not pile this work onto an unrelated in-flight branch.
- Each small completed module should be committed separately instead of waiting for the entire feature to finish.
- A "small module" here means a coherent slice such as:
  - importer parser enhancement
  - importer API contract update
  - import dialog UI update
  - AI extraction backend endpoint
  - AI extraction review UI
  - batch test generation endpoint
  - batch run endpoint
  - history page run aggregation UI
- Each commit should leave the branch in a buildable, reviewable state.
- Prefer commit boundaries that line up with the milestones and submodules in this document.

## Current State

The repository already has several partial capabilities, but they are not connected into the full workflow.

### Existing capabilities

- Markdown import into collections and requests exists:
  - `/workspaces/:id/collections/import/markdown`
  - implementation in `/Users/mingde/item/K/kest/api/internal/modules/importer/markdown.go`
- AI generation for API spec drafts exists:
  - structured spec drafting and accept flow
  - implementation in `/Users/mingde/item/K/kest/api/internal/modules/apispec`
- AI generation for a single API spec test exists:
  - `/workspaces/:id/api-specs/:sid/gen-test`
  - implementation in `/Users/mingde/item/K/kest/api/internal/modules/apispec/handler.go`
- Test case creation and single test execution exist:
  - `/workspaces/:id/test-cases/from-spec`
  - `/workspaces/:id/test-cases/:tcid/run`
  - implementation in `/Users/mingde/item/K/kest/api/internal/modules/testcase`
- Unified run persistence exists for request and collection execution.

### Current limitations

- Markdown import is parser-driven, not AI-driven.
- The importer expects a fairly strict heading structure and usually relies on:
  - `Base URL` sections with full URLs
  - endpoint headings like `### METHOD \`/path\``
  - cURL examples for headers, query params, and body
- The sample file `/Users/mingde/item/K/kest/docs/api/01-authentication.md` does not fully match the current parser expectations.
- There is no end-to-end flow for:
  - Markdown -> API specs
  - Markdown -> batch test generation
  - batch run of generated test cases
- Current test execution is single test case oriented, not bulk oriented.

## Product Decision

The correct product direction is not to stretch the current strict Markdown importer indefinitely. It should become a two-lane system.

### Lane 1: deterministic import

Use the current parser for Markdown files that already follow Kest-friendly structure.

Benefits:

- fast
- cheap
- predictable
- easy to debug

### Lane 2: AI-assisted import

Add an AI normalization and extraction layer for real-world API docs that do not follow the strict Kest import shape.

Benefits:

- supports files like `/Users/mingde/item/K/kest/docs/api/01-authentication.md`
- extracts request body fields, headers, auth requirements, path params, query params, and examples from looser prose and tables
- reduces manual rewriting before import

## Recommended Scope

Deliver this in four phases so the feature becomes usable early without overcommitting to a brittle all-in-one implementation.

## Phase 1: Make Markdown Import Accept Real Docs

### Objective

Expand the existing importer so the sample documentation format can be imported into requests without requiring AI.

### Backend work

- Extend `/Users/mingde/item/K/kest/api/internal/modules/importer/markdown.go` to support:
  - endpoint headings like `### POST /register` without backticks
  - `Base Path` in addition to `Base URL`
  - relative base path combined with a workspace or import-supplied base URL
  - `#### Example Request` JSON blocks as request body input
  - request headers from `#### Request Headers`
  - query parameter tables from `#### Query Parameters`
  - path parameter tables from `#### Path Parameters`
  - auth detection from lines like `**Authentication**: Required`
- Introduce a new import request option:
  - `base_url_override`
  - needed when the document only provides a base path like `/v1`
- Add importer tests for:
  - `/Users/mingde/item/K/kest/docs/api/01-authentication.md`-style documents
  - auth-required endpoints
  - admin-only endpoints
  - table-driven params without cURL examples

### Frontend work

- Extend the Markdown import dialog in:
  - `/Users/mingde/item/K/kest/web/src/components/features/project/api-request-workbench.tsx`
- Add optional inputs:
  - base URL override
  - import mode selector:
    - strict
    - smart
- Improve import result summary:
  - number of collections created
  - number of requests created
  - skipped endpoints with reasons

### Deliverable

- A user can import `/Users/mingde/item/K/kest/docs/api/01-authentication.md` into requests with minimal manual work.

## Phase 2: Add AI Markdown Extraction Into API Specs

### Objective

Support arbitrary API Markdown documents by first converting them into structured API spec drafts.

### Backend work

- Add a new module flow:
  - upload Markdown file
  - chunk and normalize content
  - call LLM to extract structured endpoints
  - return a draft list before persistence
- New endpoint proposal:
  - `POST /workspaces/:id/api-specs/import/markdown-ai`
- Draft response should include:
  - endpoint count
  - extracted method
  - extracted path
  - summary
  - auth type
  - parameters
  - request body schema
  - example request body
  - confidence
  - warnings
- Reuse the existing API spec draft structures where practical instead of inventing a second schema family.

### Prompting constraints

- Force JSON-only output.
- Require per-endpoint confidence and warnings.
- Require explicit distinction between:
  - directly observed values
  - inferred values
- Never invent headers or body fields unless marked as inferred.

### Frontend work

- Add an import flow under API Specs page, not just request workbench.
- Show extracted endpoints in a review table with:
  - accept all
  - reject item
  - edit item
  - filter low-confidence items

### Deliverable

- A user can upload a loose Markdown API doc and get a reviewed set of API specs.

## Phase 3: Batch Generate Test Cases

### Objective

Once requests or API specs exist, generate test cases in bulk.

### Backend work

- Add a bulk generation endpoint for test cases:
  - `POST /workspaces/:id/test-cases/batch-from-specs`
- Input:
  - spec IDs
  - generation mode:
    - simple
    - example-based
    - AI flow
  - environment ID
- Support three generation strategies:
  - deterministic from spec only
  - deterministic from spec + saved example
  - AI generated Kest flow from spec
- Persist provenance metadata:
  - source markdown file
  - source spec ID
  - generated by importer / AI / manual

### Frontend work

- Add batch actions in API Specs page:
  - generate tests for selected specs
  - generate tests for imported set
- Show creation summary:
  - created
  - skipped
  - failed

### Deliverable

- A user can select multiple imported specs and generate test cases in one action.

## Phase 4: Batch Run And Result Aggregation

### Objective

Support running many generated tests and reviewing aggregate status.

### Backend work

- Add bulk run endpoint:
  - `POST /workspaces/:id/test-cases/batch-run`
- Input:
  - test case IDs
  - environment ID
  - fail-fast option
  - concurrency limit
- Persist a batch run record with child runs.
- Reuse unified runs patterns where possible instead of inventing separate run UX.

### Data model additions

- batch run entity
- child test case run references
- aggregate counts:
  - total
  - passed
  - failed
  - errored
  - skipped

### Frontend work

- Add batch run action in Test Cases page.
- Add result screen with:
  - summary counts
  - per-test result rows
  - retry failed
  - open raw run detail
- Add visibility from History page so run tracking stays workspace-level.

### Deliverable

- A user can bulk run generated tests and review aggregate outcomes from one place.

## Architecture Notes

### Do not couple everything to requests

The clean pipeline is:

- Markdown document
- extraction
- API spec drafts
- accepted API specs
- generated requests and test cases
- runs

Requests alone are not a sufficient long-term canonical representation for test generation because API specs carry richer structure and are already the base for `gen-test`.

### Keep deterministic and AI paths separate

Do not hide whether the system used strict parsing or AI extraction.

The UI should always expose:

- import mode used
- warnings
- inferred fields
- confidence

### Use review steps before persistence

For AI extraction, do not immediately create requests or specs without review. Low-quality inferred fields will otherwise pollute the workspace.

## Proposed Milestone Breakdown

### Milestone A

- Extend deterministic importer for `01-authentication.md` style docs
- Add `base_url_override`
- Add tests

### Milestone B

- Add AI Markdown extraction endpoint
- Add review UI
- Persist accepted API specs

### Milestone C

- Add batch test generation from selected specs
- Add provenance metadata

### Milestone D

- Add batch test execution
- Add aggregate run history UI

## Risks

### Risk 1: AI over-inference

LLM extraction will invent required fields, auth headers, or response shapes unless the prompt and review flow are strict.

Mitigation:

- structured JSON output
- confidence scores
- warnings
- human review before save

### Risk 2: markdown format fragmentation

Real documentation styles vary widely.

Mitigation:

- support deterministic import for a known subset
- route all other formats into AI-assisted import

### Risk 3: duplicated data models

If requests, API specs, and tests all get generated independently from Markdown, data divergence will become hard to reason about.

Mitigation:

- make API specs the canonical extracted representation
- derive requests and tests from accepted specs

### Risk 4: batch execution complexity

Bulk test runs need concurrency control, stable partial failure handling, and aggregate reporting.

Mitigation:

- introduce a batch run parent record
- cap concurrency
- support retry failed only

## Suggested First Implementation

If only one slice should be built first, build Phase 1 before anything else.

Reason:

- it gives immediate value
- it is lower risk than AI extraction
- it validates the document shape using a real file already in the repo
- it creates a better fallback path even after AI import exists

## Definition Of Done For The End-State Feature

The feature is complete when a user can:

1. Upload `/Users/mingde/item/K/kest/docs/api/01-authentication.md`
2. Review the extracted endpoints
3. Persist them as API specs and requests
4. Generate test cases in bulk
5. Run the generated tests in bulk
6. Review all results from a workspace-level history surface

## File Placement Suggestions

Likely backend areas:

- `/Users/mingde/item/K/kest/api/internal/modules/importer`
- `/Users/mingde/item/K/kest/api/internal/modules/apispec`
- `/Users/mingde/item/K/kest/api/internal/modules/testcase`
- `/Users/mingde/item/K/kest/api/internal/modules/run`

Likely frontend areas:

- `/Users/mingde/item/K/kest/web/src/components/features/project/api-request-workbench.tsx`
- `/Users/mingde/item/K/kest/web/src/components/features/project/api-spec-management-page.tsx`
- `/Users/mingde/item/K/kest/web/src/components/features/project/test-case-management-page.tsx`
- `/Users/mingde/item/K/kest/web/src/components/features/project/project-workspace-page.tsx`
