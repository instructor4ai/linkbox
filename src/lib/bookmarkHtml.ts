import type { BookmarkNode, FolderNode, ParsedBookmarkFile } from "../types";
import { createBookmark, createFolder } from "./tree";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const readNodeTitle = (element: Element) => element.textContent?.trim() || "Untitled";

const findFolderList = (entry: Element): Element | null => {
  const directChildList = Array.from(entry.children).find(
    (child) => child.tagName === "DL",
  );

  if (directChildList) {
    return directChildList;
  }

  let sibling = entry.nextElementSibling;
  while (sibling) {
    if (sibling.tagName === "DL") {
      return sibling;
    }

    if (sibling.tagName === "DT") {
      break;
    }

    sibling = sibling.nextElementSibling;
  }

  return null;
};

const parseFolderChildren = (dl: Element | null, warnings: string[]): BookmarkNode[] => {
  if (!dl) {
    return [];
  }

  const children: BookmarkNode[] = [];
  const entries = Array.from(dl.children).filter((child) => child.tagName === "DT");

  for (const entry of entries) {
    const folderTitle = entry.querySelector(":scope > H3");
    const bookmarkLink = entry.querySelector(":scope > A");

    if (folderTitle) {
      const nextDl = findFolderList(entry);
      const folder = createFolder(readNodeTitle(folderTitle));
      folder.createdAt = folderTitle.getAttribute("ADD_DATE") ?? undefined;
      folder.children = parseFolderChildren(nextDl, warnings);
      children.push(folder);
      continue;
    }

    if (bookmarkLink) {
      const bookmark = createBookmark(
        readNodeTitle(bookmarkLink),
        bookmarkLink.getAttribute("HREF") ?? "",
      );
      bookmark.createdAt = bookmarkLink.getAttribute("ADD_DATE") ?? undefined;
      bookmark.icon =
        bookmarkLink.getAttribute("ICON") ??
        bookmarkLink.getAttribute("ICON_URI") ??
        undefined;
      children.push(bookmark);
      continue;
    }

    warnings.push("Skipped an unsupported bookmark entry.");
  }

  return children;
};

export const parseBookmarkHtml = (input: string): ParsedBookmarkFile => {
  const parser = new DOMParser();
  const document = parser.parseFromString(input, "text/html");
  const warnings: string[] = [];

  const root = createFolder("Imported Bookmarks");
  const topLevelDl = document.querySelector("DL");

  if (!topLevelDl) {
    warnings.push("No bookmark list found in the file.");
    return { root, warnings };
  }

  root.children = parseFolderChildren(topLevelDl, warnings);
  return { root, warnings };
};

const serializeNode = (node: BookmarkNode, depth: number): string => {
  const indent = "  ".repeat(depth);

  if (node.type === "bookmark") {
    const addDate = node.createdAt ? ` ADD_DATE="${escapeHtml(node.createdAt)}"` : "";
    const icon = node.icon ? ` ICON="${escapeHtml(node.icon)}"` : "";
    return `${indent}<DT><A HREF="${escapeHtml(node.url)}"${addDate}${icon}>${escapeHtml(node.title)}</A>\n`;
  }

  const addDate = node.createdAt ? ` ADD_DATE="${escapeHtml(node.createdAt)}"` : "";
  const childrenHtml = node.children.map((child) => serializeNode(child, depth + 1)).join("");

  return `${indent}<DT><H3${addDate}>${escapeHtml(node.title)}</H3>\n${indent}<DL><p>\n${childrenHtml}${indent}</DL><p>\n`;
};

export const exportBookmarkHtml = (root: FolderNode): string => {
  const body = root.children.map((child) => serializeNode(child, 1)).join("");

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${body}</DL><p>
`;
};
