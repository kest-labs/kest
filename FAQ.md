# Kest CLI FAQ

## History

### Q1: What's the difference between `kest history` and `kest history --global`?

**A:** Kest has two history modes:

#### Project-Level History (default)
- **When**: Run `kest history` inside a directory with `.kest/config.yaml`
- **Shows**: Only the **current project's** test records
- **Purpose**: Keep context clean, no interference from other projects

```bash
cd /path/to/my-api-project
kest history
# Only shows my-api-project's tests
```

#### Global History
- **When**: Use `kest history --global` or run outside a project directory
- **Shows**: Records from **all projects**
- **Purpose**: Cross-project search and overview

```bash
# Option 1: Use --global flag
kest history --global

# Option 2: Run outside a project directory
cd /tmp
kest history  # Falls back to global mode
```

---

### Q2: Why can't I see Project B's tests from Project A?

**A:** This is **by design**, not a bug!

Kest uses **ProjectID** to isolate history between projects:

1. **Clear context**: Each project only sees its own test history
2. **Variable isolation**: Variables from different projects don't interfere
3. **Environment isolation**: dev/staging/prod environments are managed per project

**Solutions**:

```bash
# Option 1: Switch to Project B's directory
cd /path/to/project-b
kest history

# Option 2: Use global history
kest history --global

# Option 3: Search global history for a specific URL
kest history --global | grep "project-b-api.com"
```

---

### Q3: Where are test records stored?

**A:** All records are stored in a **global SQLite database**:

```
~/.kest/records.db
```

This database contains:
- Request/response history for all projects
- Captured variables (isolated by project and environment)
- Metadata (timestamps, ProjectID, environment, etc.)

**Inspect the database**:

```bash
sqlite3 ~/.kest/records.db
> SELECT id, method, url, project_id FROM requests ORDER BY id DESC LIMIT 10;
```

---

### Q4: Where are log files?

**A:** Kest supports two levels of logging:

#### 1. Project-Level Logs (preferred)
- **Location**: `.kest/logs/`
- **Condition**: Project initialized with `log_enabled: true`
- **Purpose**: Detailed request/response tracing

```bash
cd my-project
cat .kest/config.yaml
# log_enabled: true

ls -lh .kest/logs/
cat .kest/logs/2026-01-30_00-30-16_GET_api_users.log
```

#### 2. Global Logs (fallback)
- **Location**: `~/.kest/logs/`
- **Condition**: When project is not initialized or logging is not enabled
- **Purpose**: Ensures all requests have a log trail

---

### Q5: How do I clean up history?

**A:** Kest does not auto-purge history. Manual options:

```bash
# Option 1: Delete the entire database (use with caution!)
rm ~/.kest/records.db

# Option 2: Delete records for a specific project
sqlite3 ~/.kest/records.db
> DELETE FROM requests WHERE project_id = 'my-old-project';

# Option 3: Delete old records
sqlite3 ~/.kest/records.db
> DELETE FROM requests WHERE created_at < datetime('now', '-30 days');

# Option 4: Clear all history but keep schema
sqlite3 ~/.kest/records.db
> DELETE FROM requests;
> DELETE FROM variables;
```

---

## Features

### Q6: Why doesn't parallel mode show detailed output?

**A:** This is **intentional**. In parallel mode:

- **Hidden**: Individual response bodies for each request
- **Shown**: Final test summary report

**Reasons**:
1. Parallel output would be interleaved and unreadable
2. You care about the overall result, not individual request details
3. All details are still saved in history and logs

**View details after parallel runs**:

```bash
kest run tests.kest --parallel
kest show last
cat .kest/logs/*.log | tail -100
```

---

### Q7: Does duration assertion trigger retries?

**A:** Yes! When using both `--max-time` and `--retry`:

```bash
kest get /api/slow --max-time 1000 --retry 3
```

**Behavior**:
1. First request: 1500ms — exceeds limit, retry triggered
2. Retry 1: 1200ms — still too slow, retry again
3. Retry 2: 800ms — success!

**Output**:
```
⏱️  Retry attempt 1/3 (waiting 1000ms)...
⏱️  Retry attempt 2/3 (waiting 1000ms)...
✅ Request succeeded on retry 2
```

---

### Q8: Are gRPC requests recorded in history?

**A:** Yes! gRPC requests are treated the same as REST:

- Saved to the history database
- Visible in `kest history`
- Viewable with `kest show <id>`
- Logged to files if logging is enabled

```bash
kest grpc localhost:50051 test.Service Say '{"msg":"hi"}'

kest history
# #35   00:40:12 today    GRPC   localhost:50051/test.Service/Say  200    45ms

kest show 35
```

---

## Troubleshooting

### Q9: Why does `kest history` show "Total: 0 records"?

Possible causes:

1. **Database not created yet**:
   ```bash
   ls -l ~/.kest/records.db
   # If it doesn't exist, make any request to create it
   kest get https://httpbin.org/uuid
   ```

2. **ProjectID mismatch** (no tests for current project):
   ```bash
   kest history --global
   ```

3. **Database permission issue**:
   ```bash
   chmod 644 ~/.kest/records.db
   ```

---

### Q10: Are variables shared between projects?

**A:** No! Variables are **isolated by project and environment**.

```bash
# Project A
cd /path/to/project-a
kest post /login -c "token=data.token"
kest vars  # Shows token

# Project B
cd /path/to/project-b
kest vars  # Does NOT show Project A's token (this is correct!)
```

**Design rationale**:
- Different projects have independent APIs
- Prevents variable pollution and accidental conflicts
- Each project has its own variable namespace and environment config

---

## Best Practices

### Q11: When should I use `--no-record`?

**A:** Use it in these scenarios:

1. **Sensitive data testing**:
   ```bash
   kest post /auth -d '{"password":"secret"}' --no-record
   ```

2. **Temporary experiments**:
   ```bash
   kest get /test-endpoint --no-record
   ```

3. **High-frequency polling**:
   ```bash
   while true; do
     kest get /health --no-record
     sleep 5
   done
   ```

---

### Q12: How do I use Kest in CI/CD?

**A:** Recommended setup:

```yaml
# .github/workflows/api-test.yml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Kest
        run: go install github.com/kest-labs/kest/cmd/kest@latest

      - name: Run API Tests
        run: |
          cd api-tests
          kest run tests/ --parallel --jobs 8 --quiet --output json

      - name: Performance Gate
        run: |
          kest get https://api.example.com/health --max-time 500
          kest get https://api.example.com/search --max-time 1000
```

**Key points**:
- Use `--parallel` to speed up tests
- Use `--max-time` for performance gates
- Use `--quiet --output json` for clean CI output
- Failed tests automatically return non-zero exit codes (1=assertion fail, 2=runtime error)

---

Have a question not listed here? [Open an issue!](https://github.com/kest-labs/kest/issues) 🚀
