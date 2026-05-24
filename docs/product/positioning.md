# Product Positioning

Nipmod is the package layer for AI agents.

Agents use Nipmod to search packages, inspect trust, and get safe install plans before touching a workspace.

## What Nipmod Is

Nipmod is an agent-friendly package intelligence layer over existing ecosystems:

- npm
- PyPI
- Hugging Face models and datasets
- GitHub
- MCP registries

Nipmod makes package decisions readable for agents by returning normalized records, source context, trust factors, warnings, install plans and archive receipts.

## What Nipmod Is Not

Nipmod is not a replacement for npm, PyPI, Hugging Face, GitHub or MCP registries.

Nipmod does not bulk mirror package artifacts by default. It does not take ownership of external packages. It does not treat popularity as verification. It does not execute install commands through the hosted API.

## Core Message

Nipmod does not replace package registries. Nipmod makes existing package ecosystems readable and safer for AI agents.

## Product Flow

1. Search.
2. Inspect.
3. Install Plan.
4. User or host approval.
5. Optional archive confirmation after useful discovery.

Search, Inspect and Install Plan are read-only hosted actions. They do not download packages, run package managers or edit local files.

## Public Claims Standard

Use precise language:

| Say | Do Not Say |
| --- | --- |
| Package layer for AI agents | New npm |
| Package intelligence over existing sources | Replacement registry |
| Safe install plans before workspace writes | Hosted API installs packages |
| Confirmed package intelligence records | Verified packages from search alone |
| Public beta, rate limited | Unlimited production access |

## Why This Matters

Human package managers mostly answer "how do I install this package?"

Agents need another step before that:

- Which package solves the task?
- Which source owns it?
- Which version is being considered?
- What evidence is available?
- What warnings matter?
- What command would run?
- Would that command write to the workspace?
- Should the user approve it?

Nipmod owns that preflight decision layer.

## Current Rollout

Public beta access is free and rate limited while the API, trust model and archive loop improve from real usage.

The first collaboration surface is the Base ecosystem because the project, token and early community are already there. The product itself remains broader than Base: the same API can serve any agent host that can call HTTPS or MCP.
