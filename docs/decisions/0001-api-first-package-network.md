# 0001 - API First Package Network

Status: accepted
Date: 2026-05-22

## Context

Nipmod started with package archive and agent setup flows. The larger product direction is one package surface that any agent can use through HTTPS and MCP without a native integration for each host.

## Decision

Nipmod will prioritize the hosted API as the primary product surface.

Agent host specific setup remains useful for local workspace writes, but the public product story is the API:

- search packages across supported public sources
- inspect source context and metadata
- return trust signals
- return safe install plans
- prepare durable archive records

## Alternatives

- Build separate native integrations for every agent platform.
- Stay focused on a single source network.
- Build only a human website and defer API behavior.

## Impact

The API-first direction reduces adoption friction. Any agent or tool that can call HTTPS can use Nipmod.

## Security

Hosted API calls stay read-only with respect to caller workspaces. Workspace writes require local tools and explicit approval.

## Rollback

If the hosted API cannot meet reliability standards, public surfaces can fall back to local CLI and MCP setup while the API is repaired.
