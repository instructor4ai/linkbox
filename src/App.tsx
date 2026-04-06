import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import "./styles.css";
import { exportBookmarkHtml, parseBookmarkHtml } from "./lib/bookmarkHtml";
import { mergeChildren, mergeFolders } from "./lib/merge";
import {
  appendChildToFolder,
  createBookmark,
  createFolder,
  cloneTree,
  deleteNodeFromTree,
  findNode,
  findParentFolder,
  isNodeDescendant,
  removeNodeFromTree,
  updateNodeInTree,
} from "./lib/tree";
import type { BookmarkNode, FolderNode, MergeStats } from "./types";

interface UndoSnapshot {
  root: FolderNode;
  selectedId: string;
  expandedFolders: string[];
  mergeStats: MergeStats | null;
  status: string;
}

const initialRoot = (): FolderNode => ({
  id: crypto.randomUUID(),
  type: "folder",
  title: "Link Box",
  children: [],
});

const isFolder = (node: BookmarkNode | FolderNode | undefined): node is FolderNode =>
  Boolean(node && node.type === "folder");

const findFolderPath = (root: FolderNode, targetId: string): string[] => {
  if (root.id === targetId) {
    return [root.id];
  }

  for (const child of root.children) {
    if (child.id === targetId) {
      return [root.id, child.id];
    }

    if (child.type === "folder") {
      const childPath = findFolderPath(child, targetId);
      if (childPath.length > 0) {
        return [root.id, ...childPath];
      }
    }
  }

  return [];
};

function TreeItem({
  node,
  selectedId,
  onSelect,
  expandedFolders,
  onToggleFolder,
  onDragStartNode,
  onDropNode,
  dragOverFolderId,
  onDragEnterFolder,
  onDragLeaveFolder,
  onDragEnd,
  draggable,
}: {
  node: BookmarkNode;
  selectedId: string;
  onSelect: (id: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  onDragStartNode: (id: string) => void;
  onDropNode: (sourceId: string, targetFolderId: string) => void;
  dragOverFolderId: string | null;
  onDragEnterFolder: (id: string) => void;
  onDragLeaveFolder: (id: string) => void;
  onDragEnd: () => void;
  draggable: boolean;
}) {
  const isExpanded = node.type === "folder" && expandedFolders.has(node.id);
  const isDropTarget = node.type === "folder" && dragOverFolderId === node.id;

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (node.type !== "folder") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (!sourceId) {
      return;
    }

    onDropNode(sourceId, node.id);
  };

  return (
    <li>
      <div
        className={`tree-row ${selectedId === node.id ? "active" : ""} ${isDropTarget ? "drop-target" : ""}`}
        onDragEnter={(event) => {
          if (node.type !== "folder") {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          onDragEnterFolder(node.id);
        }}
        onDragLeave={(event) => {
          if (node.type !== "folder") {
            return;
          }

          event.stopPropagation();
          onDragLeaveFolder(node.id);
        }}
        onDragOver={(event) => {
          if (node.type !== "folder") {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={handleDrop}
      >
        {node.type === "folder" ? (
          <button
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
            className="tree-toggle"
            onClick={() => onToggleFolder(node.id)}
            type="button"
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="tree-toggle tree-toggle--ghost">•</span>
        )}
        <button
          className="tree-item"
          draggable={draggable}
          onClick={() => onSelect(node.id)}
          onDragEnd={onDragEnd}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", node.id);
            onDragStartNode(node.id);
          }}
          type="button"
        >
          <span>{node.title || (node.type === "bookmark" ? node.url : "Untitled")}</span>
        </button>
      </div>
      {node.type === "folder" && node.children.length > 0 && isExpanded ? (
        <ul className="tree-list tree-list--nested">
          {node.children.map((child) => (
            <TreeItem
              dragOverFolderId={dragOverFolderId}
              expandedFolders={expandedFolders}
              key={child.id}
              node={child}
              onDragEnd={onDragEnd}
              onDragEnterFolder={onDragEnterFolder}
              onDragLeaveFolder={onDragLeaveFolder}
              onDragStartNode={onDragStartNode}
              onDropNode={onDropNode}
              onToggleFolder={onToggleFolder}
              selectedId={selectedId}
              onSelect={onSelect}
              draggable
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function App() {
  const [root, setRoot] = useState<FolderNode>(initialRoot);
  const [selectedId, setSelectedId] = useState<string>("");
  const [status, setStatus] = useState("Import a bookmark file to begin.");
  const [mergeStats, setMergeStats] = useState<MergeStats | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set([root.id]),
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const mergeInputRef = useRef<HTMLInputElement | null>(null);
  const undoSnapshotRef = useRef<UndoSnapshot | null>(null);
  const hoverExpandTimerRef = useRef<number | null>(null);

  const selectedNode = useMemo(
    () => (selectedId ? findNode(root, selectedId) : root),
    [root, selectedId],
  );

  const selectedParentFolder = selectedNode
    ? selectedNode.type === "folder"
      ? selectedNode
      : findParentFolder(root, selectedNode.id)
    : root;

  const selectedFolderId = selectedParentFolder?.id ?? root.id;

  const revealNodeInTree = (targetId: string, tree = root) => {
    const path = findFolderPath(tree, targetId);
    if (path.length === 0) {
      return;
    }

    setExpandedFolders((current) => {
      const next = new Set(current);
      for (const id of path) {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const expandFolder = (folderId: string) => {
    setExpandedFolders((current) => new Set([...current, folderId]));
  };

  const clearHoverExpandTimer = () => {
    if (hoverExpandTimerRef.current !== null) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
  };

  useEffect(() => clearHoverExpandTimer, []);

  const saveUndoSnapshot = (currentStatus = status) => {
    undoSnapshotRef.current = {
      root: cloneTree(root),
      selectedId,
      expandedFolders: [...expandedFolders],
      mergeStats,
      status: currentStatus,
    };
  };

  const handleUndoRedo = () => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    const currentSnapshot: UndoSnapshot = {
      root: cloneTree(root),
      selectedId,
      expandedFolders: [...expandedFolders],
      mergeStats,
      status,
    };

    setRoot(snapshot.root);
    setSelectedId(snapshot.selectedId);
    setExpandedFolders(new Set(snapshot.expandedFolders));
    setMergeStats(snapshot.mergeStats);
    setStatus(
      snapshot.status.startsWith("Undid") ? "Redid last action." : "Undid last action.",
    );
    setDragOverFolderId(null);
    undoSnapshotRef.current = currentSnapshot;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndoShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "z";

      if (!isUndoShortcut) {
        return;
      }

      event.preventDefault();
      clearHoverExpandTimer();
      handleUndoRedo();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [root, selectedId, expandedFolders, mergeStats, status]);

  const moveNodeToFolder = (sourceId: string, targetFolderId: string) => {
    if (sourceId === root.id || sourceId === targetFolderId) {
      return;
    }

    const sourceNode = findNode(root, sourceId);
    const targetNode = findNode(root, targetFolderId);

    if (!sourceNode || !isFolder(targetNode)) {
      return;
    }

    if (sourceNode.type === "folder" && isNodeDescendant(sourceNode, targetFolderId)) {
      setStatus("Cannot move a folder into itself or one of its descendants.");
      return;
    }

    const sourceParent = findParentFolder(root, sourceId);
    if (sourceParent?.id === targetFolderId) {
      return;
    }

    saveUndoSnapshot("Moved item.");

    const { tree: prunedTree, removed } = removeNodeFromTree(root, sourceId);
    if (!removed) {
      return;
    }

    const stats: MergeStats = {
      foldersMerged: 0,
      bookmarksAdded: removed.type === "bookmark" ? 1 : 0,
      duplicatesRemoved: 0,
    };

    const nextTree = updateNodeInTree(prunedTree, targetFolderId, (node) => {
      if (node.type !== "folder") {
        return node;
      }

      return {
        ...node,
        children: mergeChildren(node.children, [removed], stats),
      };
    });

    setRoot(nextTree);
    setSelectedId(removed.id);
    revealNodeInTree(targetFolderId, nextTree);
    setExpandedFolders((current) => new Set([...current, targetFolderId]));
    setMergeStats(stats);
    setStatus(
      stats.foldersMerged > 0 || stats.duplicatesRemoved > 0
        ? "Moved item and applied merge rules in the destination folder."
        : "Moved item to the destination folder.",
    );
  };

  const handleFileAction = async (
    event: ChangeEvent<HTMLInputElement>,
    mode: "replace" | "merge",
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = parseBookmarkHtml(text);

    if (mode === "replace") {
      saveUndoSnapshot("Imported bookmark file.");
      setRoot(parsed.root);
      setSelectedId(parsed.root.id);
      setExpandedFolders(new Set([parsed.root.id]));
      setMergeStats(null);
      setDragOverFolderId(null);
      setStatus(
        parsed.warnings.length
          ? `Imported with ${parsed.warnings.length} warning(s).`
          : "Bookmark file imported.",
      );
    } else {
      saveUndoSnapshot("Merged bookmark file.");
      const result = mergeFolders(root, parsed.root);
      setRoot(result.merged);
      setExpandedFolders((current) => new Set([...current, result.merged.id]));
      setMergeStats(result.stats);
      setDragOverFolderId(null);
      setStatus("Merged bookmark file into the current tree.");
    }

    event.target.value = "";
  };

  const updateSelectedNode = (changes: { title?: string; url?: string }) => {
    if (!selectedNode) {
      return;
    }

    saveUndoSnapshot("Updated selected item.");
    setRoot((current) =>
      updateNodeInTree(current, selectedNode.id, (node) => {
        if (node.type === "folder") {
          return {
            ...node,
            title: changes.title ?? node.title,
          };
        }

        return {
          ...node,
          title: changes.title ?? node.title,
          url: changes.url ?? node.url,
        };
      }),
    );
  };

  const addFolder = () => {
    const folder = createFolder();
    saveUndoSnapshot("Added a new folder.");
    setRoot((current) => appendChildToFolder(current, selectedFolderId, folder));
    setSelectedId(folder.id);
    revealNodeInTree(selectedFolderId);
    setExpandedFolders((current) => new Set([...current, selectedFolderId, folder.id]));
    setStatus("Added a new folder.");
  };

  const addBookmark = () => {
    const bookmark = createBookmark();
    saveUndoSnapshot("Added a new bookmark.");
    setRoot((current) => appendChildToFolder(current, selectedFolderId, bookmark));
    setSelectedId(bookmark.id);
    revealNodeInTree(selectedFolderId);
    setStatus("Added a new bookmark.");
  };

  const deleteSelected = () => {
    if (!selectedNode || selectedNode.id === root.id) {
      return;
    }

    const confirmed = window.confirm(
      selectedNode.type === "folder"
        ? "Delete this folder and everything inside it?"
        : "Delete this bookmark?",
    );

    if (!confirmed) {
      return;
    }

    saveUndoSnapshot("Deleted selected item.");
    setRoot((current) => deleteNodeFromTree(current, selectedNode.id));
    setExpandedFolders((current) => {
      const next = new Set(current);
      next.delete(selectedNode.id);
      return next;
    });
    setSelectedId(root.id);
    setStatus("Deleted selected item.");
  };

  const handleExport = () => {
    const html = exportBookmarkHtml(root);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    link.href = url;
    link.download = `bookmarks${yy}${mm}${dd}.html`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Exported bookmark.html.");
  };

  const visibleChildren =
    selectedNode?.type === "folder" ? selectedNode.children : [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Browser-independent bookmark manager</p>
          <h1>Link Box</h1>
        </div>
        <div className="topbar__actions">
          <input
            ref={importInputRef}
            accept=".html,text/html"
            className="hidden-input"
            onChange={(event) => void handleFileAction(event, "replace")}
            type="file"
          />
          <input
            ref={mergeInputRef}
            accept=".html,text/html"
            className="hidden-input"
            onChange={(event) => void handleFileAction(event, "merge")}
            type="file"
          />
          <button onClick={() => importInputRef.current?.click()} type="button">
            Import File
          </button>
          <button onClick={() => mergeInputRef.current?.click()} type="button">
            Merge File
          </button>
          <button className="button--accent" onClick={handleExport} type="button">
            Export HTML
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="panel sidebar">
          <div className="panel__header">
            <h2>Tree</h2>
          </div>
          <div className="tree-scroll">
            <ul className="tree-list">
              <TreeItem
                dragOverFolderId={dragOverFolderId}
                expandedFolders={expandedFolders}
                node={root}
                draggable={false}
                onDragEnd={() => setDragOverFolderId(null)}
                onDragEnterFolder={(id) => {
                  setDragOverFolderId(id);
                  clearHoverExpandTimer();
                  hoverExpandTimerRef.current = window.setTimeout(() => {
                    expandFolder(id);
                    hoverExpandTimerRef.current = null;
                  }, 2000);
                }}
                onDragLeaveFolder={(id) => {
                  clearHoverExpandTimer();
                  setDragOverFolderId((current) => (current === id ? null : current));
                }}
                onDragStartNode={() => {
                  clearHoverExpandTimer();
                  setDragOverFolderId(null);
                }}
                onDropNode={(sourceId, targetFolderId) => {
                  clearHoverExpandTimer();
                  moveNodeToFolder(sourceId, targetFolderId);
                  setDragOverFolderId(null);
                }}
                onSelect={(id) => {
                  setSelectedId(id);
                  revealNodeInTree(id);
                }}
                onToggleFolder={toggleFolder}
                selectedId={selectedNode?.id ?? root.id}
              />
            </ul>
          </div>
        </aside>

        <section className="panel content">
          <div className="panel__header panel__header--content">
            <div className="panel__title">
              <h2>{selectedNode?.title ?? root.title}</h2>
              <p className="muted panel__subtitle">
                {selectedNode?.type === "folder"
                  ? `${visibleChildren.length} item(s)`
                  : selectedNode?.url}
              </p>
            </div>
            <div className="toolbar toolbar--sticky">
              <button onClick={addFolder} type="button">
                New Folder
              </button>
              <button onClick={addBookmark} type="button">
                New Bookmark
              </button>
              <button className="button--danger" onClick={deleteSelected} type="button">
                Delete
              </button>
            </div>
          </div>

          <div className="content-list">
            {selectedNode?.type === "bookmark" ? (
              <article className="card">
                <h3>Selected Bookmark</h3>
                <p className="bookmark-url">{selectedNode.url}</p>
              </article>
            ) : visibleChildren.length > 0 ? (
              visibleChildren.map((child) => (
                <button
                  className="card card--interactive"
                  key={child.id}
                  onClick={() => {
                    setSelectedId(child.id);
                    revealNodeInTree(child.id);
                  }}
                  type="button"
                >
                  <div className="card__title">
                    <span>{child.type === "folder" ? "Folder" : "Bookmark"}</span>
                    <strong>{child.title}</strong>
                  </div>
                  <p className="muted">
                    {child.type === "folder"
                      ? `${child.children.length} child item(s)`
                      : child.url}
                  </p>
                </button>
              ))
            ) : (
              <article className="empty-state">
                <h3>No items yet</h3>
                <p>Import bookmarks or create a folder or link inside this section.</p>
              </article>
            )}
          </div>
        </section>

        <aside className="panel inspector">
          <div className="panel__header">
            <h2>Inspector</h2>
          </div>
          <div className="form-stack">
            <label>
              <span>Title</span>
              <input
                onChange={(event) => updateSelectedNode({ title: event.target.value })}
                value={selectedNode?.title ?? ""}
              />
            </label>

            {selectedNode?.type === "bookmark" ? (
              <label>
                <span>URL</span>
                <input
                  onChange={(event) => updateSelectedNode({ url: event.target.value })}
                  value={selectedNode.url}
                />
              </label>
            ) : null}

            <section className="status-card">
              <h3>Status</h3>
              <p>{status}</p>
            </section>

            {mergeStats ? (
              <section className="status-card">
                <h3>Last Merge</h3>
                <ul className="stats-list">
                  <li>Folders merged: {mergeStats.foldersMerged}</li>
                  <li>Bookmarks added: {mergeStats.bookmarksAdded}</li>
                  <li>Duplicates removed: {mergeStats.duplicatesRemoved}</li>
                </ul>
              </section>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
