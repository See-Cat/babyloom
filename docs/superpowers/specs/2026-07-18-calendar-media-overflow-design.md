# Calendar Media Overflow Fix Design

## Problem

On the calendar page, a record with enough media thumbnails widens the document beyond the viewport. The whole page can then be dragged horizontally even though the thumbnail strip already declares its own horizontal scrolling.

## Root cause

`CalendarDayPreview` renders timeline cards through nested CSS Grid containers. Grid items use an automatic minimum inline size by default, so the non-shrinking thumbnails contribute their combined min-content width through the grid-item chain. The thumbnail strip's `overflow-x-auto` does not constrain those ancestors.

## Design

Add `min-w-0` to the calendar preview's record-list grid item chain so the available viewport width constrains each record card. Keep `ThumbnailStrip` unchanged: it remains the sole horizontal scroll container when its contents exceed the card width.

Do not add global `overflow-x-hidden`, because that would hide rather than fix the sizing error and could clip legitimate horizontal components. Do not wrap thumbnails, because that would change the existing interaction and card height.

## Verification

Add a regression assertion that renders a calendar record with enough media items to overflow the card. Verify that the calendar preview's relevant grid items allow shrinking. Then run the focused component test, the complete unit suite, lint, and type checking.

The fix is complete when the document stays within the viewport while the thumbnail strip remains horizontally scrollable.
