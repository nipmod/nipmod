# 0003 - Durable Archive Gating

Status: accepted
Date: 2026-05-22

## Context

The archive becomes valuable only if it stays clean. Public write endpoints without controls would attract spam and low-quality records.

## Decision

Public users may prepare archive records, but durable archive writes require configured server-side storage and an authorized writer token.

Confirmed useful records can enter the archive with status `agent_confirmed`. Owner-claimed and verified records can move to stronger statuses after checks.

## Alternatives

- Allow anonymous public archive writes.
- Store every search result automatically.
- Keep no durable archive and resolve sources every time.

## Impact

The archive grows slower but stays credible.

## Security

Archive text, package metadata and source descriptions remain untrusted. Search and install plans must not execute archive text as instructions.

## Rollback

If archive writes create bad records, revoke the writer token, quarantine records and rebuild the archive index from confirmed clean events.
