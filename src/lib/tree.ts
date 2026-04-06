import type { BookmarkNode, FolderNode, LinkNode } from "../types";

export const createFolder = (title = "New Folder"): FolderNode => ({
  id: crypto.randomUUID(),
  type: "folder",
  title,
  children: [],
});

export const createBookmark = (
  title = "New Bookmark",
  url = "https://",
): LinkNode => ({
  id: crypto.randomUUID(),
  type: "bookmark",
  title,
  url,
});

export const cloneNode = <T extends BookmarkNode>(node: T): T => {
  if (node.type === "bookmark") {
    return { ...node } as T;
  }

  return {
    ...node,
    children: node.children.map((child) => cloneNode(child)),
  } as T;
};

export const cloneTree = (root: FolderNode): FolderNode => cloneNode(root);

export const findNode = (
  root: FolderNode,
  targetId: string,
): BookmarkNode | undefined => {
  if (root.id === targetId) {
    return root;
  }

  for (const child of root.children) {
    if (child.id === targetId) {
      return child;
    }

    if (child.type === "folder") {
      const found = findNode(child, targetId);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

export const findParentFolder = (
  root: FolderNode,
  targetId: string,
): FolderNode | undefined => {
  for (const child of root.children) {
    if (child.id === targetId) {
      return root;
    }

    if (child.type === "folder") {
      const found = findParentFolder(child, targetId);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

export const isNodeDescendant = (
  node: BookmarkNode,
  targetId: string,
): boolean => {
  if (node.id === targetId) {
    return true;
  }

  if (node.type === "bookmark") {
    return false;
  }

  return node.children.some((child) => isNodeDescendant(child, targetId));
};

export const updateNodeInTree = (
  root: FolderNode,
  targetId: string,
  updater: (node: BookmarkNode) => BookmarkNode,
): FolderNode => {
  if (root.id === targetId) {
    const updatedRoot = updater(root);
    if (updatedRoot.type !== "folder") {
      throw new Error("Root node must remain a folder");
    }
    return updatedRoot;
  }

  return {
    ...root,
    children: root.children.map((child) => {
      if (child.id === targetId) {
        return updater(child);
      }

      if (child.type === "folder") {
        return updateNodeInTree(child, targetId, updater);
      }

      return child;
    }),
  };
};

export const appendChildToFolder = (
  root: FolderNode,
  folderId: string,
  child: BookmarkNode,
): FolderNode =>
  updateNodeInTree(root, folderId, (node) => {
    if (node.type !== "folder") {
      throw new Error("Cannot append child to bookmark");
    }

    return {
      ...node,
      children: [...node.children, child],
    };
  });

export const deleteNodeFromTree = (
  root: FolderNode,
  targetId: string,
): FolderNode => ({
  ...root,
  children: root.children
    .filter((child) => child.id !== targetId)
    .map((child) =>
      child.type === "folder" ? deleteNodeFromTree(child, targetId) : child,
    ),
});

export const removeNodeFromTree = (
  root: FolderNode,
  targetId: string,
): { tree: FolderNode; removed?: BookmarkNode } => {
  let removed: BookmarkNode | undefined;

  const visitFolder = (folder: FolderNode): FolderNode => ({
    ...folder,
    children: folder.children.reduce<BookmarkNode[]>((nextChildren, child) => {
      if (child.id === targetId) {
        removed = cloneNode(child);
        return nextChildren;
      }

      if (child.type === "folder") {
        nextChildren.push(visitFolder(child));
        return nextChildren;
      }

      nextChildren.push(child);
      return nextChildren;
    }, []),
  });

  return {
    tree: visitFolder(root),
    removed,
  };
};
