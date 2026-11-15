import type { Post } from "../../../contracts/index";
import { requireLogin } from "../../core/auth";
import { back, go } from "../../core/routes";
import { api } from "../../core/api";
import { errorMessage } from "../../core/request";
import { accountApi } from "./api";
export function contentPage(kind: "posts" | "likes") {
  Page({
    data: {
      list: [] as Post[],
      loading: false,
      busy: false,
      state: "loading",
      message: "",
      page: 0,
      hasMore: false,
    },
    generation: 0,
    onShow() {
      if (requireLogin(kind)) void this.fetchList(true);
    },
    onHide() {
      this.generation++;
    },
    async fetchList(reset = false) {
      if (!reset && this.data.loading) return;
      const g = reset ? ++this.generation : this.generation;
      this.setData({
        loading: true,
        message: "",
        ...(reset ? { state: "loading", list: [] } : {}),
      });
      try {
        const r = await accountApi.posts(kind, reset ? 1 : this.data.page + 1);
        if (g !== this.generation) return;
        const list = reset ? r.items : [...this.data.list, ...r.items];
        this.setData({
          list,
          page: r.page,
          hasMore: r.hasMore,
          state: list.length ? "ready" : "empty",
        });
      } catch (e) {
        if (g === this.generation)
          this.setData({ state: "error", message: errorMessage(e) });
      } finally {
        if (g === this.generation) this.setData({ loading: false });
      }
    },
    onReachBottom() {
      if (this.data.hasMore) void this.fetchList();
    },
    retry() {
      void this.fetchList(true);
    },
    more() {
      void this.fetchList();
    },
    openPost(e: WechatMiniprogram.CustomEvent<{ postId: string }>) {
      go("post", { postId: e.detail.postId });
    },
    async delPost(e: WechatMiniprogram.TouchEvent) {
      if (this.data.busy) return;
      const id = e.currentTarget.dataset.id;
      const yes = await new Promise<boolean>((resolve) =>
        wx.showModal({
          title: "确认删除",
          content: "删除后无法恢复。",
          success: (r) => resolve(r.confirm),
          fail: () => resolve(false),
        }),
      );
      if (!yes) return;
      this.setData({ busy: true });
      try {
        await api.deletePost(id);
        await this.fetchList(true);
      } catch (e) {
        this.setData({ message: errorMessage(e) });
      } finally {
        this.setData({ busy: false });
      }
    },
    back() {
      back("account");
    },
  });
}
