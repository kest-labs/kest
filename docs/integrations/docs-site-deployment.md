# Docs site deployment

Kest's public documentation is built from the Mintlify content under `docs-site/`.

## Required Mintlify setup

Configure the Mintlify project with:

- Repository: `kest-labs/kest`
- Branch: `main`
- Root directory: `docs-site`
- Custom domain: `docs.kest.dev`

The Mintlify GitHub App must be installed for `kest-labs/kest` and allowed to read the repository.

## GitHub Actions

`.github/workflows/deploy-docs.yml` validates docs changes on pull requests that touch `docs-site/**`.

On pushes to `main`, the workflow calls the Mintlify deployment API after validation passes. Add these repository secrets before relying on automatic deployment:

- `MINTLIFY_API_KEY`
- `MINTLIFY_PROJECT_ID`

If either secret is missing, the workflow prints a warning and exits successfully. This keeps docs validation useful before the deployment credentials are configured.

## Local validation

From the repository root:

```bash
cd docs-site
npm install -g mint
mint validate
```

Also verify the navigation file is valid JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('docs-site/docs.json','utf8')); console.log('docs.json valid')"
```

## Manual deploy fallback

If automatic deployment does not publish changes to `docs.kest.dev`, use the Mintlify dashboard to manually deploy the project. Confirm the project still points at `main` and `docs-site` before deploying.
