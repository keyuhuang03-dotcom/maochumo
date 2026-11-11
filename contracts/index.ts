export type ID = string;
export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: string; message: string }; requestId: string };
export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export interface User {
  id: ID;
  nickname: string | null;
  avatarRef: string | null;
  role: "user" | "admin";
}
export interface Ref {
  id: ID;
  name: string;
}
export interface Post {
  id: ID;
  body: string;
  author: User;
  images: string[];
  cats: Ref[];
  topics: Ref[];
  likeCount: number;
  commentCount: number;
  liked: boolean;
  createdAt: string;
}
export interface Area extends Ref {
  region: { x: number; y: number; width: number; height: number };
  version: number;
}
export interface Cat extends Ref {
  areaId: ID;
  aliases: string[];
  photoRefs: string[];
  sex: "male" | "female" | "unknown";
  appearance: string | null;
  personality: string | null;
  version: number;
}
export interface Session {
  token: string;
  expiresAt: string;
  user: User;
  mode: "development" | "wechat";
}
export interface CreatePost {
  body: string;
  imageRefs: string[];
  catIds: ID[];
  topicIds: ID[];
  requestKey: string;
}
export interface CreateComment {
  body: string;
  replyToId: ID | null;
  requestKey: string;
}
export interface Comment {
  id: ID;
  postId: ID;
  author: User;
  body: string;
  replyToId: ID | null;
  createdAt: string;
}
export interface Notification {
  id: ID;
  postId: ID;
  commentId: ID;
  type: "comment" | "reply";
  readAt: string | null;
  createdAt: string;
  targetAvailable: boolean;
}
export type UploadPurpose = "post" | "avatar" | "cat";
/** Multipart field file contains bytes; purpose is a query parameter. */
export interface UploadRequest {
  purpose: UploadPurpose;
  filePath: string;
}
export interface UploadResult {
  imageRef: string;
  url: string;
}
export interface UpdateCat {
  name: string;
  areaId: ID;
  aliases: string[];
  photoRefs: string[];
  sex: Cat["sex"];
  appearance: string | null;
  personality: string | null;
  version: number;
  requestKey: string;
}
export interface UpdateArea {
  name: string;
  region: Area["region"];
  version: number;
  requestKey: string;
}
export interface UpdateTopic {
  name: string;
  status: "active" | "inactive";
  version: number;
  requestKey: string;
}
export interface HidePost {
  reason: string;
  requestKey: string;
}
export const textLength = (value: string): number => Array.from(value).length;

export interface Topic extends Ref {
  status: "active" | "inactive";
  version: number;
}
export type CreateCat = Omit<UpdateCat, "version">;
export type CreateArea = Omit<UpdateArea, "version">;
export type CreateTopic = Omit<UpdateTopic, "version">;
