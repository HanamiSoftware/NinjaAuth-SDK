# NinjaAuth documentation

This directory is the authoritative documentation set for the NinjaAuth SDK. The repository-root README is the entry point; detailed technical status and contracts live here.

## Document ownership

| Document | Authority |
|---|---|
| [Roadmap](ROADMAP.md) | Single source of truth for implementation status, branch boundaries, evidence, blockers, and priorities |
| [API contract](API-CONTRACT.md) | SDK ↔ Worker request/response contract and verification boundaries |
| [Architecture](ARCHITECTURE.md) | Stable responsibility boundaries and architectural decisions |
| [Development guide](DEVELOPMENT.md) | Reproducible local workflow and validation commands |
| [Core checkpoint](NINJAAUTH-CORE-CHECKPOINT.md) | Historical checkpoint; not a live status source |
| [Former 1.0.1-beta notes](RELEASE-NOTES-v1.0.1-beta.md) | Superseded historical record; its milestone/version claim is invalid |

## Documentation rules

- Update the roadmap when implementation status, branch state, evidence, or priorities change.
- Update the relevant technical contract when behavior or API changes.
- Distinguish **implemented**, **tested**, **verified in a specific scenario**, **planned**, and **not verified**.
- State the exact repository, branch, commit, and test boundary for evidence.
- Never describe a test suite as passing merely because test files exist.
- Never infer that generated artifacts match source; inspect the artifacts.
- Never use a planning label as a package version. The current package and source runtime version are 0.1.0.
- A branch-specific statement must name its branch. Do not copy status between master and dev without checking both.

## Related implementation repositories

- [NinjaAuth SDK](https://github.com/HanamiSoftware/NinjaAuth-SDK)
- [Ninja Connect Auth Worker — current location](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker)

The Worker is intended to move to its dedicated Ninja Connect repository after audit and transfer planning are complete.
