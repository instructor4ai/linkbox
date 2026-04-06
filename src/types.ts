export type BookmarkNode = FolderNode | LinkNode;

export interface BaseNode {
  id: string;
  title: string;
  createdAt?: string;
}

export interface FolderNode extends BaseNode {
  type: "folder";
  children: BookmarkNode[];
}

export interface LinkNode extends BaseNode {
  type: "bookmark";
  url: string;
  icon?: string;
}

export interface MergeStats {
  foldersMerged: number;
  bookmarksAdded: number;
  duplicatesRemoved: number;
}

export interface ParsedBookmarkFile {
  root: FolderNode;
  warnings: string[];
}
