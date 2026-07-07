# Secret Management Policy

> **Last updated:** 2026-06-24
> **Scope:** All repositories in the Scout monorepo

## 1. Secret Rotation Policy

| Secret Type              | Rotation Frequency | Responsible Party     |
|--------------------------|--------------------|-----------------------|
| Database credentials     | Every 90 days      | DevOps / Lead Engineer|
| API keys (Stripe, etc.)  | Every 180 days     | Service Owner         |
| Authentication secrets   | Every 90 days      | Auth Lead             |
| Service role keys        | Every 90 days      | Lead Engineer         |
| OAuth client secrets     | Every 180 days     | Auth Lead             |
| Encryption keys          | Every 365 days     | Security Lead         |

**Rotation triggers (immediate):**
- Any suspected or confirmed leak
- Employee departure with access to secrets
- Post-incident remediation

**Rotation process:**
1. Generate a new secret in the service provider's dashboard.
2. Update `apps/web/.env.local` and the CI/CD secrets store.
3. Deploy the change and verify all services are operational.
4. Revoke the old secret after 24 hours of successful operation.

---

## 2. Where Secrets Live

| Environment | Location                        | Access Control            |
|-------------|---------------------------------|---------------------------|
| Local dev   | `apps/web/.env.local`           | Local filesystem only     |
| CI/CD       | GitHub Actions secrets           | Repository admins         |
| Production  | Environment variables on host    | Deploy pipeline + admins  |

**Never commit secrets to Git.** The `.env.local` file is listed in `.gitignore` and must never be added manually.

---

## 3. How to Add a New Secret

### Step 1: Add the variable name to `.env.example`

```bash
# apps/web/.env.example
NEW_SERVICE_API_KEY=your-key-here
```

### Step 2: Set the value locally

```bash
# apps/web/.env.local
NEW_SERVICE_API_KEY=sk_actual_key_value
```

### Step 3: Add to CI/CD secrets

For **GitHub Actions**, go to:
`Settings > Secrets and variables > Actions`

Add a new repository secret with the same variable name.

Then update any workflow that consumes it (e.g., `deploy.yml`):

```yaml
- name: Deploy
  env:
    NEW_SERVICE_API_KEY: ${{ secrets.NEW_SERVICE_API_KEY }}
  run: ...
```

### Step 4: Add a scanning pattern

If the new secret has a recognizable format (prefix, length, character set), add a regex pattern to the secret scanner:

- **Pre-commit hook:** Add the pattern to `SECRET_PATTERNS` in `.githooks/pre-commit`
- **CI workflow:** Add the pattern to the `PATTERNS` array in `.github/workflows/secret-scan.yml`

### Step 5: Document usage

Add a brief note in this file describing:
- What the secret is used for
- Which service/endpoint it authenticates against
- Rotation cadence (if different from defaults above)

---

## 4. What to Do If a Secret Is Leaked

### 🔴 Immediate Response (within 1 hour)

1. **Revoke the compromised secret immediately** at the service provider.
2. **Generate a new secret** and deploy it.
3. **Scan Git history** for any commits containing the secret:
   ```bash
   git log --all --oneline -p | grep -i "leaked-pattern"
   ```
4. **If found in Git history:**
   ```bash
   # Remove the file from git history (BFG Repo-Cleaner recommended)
   # bfg --replace-text secrets.txt
   # Force-push to all branches:
   git push --force --all origin
   ```
5. **Notify the team** via the `#security` Slack channel.

### 🟡 Investigation (within 24 hours)

1. Determine **how** the secret was leaked:
   - Accidental commit? → Add to `.gitignore` / improve pre-commit checks
   - Exposed in logs? → Audit logging configuration
   - Third-party breach? → Rotate all shared secrets
2. Determine **exposure scope**:
   - Was it ever committed to a public branch?
   - Were there any unauthorized API calls using the compromised key?
   - Check service provider audit logs for unusual activity.
3. **Determine impact**:
   - Data exposed?
   - Services compromised?
   - Regulatory notification required?

### 🟢 Remediation (within 1 week)

1. **Update scanning rules** to detect this pattern earlier.
2. **Add the secret type** to this policy document.
3. **Conduct a team training** if the leak was due to human error.
4. **Consider automated prevention** tools:
   - Pre-commit hooks (already in place)
   - CI/CD scanning (already in place)
   - Git history scanning on push (`git-secrets`, `truffleHog`)

### 📋 Post-Incident Checklist

- [ ] Secret revoked
- [ ] New secret deployed
- [ ] Git history scrubbed (if needed)
- [ ] Scan rules updated
- [ ] Team notified
- [ ] Root cause documented
- [ ] Prevention improvements implemented

---

## 5. Allowed / Denied Patterns

### ✅ Allowed in code
- `process.env.SECRET_NAME` references (the key name, not the value)
- Placeholder values in `.env.example` (e.g., `your-key-here`)
- Public keys (e.g., Stripe publishable keys prefixed `pk_test_` or `pk_live_`)
- Test tokens explicitly marked `// test token`

### ❌ Never commit
- Actual secret values of any kind
- `.env`, `.env.local`, `.env.production` files
- Service account JSON keys
- `.pem` or `.key` private key files
- Session tokens, refresh tokens, or JWT tokens
- Database connection strings with credentials

---

## 6. Pre-commit & CI Scanning

| Layer       | Tool                  | When it runs                  |
|-------------|-----------------------|-------------------------------|
| Pre-commit  | `.githooks/pre-commit`| On every `git commit`         |
| CI          | `secret-scan.yml`     | On every PR push              |

Both tools scan for:
- 40+ common secret patterns (API keys, tokens, credentials)
- `process.env` references inside `console.log` / `console.error` calls

If a scan fails:
1. Read the error output to identify the offending file and pattern.
2. Remove or replace the secret value.
3. If it's a **false positive**, add an exception comment or tweak the pattern.
4. Re-try the commit or push.

**To bypass pre-commit hook (not recommended):** `git commit --no-verify`
**To bypass CI scan (not recommended):** Remove the file from the PR or adjust the scan configuration.

---

## 7. Tools & References

- [truffleHog – Git secret scanner](https://github.com/trufflesecurity/trufflehog)
- [git-secrets – Prevent committing secrets](https://github.com/awslabs/git-secrets)
- [BFG Repo-Cleaner – Remove sensitive data from Git](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub secret scanning documentation](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
