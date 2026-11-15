import type {
  User,
  Post,
  Notification,
  PageResult,
} from "../../../contracts/index";
import { request } from "../../core/request";
export const accountApi = {
  me: () => request<User>("/api/v1/me"),
  save: (nickname: string, avatarRef: string | null) =>
    request<User>("/api/v1/me", "PUT", { nickname, avatarRef }),
  posts: (kind: "posts" | "likes", page: number) =>
    request<PageResult<Post>>(`/api/v1/me/${kind}?page=${page}&pageSize=20`),
  messages: (page: number) =>
    request<PageResult<Notification>>(
      `/api/v1/me/notifications?page=${page}&pageSize=20`,
    ),
  unread: () =>
    request<{ count: number }>("/api/v1/me/notifications/unread-count"),
  read: (id: string) =>
    request(
      "/api/v1/me/notifications/" + encodeURIComponent(id) + "/read",
      "PUT",
      {},
    ),
  readAll: () => request("/api/v1/me/notifications/read-all", "PUT", {}),
  logout: () => request("/api/v1/auth/logout", "POST", {}),
};
