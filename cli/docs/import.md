# Importing into Kest (`kest import`)

`kest import` converts what your team already has — Postman collections, curl
commands, OpenAPI specs — into Kest Markdown flows (`.flow.md`). The goal is a
low-friction switch: you get runnable flows immediately, and everything that
could not be translated safely is kept in the file for manual review instead of
being silently dropped.

```bash
kest import postman <collection.json> [--env <environment.json>] [-o dir] [--write-config]
kest import curl ["curl ..."]          [-o file.flow.md [--append]] [--absolute]
kest import openapi <spec.yaml|json|url> [-o dir] [--write-config]
```

Common flags:

| Flag | Meaning |
| :--- | :--- |
| `-o, --out` | Output directory (`postman`, `openapi`) or `.flow.md` file (`curl`). Default: `.kest/flow` when the current directory has a `.kest` workspace, otherwise `.` |
| `--force` | Overwrite existing files (the importer refuses by default) |
| `--write-config` | Merge `base_url` and non-secret variables into the workspace `.kest/config.yaml` (existing values are never overwritten) |
| `--env-name` | Name of the Kest environment to create (default: the Postman environment name, or `dev` for OpenAPI) |

Without `--write-config` the importer prints a YAML snippet you can paste into
`.kest/config.yaml`.

## Ground rules

* **Relative URLs + `base_url`.** The most common URL prefix (`{{baseUrl}}` or a
  literal origin) becomes the environment `base_url`; steps use relative paths
  so the same flow runs against dev, staging and production
  (`kest env use <name>` or `kest run --base-url ...`).
* **Variables are snake_case.** `{{baseUrl}}` → `{{base_url}}`,
  `{{userId}}` → `{{user_id}}`. Kest reads `.kest/config.yaml` case-insensitively,
  so mixed-case names would not resolve reliably. Names are renamed consistently
  in URLs, headers, bodies and captures.
* **Secrets are never copied.** Credentials become variables. Values from
  Postman environments marked `secret`, variables whose names look like
  credentials (`token`, `password`, `apiKey`, `secret`, ...), variables used by
  auth, and literal credentials in `Authorization`/`X-API-Key`/`Cookie` headers
  are all withheld. The summary prints the `--var name=...` flags you need. A
  secret that a step captures at run time (e.g. a login token) is not listed.
* **Nothing is lost.** Untranslatable content is kept below the step as a
  `> **Manual review:**` note with the original code, and every such item is
  counted in the warning summary at the end of the import.

## Postman (Collection v2.0 / v2.1)

```bash
kest import postman acme.postman_collection.json \
  --env acme-staging.postman_environment.json \
  -o .kest/flow/acme
kest env use acme_staging        # after --write-config
kest run .kest/flow/acme --var user_password=...
```

| Postman | Kest |
| :--- | :--- |
| Top-level folder | One `.flow.md` file (`orders.flow.md`) |
| Requests outside folders | `<collection-name>.flow.md` |
| Nested folders | `## Folder / Sub-folder` sections in the parent file |
| Request | ` ```step ` block with `@id` / `@name` |
| `{{var}}` | `{{var}}` (snake_case) |
| `:id` path variables | `{{id}}`; the example value goes to the environment |
| Query params (disabled ones skipped) | `[Queries]` |
| Raw / JSON / XML body | Body + `Content-Type` from the raw language |
| `x-www-form-urlencoded` body | URL-encoded body |
| GraphQL body | JSON `{"query": ..., "variables": ...}` |
| Collection / folder / request auth (inherited) | Header with variables |
| `bearer` | `Authorization: Bearer {{token}}` (or the variable used in Postman) |
| `basic` | `Authorization: Basic {{$basicAuth(user_var, pass_var)}}`, reusing the Postman variables (or `basic_username` / `basic_password`); the password is never copied |
| `apikey` (header or query) | `<key>: {{var}}` header or query param |
| Collection variables + environment file | Environment snippet / `--write-config` |
| Dynamic variables | `$guid`/`$randomUUID` → `$uuid`, `$timestamp`, `$isoTimestamp` → `$isoDate`, `$randomInt`, `$randomEmail` |

Requests with no Postman test script get `status >= 200` / `status < 300`,
matching curl and OpenAPI imports. Requests whose test script could not be
translated get no guessed assertion; the script is kept as a note instead.

### Test scripts

Only statements whose meaning is unambiguous are translated:

| Postman | Kest |
| :--- | :--- |
| `pm.response.to.have.status(201)` / `pm.expect(pm.response.code).to.eql(201)` / `tests["..."] = responseCode.code === 201` | `status == 201` |
| `pm.response.to.be.ok` | `status == 200` |
| `pm.response.to.be.success` | `status >= 200`, `status < 300` |
| `pm.expect(json.a.b).to.eql("x")` (string, number, boolean literals) | `body.a.b == "x"` |
| `pm.expect(json.ok).to.be.true` | `body.ok == true` |
| `pm.expect(json.a).to.exist` / `pm.expect(json).to.have.property("a")` | `body.a exists` |
| `pm.expect(json.items).to.have.lengthOf(3)` | `body.items length == 3` |
| `pm.expect(pm.response.responseTime).to.be.below(500)` | `duration < 500` |
| `pm.environment.set("token", json.access_token)` (also `collectionVariables`, `globals`, `postman.setEnvironmentVariable`) | `[Captures] token = access_token` |

`json` is any variable assigned from `pm.response.json()` or
`JSON.parse(responseBody)`. `pm.test(...)` wrappers, comments and `console.log`
are ignored.

If a script contains anything else, the translated statements are kept and the
**whole original script** is attached as a note. If it contains control flow
(`if`, loops, `forEach`, `try`, ternaries, `pm.sendRequest`, ...) **nothing** is
translated, because the assertions might be conditional.

### Not translated (kept as notes, counted in the summary)

* Pre-request scripts (request, folder and collection level). Consider an
  [`@type exec` step](../FLOW_GUIDE.md) for signing or token generation.
* Folder- and collection-level test scripts.
* `multipart/form-data` and binary file bodies.
* Auth types other than `bearer`, `basic`, `apikey` and `noauth`
  (OAuth 1/2, digest, AWS SigV4, NTLM, Hawk, ...).
* Postman dynamic variables without a Kest equivalent (e.g. `{{$randomColor}}`).
* Collection v1 exports are rejected — re-export as v2.1.

## curl

```bash
kest import curl "curl -X POST 'https://api.example.com/v1/users?invite=true' \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer eyJ...' \
  -d '{\"name\":\"kest\"}'"
```

prints

````markdown
```step
@id post-v1-users
@name POST /v1/users

POST /v1/users
Content-Type: application/json
Authorization: Bearer {{token}}
[Queries]
invite=true
[Body]
{
  "name": "kest"
}

[Asserts]
status >= 200
status < 300
```
````

and, on stderr, the `base_url` to configure plus `--var token=...`.

* Input: one quoted argument, unquoted arguments (`kest import curl curl -X POST ...`),
  or stdin (`pbpaste | kest import curl`). Line continuations, single/double
  quotes and `$'...'` are supported, so "Copy as cURL" from browser dev tools works.
* Supported flags: `-X/--request`, `-H/--header`, `-d/--data/--data-raw/--data-binary/--data-ascii`,
  `--data-urlencode`, `--json`, `-G/--get`, `-I/--head`, `-u/--user`, `--oauth2-bearer`,
  `-A/--user-agent`, `-e/--referer`, `-b/--cookie`, `--url`. Transport flags
  (`-s`, `-L`, `-k`, `--compressed`, `-o`, `--max-time`, ...) are ignored.
* `-u user:pass` becomes `Authorization: Basic {{$basicAuth(basic_username, basic_password)}}`
  (the username is kept as a variable, the password must be passed with `--var`); bearer tokens,
  API keys and cookies become variables.
* `-F/--form` (multipart) and `-T/--upload-file` are not translated (note + warning).
* `-o file.flow.md` writes a complete flow file; add `--append` to add the step
  to an existing file (the step id is made unique). `--absolute` keeps the full URL.

## OpenAPI (3.x, Swagger 2.0)

```bash
kest import openapi openapi.yaml -o .kest/flow/smoke
kest import openapi https://petstore3.swagger.io/api/v3/openapi.json
```

* One `<tag>.smoke.flow.md` per tag (first tag of each operation; untagged
  operations go to `default.smoke.flow.md`), one step per operation, ordered by
  path then method.
* `base_url` comes from `servers[0]` (server variables use their defaults).
  Swagger 2.0 specs are converted with kin-openapi (`host` + `basePath`).
* Path templates `{petId}` → `{{pet_id}}`; parameter examples/defaults/enums go
  into the environment.
* Required query and header parameters are added (example value or a
  variable; `format: uuid` headers use `{{$uuid}}`). Optional ones are skipped.
* JSON request bodies use the media-type `example`/`examples`, otherwise an
  example built from the schema (`example`, `default`, first `enum`, then a
  type-based placeholder; `readOnly` properties are skipped). Form-urlencoded
  bodies are supported; other content types produce a warning.
* Security: HTTP bearer → `Authorization: Bearer {{token}}`, HTTP basic →
  `Basic {{$basicAuth(basic_username, basic_password)}}`, apiKey → header/query/cookie with a variable,
  OAuth2/OpenID Connect → bearer token (with a warning). `security: []` on an
  operation disables auth for it.
* Assertion: `status == <lowest documented 2xx>`, or `status >= 200` +
  `status < 300` for `2XX` or when no 2xx response is documented.

The older `kest generate -f spec.json` command is deprecated: it still runs but
prints a notice pointing here. `kest import openapi` emits `step` blocks with
assertions, variables and auth.

## After importing

1. Review the `Manual review` notes (`grep -rn "Manual review" .kest/flow`).
2. Configure the environment (`--write-config` or paste the snippet) and
   switch to it: `kest env use <name>`.
3. Run: `kest run .kest/flow --var token=...`.
