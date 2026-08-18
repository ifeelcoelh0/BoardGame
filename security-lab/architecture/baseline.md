# Security Lab — Baseline

## 1. Purpose

This document records the known state of **Reinos do Dragão** before beginning cybersecurity experiments.

The baseline provides a reference point for comparing system behaviour before and after:

* security testing;
* discovered vulnerabilities;
* deliberate vulnerable variants;
* mitigations;
* regression testing.

The stable game remains separated from experiments through the `security-LAB` branch.

---

## 2. Baseline Date

**2026-08-17**

---

## 3. Application

* **Project:** Reinos do Dragão
* **Application version:** `0.99.40`
* **Security Lab branch:** `security-LAB`
* **Baseline commit:** `5d24018`

---

## 4. Local Environment

* **Operating system:** Windows
* **Shell:** Git Bash
* **Node.js:** `v24.18.1`
* **npm:** `11.16.0`

---

## 5. Automated Test Baseline

Command executed:

```bash
npm test
```

Result:

```text
Tests:      633
Passed:     633
Failed:     0
Cancelled:  0
Skipped:    0
Todo:       0

Duration:   ~9.4 seconds
```

### Status

**PASS**

At the beginning of the Security Lab, all existing automated tests pass.

This gives us a known working state before performing security experiments.

---

## 6. Relevant Existing Security Behaviour

The current automated test suite already includes tests related to:

* authentication and player identity;
* session tokens and SHA-256 token hashing;
* session recovery and connection replacement;
* authoritative host actions;
* rejection of unauthenticated actors;
* action deduplication and idempotency;
* protocol validation;
* stale action rejection;
* private per-player state views;
* opponent hand redaction;
* session hash redaction;
* authoritative action journal privacy;
* save validation and invariants;
* replay verification;
* TURN credential handling;
* server-side provider secrets;
* chat identity enforcement;
* basic rate limiting.

These tests are part of the baseline, but they are **not considered proof that the application has no vulnerabilities**.

The Security Lab will independently test these assumptions from an attacker-controlled client perspective.

---

## 7. Baseline Security Assumption

For the first phase of the Security Lab:

> The browser of a remote player is considered untrusted.

A player may control or modify:

* the DOM;
* React/client-side state;
* browser storage;
* JavaScript execution;
* outgoing multiplayer messages;
* locally enforced validation.

Security decisions must therefore be enforced beyond the client-side trust boundary.

---

## 8. Checks Still Pending

The following baseline checks have not yet been recorded in this environment:

* `npm run verify`
* production build
* manual multiplayer smoke test
* browser versions
* deployed version verification

These will be added when performed.

---

## 9. Baseline Rule

If a security experiment intentionally changes application behaviour, the original baseline must remain recoverable through Git.

The stable/playable version of the game must not be deliberately weakened for security demonstrations.
