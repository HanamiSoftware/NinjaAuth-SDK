# NinjaAuth documentation

This directory documents the SDK implementation on the branch being reviewed. The root [README](../README.md) is the public entry point.

## Document ownership

| Document | Authority |
|---|---|
| [Roadmap](ROADMAP.md) | Branch-specific implementation status, evidence, blockers and priorities |
| [API contract](API-CONTRACT.md) | Public SDK shape and SDK ↔ authentication-service request/response contract |
| [Architecture](ARCHITECTURE.md) | Responsibility boundaries and stable architectural decisions |
| [Development guide](DEVELOPMENT.md) | Local development workflow and validation commands |
| [Test plan](TEST-PLAN.md) | Automated regression coverage and browser/Worker integration matrix |
| [Core checkpoint](NINJAAUTH-CORE-CHECKPOINT.md) | Historical snapshot; not a live status source |

The roadmap is the status authority for the branch under review. The API contract is the contract authority. Historical checkpoints must not be treated as current implementation status.

## Related repositories

- [NinjaAuth SDK](https://github.com/HanamiSoftware/NinjaAuth-SDK)
- [NinjaURL Workers](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener)
- [NinjaURL Dashboard](https://github.com/HanamiSoftware/Ninja-URL-Dashboard)
- [NinjaURL Extension](https://github.com/HanamiSoftware/NinjaUrl-Extension)
- [Ninja Platform Data](https://github.com/HanamiSoftware/Ninja-Platform-Data)

The identity broker is an external dependency. Documentation here may describe the SDK integration contract, but does not authorize changes to the Ninja Connect repository.
