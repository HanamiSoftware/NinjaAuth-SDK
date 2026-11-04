# NinjaAuth documentation

This directory documents the SDK implementation on the branch being reviewed. The root README is the entry point.

## Document ownership

| Document | Authority |
|---|---|
| [Roadmap](ROADMAP.md) | Authoritative status for this branch, including exact evidence, blockers, and priorities |
| [API contract](API-CONTRACT.md) | SDK ↔ Worker request/response contract and public API shape |
| [Architecture](ARCHITECTURE.md) | Stable responsibility boundaries and architectural decisions |
| [Development guide](DEVELOPMENT.md) | Local workflow and validation commands |
| [Core checkpoint](NINJAAUTH-CORE-CHECKPOINT.md) | Historical snapshot; not a live status source |

## Documentation rules

- Name the repository, branch, and commit for implementation claims.
- Distinguish **implemented**, **test present**, **test executed**, **verified in a scenario**, and **not verified**.
- A test file or a CI workflow is not evidence of a passing run.
- Inspect source and generated artifacts separately.
- Document public API behavior exactly as exported; do not copy an intended API shape over an implementation mismatch.
- Keep master and dev status separate. The branches are divergent.
- The package and runtime source version are 0.1.0. Do not use the former 1.0.1-beta wording as a milestone or version.

## Related repositories

- [NinjaAuth SDK](https://github.com/HanamiSoftware/NinjaAuth-SDK)
- [Ninja Connect Auth Worker — current location](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker)
