import type { Post, Cat, Area, PageResult } from "../../contracts/index";
import { request } from "./request";
export const api = {
  posts: (page = 1, q = "") =>
    request<PageResult<Post>>(
      `/api/v1/posts?page=${page}&pageSize=20&q=${encodeURIComponent(q)}`,
    ),
  post: (id: string) =>
    request<Post>("/api/v1/posts/" + encodeURIComponent(id)),
  areas: () => request<{ items: Area[] }>("/api/v1/areas"),
  cats: (areaId: string) =>
    request<PageResult<Cat>>(
      "/api/v1/cats?areaId=" + encodeURIComponent(areaId),
    ),
};
