# Security & Repository Hygiene

This project follows the enhancements proposed in the enouveau.io improvement plan. Use the checklist below when maintaining the blog or the #30DiasJava repositories.

## Branch & Access Controls

- Enable branch protection on `main` (PRs only, required checks, at least one approving review).
- Require signed commits for protected branches and tag releases with signed tags when publishing.
- Limit token scopes; prefer deploy keys or environment-specific secrets.

## Automation & Scanning

- Enable GitHub Dependabot alerts and security updates (`dependabot.yml`).
- Enable secret scanning and vigilant mode to block exposed credentials.
- Add GitHub code scanning (CodeQL or equivalent) for Java/Jekyll builds.
- Keep GitHub Action workflows with least-privilege token permissions and avoid storing credentials in artifacts.

## Infrastructure & Hosting

- Enforce HTTPS and HSTS on the deployed site; monitor TLS expiry.
- Define a Content Security Policy (CSP) along with `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` headers via CDN or hosting configuration.
- Maintain regular backups or tagged releases of the static site build for rollbacks.

## Documentation

- Update `CONTRIBUTING.md` and this `SECURITY.md` when workflows change.
- Reference the Resources Hub for playbooks (Resilience4j, Config Server, Observability, pre-golive script) to keep operational knowledge centralised.

## Implementation Status

- [ ] Branch protection enforced on `main` (30DiasJava, adelmonsouza.github.io)
- [ ] Dependabot alerts + weekly updates enabled
- [ ] GitHub secret scanning & vigilant mode active
- [ ] Code scanning workflow (CodeQL) configured
- [ ] HTTPS enforcement + HSTS/CSP headers applied at hosting layer
