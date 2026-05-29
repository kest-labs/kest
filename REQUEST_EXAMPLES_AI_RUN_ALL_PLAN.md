# Request Examples AI Generate and Run All Plan

## Goal

Enhance the existing request `Examples` area instead of creating a separate `Tests` page.

The first version should let users:

- Generate multiple boundary-case examples with AI for the current request.
- Run all examples for the current request with one click.
- View a report in the same content area.

## Product Direction

Use request examples as executable test scenarios.

For the MVP, the user flow should stay inside the request workbench:

1. Open a request.
2. Review or create examples.
3. Click `AI Generate` to add boundary examples.
4. Click `Run All` to execute every example.
5. Read the run report directly in the `Examples` area.

This keeps the interface simple and avoids sending users to a separate test-case management page before the workflow needs that complexity.

## UI Plan

Primary file:

- `web/src/components/features/project/api-request-workbench.tsx`

Update `ExamplesPanel` with two new buttons next to the existing `Refresh` and `New Example` actions:

- `AI Generate`
- `Run All`

Each example card should eventually show the latest run state:

- `Pass`
- `Fail`
- `Error`
- response status
- duration

The panel should also show a run summary after `Run All`:

- total examples run
- passed count
- failed count
- error count
- total duration

The report can be displayed above the example list or directly below the panel header.

## Example-As-Test Model

Do not introduce a separate `Tests` page in the first version.

Treat each request example as one test scenario:

- request method
- URL
- headers
- query params
- path params
- body
- optional saved response status
- optional saved response body

Existing actions should remain:

- `Apply Example`
- `Capture Latest Response`
- `Set Default`
- `Edit`
- `Delete`

## Run All Plan

Add a frontend handler such as `handleRunAllExamples`.

Execution flow:

1. Ensure the current request is persisted.
2. Load all examples for the request.
3. Run examples sequentially through the existing local runner.
4. Resolve environment variables the same way as normal `Send`.
5. Collect per-example results.
6. Render the report in `ExamplesPanel`.

Sequential execution is preferred for the MVP to avoid overwhelming the local runner or target API.

### MVP Pass/Fail Rules

Use simple rules first:

- If an example has a saved `response_status`, actual status must match it.
- If an example has no expected status, `2xx` and `3xx` count as pass.
- `4xx` and `5xx` count as fail unless the saved expected status matches.
- Local runner/network errors count as error.

Later, add explicit assertion support.

## AI Generate Plan

Add a backend endpoint such as:

```text
POST /projects/:id/collections/:collectionId/requests/:requestId/examples/ai-generate
```

The endpoint should inspect:

- method
- URL/path
- headers
- query params
- path params
- body
- request docs
- existing examples

It should return multiple example drafts covering:

- happy path
- missing required parameter
- invalid path parameter
- empty value
- overlong string
- numeric boundary
- invalid enum
- malformed body
- missing authorization
- invalid authorization/header

The frontend can save accepted drafts as normal request examples.

## Report Plan

First version should keep reports in the page state.

Report fields:

- run id or timestamp
- summary counts
- per-example result
- request method and URL
- response status
- duration
- error message, if any
- response body preview

Later improvements:

- save run history
- export Markdown
- export HTML
- compare against previous run
- attach report to CI or CLI output

## Backend and Data Model Notes

The existing test-case model is currently more spec-oriented. For this MVP, avoid forcing request examples into the test-case table.

Possible future fields for examples:

- `expected_status`
- `assertions`
- `last_run_status`
- `last_run_at`
- `last_run_duration`

These are not required for the first usable version if report state is kept in the frontend.

## Recommended Implementation Order

1. Implement `Run All` for existing examples without AI.
2. Add the page-level report UI.
3. Add the AI generate endpoint and frontend action.
4. Persist run results if needed.
5. Add assertion editing only after the basic workflow is proven useful.

## Why This Approach

This keeps the request workflow compact:

- `Request` is the API operation.
- `Examples` are the scenarios.
- `Run All` executes the scenarios.
- `Report` explains the result.

A separate test interface should be introduced only when the product needs cross-request suites, CI scheduling, advanced assertions, historical reports, or team-level test management.
