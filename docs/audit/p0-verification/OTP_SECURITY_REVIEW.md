# OTP Security Review

**File:** `backend/app/marketplace/otp.py`
**Call chain:** `routers/auth.py` → `issue_otp` / `verify_otp` → `OtpCode` model.

## What the code does (verified)

```
_hash(phone, code) = HMAC-SHA256(key, f"{phone}:{code}")          otp.py:26
key = settings.otp_pepper or settings.jwt_secret                   otp.py:34
```

- **Keyed hash:** `hmac.new(key, ...)` — verified. Not a bare digest.
- **Phone binding:** the message is `"{phone}:{code}"`, so a hash computed for
  one phone cannot match another. Verified.
- **Constant-time compare:** `hmac.compare_digest(_hash(phone, code),
  row.code_hash)` (`otp.py:74`). Verified.
- **Expiry:** `OTP_TTL_MINUTES = 5`; `verify_otp` rejects expired rows
  (`:67`), tz-normalising naive timestamps.
- **Attempt limit:** `MAX_VERIFY_ATTEMPTS = 5`; `attempts` incremented and
  flushed even on a wrong code (`:70`, `:73`).
- **Single-use / replay:** on success `row.consumed = True` (`:78`); `verify_otp`
  only selects `consumed.is_(False)` rows, newest first (`:59`). A consumed code
  cannot be replayed.
- **Production exposure — SAFE:** `issue_otp` returns the code, but the router
  returns it only in non-prod: `dev_code=None if settings.is_production else code`
  (`routers/auth.py:46`; schema `OtpRequestOut.dev_code` "never populated in
  production"). The code is **not** leaked in a production response.
- **No OTP in logs:** `_hash` and the routers never log the code; `observability`
  runs with `send_default_pii=False`.

## Secret / pepper handling

- `key = OTP_PEPPER or JWT_SECRET`. In production `validate_runtime()`
  (`config.py:123`) refuses to boot if `JWT_SECRET` is still the insecure
  default, so the fallback key is **always a strong, non-default secret in prod**
  — there is no silent downgrade to an empty/weak pepper. Verified.

### O‑1 — pepper falls back to JWT_SECRET (LOW, by design)
Reusing `JWT_SECRET` as the OTP key couples two secrets: rotating `JWT_SECRET`
invalidates in-flight OTPs (minor, ≤5 min) and a single leak widens blast radius.
- **Recommendation:** set a dedicated `OTP_PEPPER` in production (already
  documented as optional in `docs/P0_HARDENING.md`). Consider *requiring* it in
  prod via `validate_runtime()` if OTP is a primary auth factor.

### O‑2 — attempt cap is per-row, resettable by re-request (LOW)
`attempts` is tracked on the OtpCode row; a new `otp/request` inserts a new row
that `verify_otp` then prefers (newest unconsumed). So the 5-attempt cap resets
per issued code. The real throttle is the request limit
(`mp_otp:{ip}:{phone}` = 5 / 10 min, `routers/auth.py:30`): worst case ≈ 5
requests × 5 attempts = 25 guesses / 10 min against a 10⁶ space → negligible
brute-force risk. Acceptable; noted.
- **Recommendation (optional):** also cap *verify* attempts per phone+window, not
  only per row, for defence in depth.

### O‑3 — no legacy-hash compatibility (LOW, acceptable)
Old `sha256(code)` rows do not match the new HMAC. Because OTPs live ≤5 min, any
code in flight at deploy simply fails once and the user re-requests. No migration
needed. Documented. Acceptable.

### O‑4 — phone normalisation is minimal (LOW)
Both `issue` and `verify` are keyed on `phone.strip()` at the router; there is no
canonicalisation (e.g. `+91` / leading-zero variants). Issue and verify use the
same raw value, so correctness holds as long as the client sends a consistent
string — but two representations of the same number are distinct OTP namespaces.
- **Recommendation:** normalise to E.164 once at the edge before issue/verify.

## Coverage
The OTP happy path is tested (`test_marketplace.py:54`/`:58`, request→verify),
but **no test asserts** the keyed hash, phone-binding (wrong-phone rejection),
pepper usage, expiry, attempt cap, or single-use. The flow test would pass even
with the old `sha256`. See `TEST_EVIDENCE.md`.

## Area status: **PASS**
The OTP changes are correct and a genuine improvement: HMAC + phone binding +
constant-time compare, no production code leak, no silent weak-key downgrade.
Findings O‑1…O‑4 are low-severity hardening, not blockers. Add assertion-level
tests for the new properties.
