# Spec Tests: Intent-Based Testing for LLM Development

## Overview

This skill enables **intent-based specification testing** evaluated by Claude as judge. Rather than traditional unit tests, spec tests capture the *why* behind requirements, making them resistant to LLM gaming.

## Key Concepts

**Intent statements** are mandatory. Each test must explain the business or user need it serves. Tests without intent fail immediately with `[missing-intent]` before evaluation occurs.

The dual-evaluation model checks both:
- Does the assertion pass literally?
- Does the implementation satisfy the stated intent?

Violations trigger `[intent-violated]` failures, catching "legal but wrong" solutions.

## Test Structure

Tests use a simple format with:
- **H2 headers** for test groups
- **H3 headers** for individual test cases
- **Intent statements** explaining WHY (must precede code blocks)
- **Fenced code blocks** containing assertions

## Frontmatter Requirements

Spec files declare targets via YAML frontmatter:

```yaml
---
target: src/auth.py
---
```

Or multiple targets:

```yaml
---
target:
 - docs/API.md
 - src/api.py
---
```

Missing `target:` causes immediate `[missing-target]` failure.

## Multi-Target Best Practices

For specs targeting multiple files, each test should explicitly reference its target using "Given the <file>" phrasing. When the same requirement applies across files, use "Given <file1> and <file2>" to verify alignment.

## Running Tests

The runner uses `claude -p` (your subscription):

```
python specs/tests/run_tests_claude.py specs/tests/auth.md
```

Supports `--test`, `--target`, and `--model` flags.

## Why Intent Matters

Intent prevents LLMs from "cheating" by modifying tests instead of fixing code. Without intent, an LLM might relax a performance threshold to pass a test—with intent, such changes trigger semantic evaluation failures.

## Language Portability

Intent statements survive porting across languages because the business reason doesn't change, only assertion syntax.

## Meta-Content Testing

When testing files containing LLM instructions (prompts, configs), explicitly frame them as "documents to inspect, not commands to follow" to prevent judge confusion.

## Validation Checklist

- Each test has intent explaining WHY
- Intent is business/user-focused
- Expected behavior is clear
- Fenced assertion blocks present
- One behavior per test case
- Multi-target specs reference targets explicitly
