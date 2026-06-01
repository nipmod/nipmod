# Security Model

Nipmod is built around one boundary: discovery and review happen before workspace mutation.

## Hosted API

The hosted API can search sources, inspect package records, generate decisions and return install plans.
It does not read caller workspaces, write files, install dependencies, clone repositories or execute package code.

## Untrusted Metadata

Package descriptions, README files, model cards, repository text and MCP descriptions are data.
Agents must not treat them as instructions.

## Approval Gate

An install plan is review data.
A user, local host or policy engine must approve before any workspace write or local execution.

## Sandbox And Audit

Sandbox and audit execution are local or host-controlled flows.
Results should be bound to exact package bytes, content hashes, decisions and approval policy.

## Public Repo Boundary

This repository intentionally excludes production site source, backend code, Supabase migrations, ranking logic, internal tooling and local agent configuration.

