# Link Box

## 1. Product Summary

Link Box is a web-based bookmark manager that works independently of any specific browser.
Its main purpose is to import, edit, merge, deduplicate, and export bookmark collections stored in `bookmark.html` format.

The product is designed to solve three pain points:

1. Browser bookmark managers are tied to each browser.
2. Browser bookmark merge behavior usually preserves duplicates instead of intelligently combining them.
3. Managing large bookmark collections across folders becomes difficult when deduplication and structural editing are both needed.

## 2. Core Goals

1. Manage bookmarks independently from Chrome, Edge, Safari, Firefox, and others.
2. Import one or more `bookmark.html` files into a unified internal structure.
3. Merge folders and bookmarks while removing duplicates.
4. Edit folders and bookmarks after import:
   - add
   - rename
   - move
   - delete
   - update bookmark title and URL
5. Export the current state back to a valid `bookmark.html`.

## 3. Primary User Scenarios

### Scenario A: Build a master bookmark file

1. User imports a base `bookmark.html`.
2. User imports another `bookmark.html`.
3. Link Box compares both structures.
4. Same folders are merged.
5. Duplicate bookmarks are collapsed.
6. User reviews the merged result and exports a new master `bookmark.html`.

### Scenario B: Clean up a messy bookmark archive

1. User imports a large bookmark file with repeated folders and repeated links.
2. Link Box highlights duplicates.
3. User edits folder names and bookmark titles.
4. User deletes unwanted entries.
5. User exports the cleaned result.

### Scenario C: Ongoing browser-independent maintenance

1. User keeps a canonical bookmark set in Link Box.
2. User periodically imports bookmarks exported from browsers.
3. User merges into the canonical set.
4. User exports a new clean version for browser re-import.

## 4. MVP Scope

### Must have

1. Import a `bookmark.html` file from local disk.
2. Parse bookmark folders and links into an internal tree.
3. Display folders and bookmarks in a tree UI.
4. Add, edit, and delete folders/bookmarks.
5. Import a second `bookmark.html` and merge it into the current tree.
6. Deduplicate bookmarks during merge.
7. Merge folders with the same normalized name within the same parent.
8. Export the current tree back into `bookmark.html`.

### Should have

1. Drag-and-drop reorder and move.
2. Search by title and URL.
3. Duplicate review panel before final merge.
4. Undo for recent edits.
5. Local autosave in browser storage.

### Out of scope for v1

1. Browser extension sync.
2. Cloud account and remote sync.
3. Live sync with browser bookmark databases.
4. Tagging system.
5. Broken-link checking.
6. Multi-user collaboration.

## 5. Functional Requirements

### 5.1 Import

The system must:

1. Accept browser-exported `bookmark.html` files.
2. Parse standard bookmark HTML structures:
   - folders
   - bookmarks
   - nested folders
3. Preserve source metadata when possible:
   - title
   - URL
   - add date
   - icon or icon URI if present

### 5.2 Internal Data Model

The system should convert imported HTML into a normalized tree:

Folder:

- `id`
- `type = "folder"`
- `title`
- `children`
- optional metadata

Bookmark:

- `id`
- `type = "bookmark"`
- `title`
- `url`
- optional metadata

At the application level, every node should have a stable generated ID so the UI can support editing and movement without depending on raw HTML positions.

### 5.3 Merge

The merge engine must support:

1. Merging a new bookmark tree into an existing tree.
2. Folder merge when:
   - same parent
   - same normalized folder name
3. Bookmark deduplication when:
   - same normalized URL
   - optionally prefer longer or more descriptive title

Recommended normalization rules for MVP:

1. Trim whitespace.
2. Compare folder names case-insensitively.
3. Normalize URLs by:
   - trimming whitespace
   - lowercasing protocol and hostname
   - removing trailing slash for root-equivalent cases
   - ignoring common tracking query params later, but not in first MVP unless clearly safe

### 5.4 Editing

The system must allow:

1. Create folder inside any folder.
2. Create bookmark inside any folder.
3. Rename folder.
4. Edit bookmark title.
5. Edit bookmark URL.
6. Delete folder.
7. Delete bookmark.

For MVP, deleting a folder removes its entire subtree after confirmation.

### 5.5 Export

The system must:

1. Generate a valid Netscape bookmark file format compatible with major browsers.
2. Preserve folder nesting.
3. Preserve bookmark titles and URLs.
4. Include metadata if available and easy to support.

## 6. Merge Rules Proposal

This area is the heart of Link Box and should be explicit from the start.

### Folder merge rule

Two folders are considered merge candidates when:

1. They are both folders.
2. They exist under the same parent folder.
3. Their normalized titles match.

Result:

1. Keep one folder node.
2. Recursively merge children from both folders into that node.

### Bookmark duplicate rule

Two bookmarks are considered duplicates when:

1. They are both bookmarks.
2. Their normalized URLs match.

Result:

1. Keep one bookmark node.
2. Prefer metadata using simple priority rules:
   - keep non-empty title over empty title
   - if both have titles, keep the longer title for MVP
   - preserve earliest add date if present

### Important limitation for MVP

Bookmarks with the same URL in different folders should remain allowed, unless the merge occurs within the same merged folder context.

This avoids over-aggressive global deduplication and better preserves user intent.

## 7. Suggested UX Structure

### Main layout

1. Left sidebar:
   - folder tree
   - search
2. Center panel:
   - selected folder contents
   - bookmarks and child folders
3. Right panel or modal:
   - details editor
   - merge review

### Main actions

1. Import bookmarks
2. Merge another file
3. New folder
4. New bookmark
5. Rename
6. Delete
7. Export bookmarks

### Useful future UX improvements

1. Duplicate badge on folders
2. Merge preview before apply
3. Conflict resolution choices when titles differ

## 8. Technical Direction

### Recommended stack

For fast delivery and easy local usage:

1. Frontend: React + TypeScript
2. App framework: Next.js or Vite
3. State: Zustand or React context + reducer
4. Parsing/export logic: shared TypeScript modules
5. Styling: Tailwind CSS or plain CSS modules

Recommended MVP choice:

- Vite + React + TypeScript

Reason:

1. This is primarily a client-side tool.
2. Local file import/export is straightforward.
3. No backend is required for MVP.
4. Development remains simple and fast.

## 9. Proposed Architecture

### Modules

1. `parser`
   - parse `bookmark.html` into internal tree
2. `normalizer`
   - normalize titles and URLs for comparison
3. `merge-engine`
   - merge folder trees and remove duplicates
4. `tree-store`
   - application state management
5. `exporter`
   - generate `bookmark.html`
6. `ui`
   - tree browser
   - list/detail editor
   - import/export controls

### Data flow

1. User imports file
2. Parser creates tree
3. Tree enters store
4. User imports second file
5. Parser creates second tree
6. Merge engine combines with current tree
7. User edits result
8. Exporter generates HTML download

## 10. Incremental Implementation Plan

### Phase 1: Foundation

1. Initialize frontend project.
2. Create base TypeScript types for folder/bookmark nodes.
3. Add sample page shell and empty tree state.

Deliverable:

- app boots and displays placeholder bookmark tree UI

### Phase 2: Import and Parse

1. Add file input for `bookmark.html`.
2. Implement parser for folders and bookmarks.
3. Load parsed tree into state.
4. Render tree and selected node contents.

Deliverable:

- user can import and view bookmark structure

### Phase 3: Editing

1. Add create folder/bookmark actions.
2. Add rename/edit forms.
3. Add delete actions.
4. Add move support later if time allows.

Deliverable:

- user can fully maintain a single imported bookmark tree

### Phase 4: Merge Engine

1. Implement normalization helpers.
2. Implement recursive folder merge.
3. Implement bookmark deduplication in merged folder context.
4. Show merge result summary:
   - folders merged
   - duplicates removed
   - new bookmarks added

Deliverable:

- user can merge multiple bookmark files into one clean tree

### Phase 5: Export

1. Implement `bookmark.html` exporter.
2. Support browser-compatible download.
3. Validate exported file through round-trip parse tests.

Deliverable:

- user can export cleaned bookmarks back to browser-importable HTML

### Phase 6: Quality Improvements

1. Search/filter
2. Autosave to local storage
3. Undo support
4. Better merge preview

## 11. Testing Strategy

### Unit tests

1. Parser tests with real sample bookmark HTML.
2. URL normalization tests.
3. Folder merge tests.
4. Bookmark deduplication tests.
5. Export round-trip tests:
   - parse -> export -> parse

### UI tests

1. Import flow
2. Add/edit/delete folder
3. Add/edit/delete bookmark
4. Merge second file and verify deduplication
5. Export button behavior

## 12. MVP Success Criteria

The first version is successful if a user can:

1. Import a browser bookmark HTML file.
2. Import another bookmark HTML file.
3. Merge both while reducing duplicates.
4. Edit folders and bookmarks.
5. Export one clean `bookmark.html` file.

## 13. Recommended Next Build Step

Start with:

1. Vite + React + TypeScript setup
2. bookmark tree type definitions
3. `bookmark.html` parser
4. minimal tree viewer UI

This gives the fastest path to a working prototype and lets the merge engine be built on real parsed data instead of assumptions.
