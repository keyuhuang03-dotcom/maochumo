import type {
  Area,
  Cat,
  CreateArea,
  CreateCat,
  CreateTopic,
  HidePost,
  PageResult,
  Post,
  Ref,
  Topic,
  UpdateArea,
  UpdateCat,
  UpdateTopic,
} from "../../../contracts/index";
import { request } from "../../core/request";
import { env } from "../../core/env";
const query = (values: Record<string, string | number>) =>
  Object.keys(values)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(values[k]))
    .join("&");
const id = (value: string) => encodeURIComponent(value);
export const mediaUrl = (ref: string) =>
  env.apiBase + "/api/v1/media/" + encodeURIComponent(ref);
export const adminApi = {
  areas: () => request<{ items: Area[] }>("/api/v1/areas"),
  cats: (page = 1, q = "") =>
    request<PageResult<Cat>>(
      "/api/v1/cats?" + query({ page, pageSize: 20, q }),
    ),
  cat: (catId: string) => request<Cat>("/api/v1/cats/" + id(catId)),
  createCat: (data: CreateCat) =>
    request<Cat>("/api/v1/admin/cats", "POST", data),
  updateCat: (catId: string, data: UpdateCat) =>
    request<Cat>("/api/v1/admin/cats/" + id(catId), "PUT", data),
  topics: () => request<{ items: Topic[] }>("/api/v1/admin/topics"),
  createTopic: (data: CreateTopic) =>
    request<Topic>("/api/v1/admin/topics", "POST", data),
  updateTopic: (topicId: string, data: UpdateTopic) =>
    request<Topic>("/api/v1/admin/topics/" + id(topicId), "PUT", data),
  createArea: (data: CreateArea) =>
    request<Area>("/api/v1/admin/areas", "POST", data),
  updateArea: (areaId: string, data: UpdateArea) =>
    request<Area>("/api/v1/admin/areas/" + id(areaId), "PUT", data),
  posts: (page = 1, q = "") =>
    request<PageResult<Post>>(
      "/api/v1/posts?" + query({ page, pageSize: 20, q }),
    ),
  hidePost: (postId: string, data: HidePost) =>
    request<{ id: string; status: "hidden" }>(
      "/api/v1/admin/posts/" + id(postId) + "/hide",
      "PUT",
      data,
    ),
};
