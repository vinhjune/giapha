---
title: 'Simplify date entry: partial dates + lunar toggle for member management'
description: >-
  Replace 8-column year/month/day/lunar date entry in member management with a
  single dd/mm/yyyy masked field (revised from an initial 3-box layout after
  user feedback that it looked cluttered) + a lunar checkbox, matching the
  DB/type model that already supports partial + lunar dates.
status: completed
priority: P2
branch: master
tags:
  - frontend
  - member-management
  - date-input
blockedBy: []
blocks: []
created: '2026-07-16T11:32:35.774Z'
createdBy: 'ck:plan'
source: skill
---

# Simplify date entry: partial dates + lunar toggle for member management

## Overview

Birth/death dates in the DB (`persons.birthYear/Month/Day` + `birthIsLunar`, same for `death*`) already
support partial dates and a lunar flag — no schema/API change needed. The gap is purely UI: the
"Quản lý thành viên" grid (`MemberManagementView.tsx`) splits each date into 4 raw columns
(năm/tháng/ngày/âm lịch) × 2 dates = 8 columns, and `PersonForm.tsx`'s freeform "dd/mm/yyyy" text
field silently drops lunar data entirely. This plan builds one reusable `NgayThangInput` component
(single dd/mm/yyyy masked field + lunar checkbox, skip day/month by leaving that part of the mask
untyped) and wires it into both surfaces, then adds a small "ÂL" read-only indicator where dates are
displayed. Initially built as 3 separate bordered boxes (day/month/year); revised to a single merged
masked field mid-implementation after user feedback that the 3-box layout looked cluttered.

Brainstorm report: `plans/reports/date-input-ux-260716-1317-member-management-birth-death-lunar-report.md`

## Non-Goals

- No DB schema or worker/API changes — `worker/src/lib/reshape.ts` round-trip already correct.
- No calendar range validation (day ≤ 31, month ≤ 12) — only digit-count limits per segment (see
  Phase 1 rationale). Lunar dates have different day-of-month bounds; validating against solar rules
  would be actively wrong.
- No new npm dependency — hand-rolled segmented input only.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [NgayThangInput component](./phase-01-ngaythanginput-component.md) | Completed |
| 2 | [MemberManagementView integration](./phase-02-membermanagementview-integration.md) | Completed |
| 3 | [PersonForm integration](./phase-03-personform-integration.md) | Completed |
| 4 | [Lunar display in read-only views](./phase-04-lunar-display-in-read-only-views.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
