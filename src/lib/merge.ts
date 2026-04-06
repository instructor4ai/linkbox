import type { BookmarkNode, FolderNode, LinkNode, MergeStats } from "../types";
import { cloneNode, cloneTree } from "./tree";

export const normalizeTitle = (value: string) => value.trim().toLocaleLowerCase();

export const normalizeUrl = (input: string) => {
  try {
    const url = new URL(input.trim());
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    if (url.pathname === "/") {
      url.pathname = "";
    }

    return url.toString();
  } catch {
    return input.trim();
  }
};

export const mergeBookmark = (current: LinkNode, incoming: LinkNode): LinkNode => {
  const currentTitle = current.title.trim();
  const incomingTitle = incoming.title.trim();

  const bestTitle =
    incomingTitle.length > currentTitle.length ? incoming.title : current.title;

  return {
    ...current,
    title: currentTitle ? bestTitle : incoming.title,
    createdAt:
      current.createdAt && incoming.createdAt
        ? current.createdAt < incoming.createdAt
          ? current.createdAt
          : incoming.createdAt
        : current.createdAt ?? incoming.createdAt,
    icon: current.icon ?? incoming.icon,
  };
};

export const mergeChildren = (
  existingChildren: BookmarkNode[],
  incomingChildren: BookmarkNode[],
  stats: MergeStats,
): BookmarkNode[] => {
  const result = existingChildren.map((child) => cloneNode(child));

  for (const incomingChild of incomingChildren) {
    if (incomingChild.type === "folder") {
      const match = result.find(
        (child): child is FolderNode =>
          child.type === "folder" &&
          normalizeTitle(child.title) === normalizeTitle(incomingChild.title),
      );

      if (match) {
        match.children = mergeChildren(match.children, incomingChild.children, stats);
        stats.foldersMerged += 1;
      } else {
        result.push(cloneNode(incomingChild));
      }
      continue;
    }

    const duplicate = result.find(
      (child): child is LinkNode =>
        child.type === "bookmark" &&
        normalizeUrl(child.url) === normalizeUrl(incomingChild.url),
    );

    if (duplicate) {
      Object.assign(duplicate, mergeBookmark(duplicate, incomingChild));
      stats.duplicatesRemoved += 1;
    } else {
      result.push(cloneNode(incomingChild));
      stats.bookmarksAdded += 1;
    }
  }

  return result;
};

export const mergeFolders = (
  current: FolderNode,
  incoming: FolderNode,
): { merged: FolderNode; stats: MergeStats } => {
  const stats: MergeStats = {
    foldersMerged: 0,
    bookmarksAdded: 0,
    duplicatesRemoved: 0,
  };

  const mergedRoot = cloneTree(current);
  mergedRoot.children = mergeChildren(mergedRoot.children, incoming.children, stats);

  return {
    merged: mergedRoot,
    stats,
  };
};
