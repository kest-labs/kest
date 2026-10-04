#!/usr/bin/env python3
"""Render a Kest JSON result (schema_version 1) as a GitHub job summary.

Reads KEST_JSON_FILE and KEST_EXIT_CODE, appends Markdown to
GITHUB_STEP_SUMMARY and writes passed/failed counts to GITHUB_OUTPUT.
"""

import json
import os
import sys

MAX_ROWS = 50
MAX_MESSAGE = 300


def cell(value):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", "<br>").replace("|", "\\|")
    if len(text) > MAX_MESSAGE:
        text = text[: MAX_MESSAGE - 3] + "..."
    return text


def append(path_env, text):
    path = os.environ.get(path_env)
    if not path:
        sys.stdout.write(text)
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(text)


def main():
    exit_code = os.environ.get("KEST_EXIT_CODE", "")
    json_file = os.environ.get("KEST_JSON_FILE", "")

    try:
        with open(json_file, encoding="utf-8") as handle:
            result = json.load(handle)
    except (OSError, ValueError) as exc:
        append(
            "GITHUB_STEP_SUMMARY",
            f"## Kest\n\n:x: No readable Kest result (exit code {exit_code}): {cell(exc)}\n",
        )
        append("GITHUB_OUTPUT", "passed=0\nfailed=0\n")
        return 0

    summary = result.get("summary") or {}
    steps = result.get("steps") or []
    ok = result.get("ok", False)
    passed = summary.get("passed", 0)
    failed = summary.get("failed", 0)
    skipped = summary.get("skipped", 0)
    duration = summary.get("duration_ms", 0)

    icon = ":white_check_mark:" if ok else ":x:"
    lines = [
        f"## {icon} Kest: {passed} passed, {failed} failed, {skipped} skipped",
        "",
        f"Exit code `{result.get('exit_code', exit_code)}` in {duration / 1000:.2f}s",
        "",
    ]

    error = result.get("error")
    if error:
        lines += [f"**Error ({cell(error.get('kind'))}):** {cell(error.get('message'))}", ""]

    failures = [step for step in steps if not step.get("ok")]
    if failures:
        lines += [
            "### Failed steps",
            "",
            "| Step | Request | Status | Kind | Details |",
            "| --- | --- | --- | --- | --- |",
        ]
        for step in failures[:MAX_ROWS]:
            err = step.get("error") or {}
            failed_asserts = [a.get("expr") for a in step.get("assertions") or [] if not a.get("ok")]
            details = err.get("message", "")
            if failed_asserts:
                details = "Failed: " + ", ".join(f"`{a}`" for a in failed_asserts)
            name = step.get("name", "")
            if step.get("source"):
                name = f"{name}<br><sub>{step['source']}</sub>"
            lines.append(
                "| {name} | {method} {url} | {status} | {kind} | {details} |".format(
                    name=cell(name),
                    method=cell(step.get("method", "")),
                    url=cell(step.get("url", "")),
                    status=cell(step.get("status") or "-"),
                    kind=cell(err.get("kind", "")),
                    details=cell(details),
                )
            )
        if len(failures) > MAX_ROWS:
            lines.append(f"\n_{len(failures) - MAX_ROWS} more failed steps omitted._")
        lines.append("")

    if steps:
        lines += [
            "<details><summary>All steps</summary>",
            "",
            "| | Step | Request | Status | Duration |",
            "| --- | --- | --- | --- | --- |",
        ]
        for step in steps[: MAX_ROWS * 4]:
            mark = ":white_check_mark:" if step.get("ok") else ":x:"
            lines.append(
                f"| {mark} | {cell(step.get('name'))} | {cell(step.get('method', ''))} {cell(step.get('url', ''))} "
                f"| {cell(step.get('status') or '-')} | {step.get('duration_ms', 0)}ms |"
            )
        lines += ["", "</details>", ""]

    append("GITHUB_STEP_SUMMARY", "\n".join(lines) + "\n")
    append("GITHUB_OUTPUT", f"passed={passed}\nfailed={failed}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
