import type {
  Post,
  Cat,
  Area,
  Ref,
  Comment,
  CreatePost,
  CreateComment,
  PageResult,
} from "../../contracts/index";
import { request } from "./request";
const query = (values: Record<string, string | number>) =>
  Object.keys(values)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(values[k]))
    .join("&");
export const api = {
  posts: (page = 1, q = "", topicId = "") =>
    request<PageResult<Post>>(
      "/api/v1/posts?" + query({ page, pageSize: 20, q, topicId }),
    ),
  post: (id: string) =>
    request<Post>("/api/v1/posts/" + encodeURIComponent(id)),
  hot: () => request<{ items: Post[]; asOf: string }>("/api/v1/posts/hot"),
  createPost: (data: CreatePost) =>
    request<Post>("/api/v1/posts", "POST", data),
  deletePost: (id: string) =>
    request<{ id: string; status: "deleted" }>(
      "/api/v1/posts/" + encodeURIComponent(id),
      "DELETE",
    ),
  like: (id: string, liked: boolean) =>
    request<{ liked: boolean; likeCount: number }>(
      "/api/v1/posts/" + encodeURIComponent(id) + "/like",
      "PUT",
      { liked },
    ),
  comments: (id: string, page = 1, focusId = "") =>
    request<PageResult<Comment>>(
      "/api/v1/posts/" +
        encodeURIComponent(id) +
        "/comments?" +
        query({ page, pageSize: 20, ...(focusId ? { focusId } : {}) }),
    ),
  comment: (id: string, data: CreateComment) =>
    request<Comment>(
      "/api/v1/posts/" + encodeURIComponent(id) + "/comments",
      "POST",
      data,
    ),
  areas: () => request<{ items: Area[] }>("/api/v1/areas"),
  cats: (areaId = "", page = 1, q = "") =>
    request<PageResult<Cat>>(
      "/api/v1/cats?" + query({ areaId, page, pageSize: 20, q }),
    ),
  topics: () =>
    request<{ items: (Ref & { version: number })[] }>("/api/v1/topics"),
};
