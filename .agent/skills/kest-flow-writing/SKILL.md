# Kest Flow Writing Skill 🌊

Expertise in writing structured, chained API tests using Kest Flow (.flow.md). This skill ensures flows are written according to the highest standards of "Documentation as Code".

## 🎯 Standard Syntax (Scheme B - Recommended)

Always prefer the ` ```step ` block format for maximum expressiveness and future compatibility.

### 1. Step Structure
```step
@id <unique_id>
@name "<Human Readable Name>"
@retry <number> (optional)
@max-duration <ms> (optional)

METHOD /path/to/api
Header: value

{
  "json": "body"
}

[Captures]
var_name = json.path

[Asserts]
status == 200
body.field exists
```

### 2. Variable Chaining
- **Capture**: `var_name = data.path` (extracts from previous response)
- **Injection**: `{{var_name}}` (injects into URL, Headers, or Body)

## 🛠 AI Writing Rules
1. **Prefer Relative URLs**: Always use `/api/v1/...` instead of `https://...`.
2. **Sequential IDs**: Use meaningful IDs for steps (e.g., `login`, `create_user`).
3. **Robust Captures**: Use specific JSON paths for captures.
4. **English Asserts**: Use natural assertions like `status == 200`, `body exists`, `duration < 500`.
5. **Flow Metadata**: Include a ` ```flow ` block at the top for document-level settings.

## 📝 Prompt Template for Generating Flows
When asked to "generate a Kest flow", follow this pattern:
1. Define the business objective.
2. Step 1: Initial state (e.g., Login/Signup) + Capture credentials.
3. Steps 2-N: Domain operations + Chaining variables.
4. Final Step: Verification of state.
5. Add descriptive Markdown between code blocks.
