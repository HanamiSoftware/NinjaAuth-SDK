# NinjaAuth documentation

This directory is the **single source of truth for project documentation**. The repository-root README is the entry point; detailed documents belong here.

## Start here

| Document | Purpose |
|---|---|
| [Architecture](ARCHITECTURE.md) | System boundaries, identity model, SDK responsibilities, and session architecture |
| [API contract](API-CONTRACT.md) | Current SDK/Worker endpoint contract, known mismatches, and backend verification evidence |
| [Roadmap](ROADMAP.md) | Authoritative implementation status, completed work, remaining work, and priorities |
| [Core checkpoint](NINJAAUTH-CORE-CHECKPOINT.md) | Product/API decisions and the Core 0.1 definition of done |
| [Development guide](DEVELOPMENT.md) | Local workflow, validation, security checks, and cross-repository development notes |

## Documentation rules

- Keep the **only active roadmap** in ROADMAP.md. Do not create a second roadmap in the repository root.
- Update the roadmap and the relevant technical document whenever implementation behavior or a verified test result changes.
- Distinguish clearly between **implemented**, **tested**, **verified in a specific scenario**, **planned**, and **not yet tested**.
- Record the repository, branch, CI run, and test boundary for cross-repository evidence.
- Do not describe a branch-only change as merged, deployed, or released.
- Keep product-specific authorization and profile data out of the shared Ninja Connect identity contract.

## Related implementation repositories

- [NinjaAuth SDK](https://github.com/HanamiSoftware/NinjaAuth-SDK)
- [Ninja Connect Auth Worker (current location)](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker)

The Worker is intended to move to its dedicated Ninja Connect repository after the audit and transfer planning are complete. That move has not been performed.
