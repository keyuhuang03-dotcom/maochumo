import type { Cat, Post } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { request, errorMessage } from "../../../core/request";
import { env } from "../../../core/env";
import { back, go } from "../../../core/routes";
Page({
  data: {
    catId: "",
    cat: null as Cat | null,
    posts: [] as Post[],
    viewState: "loading",
    viewMessage: "",
    aliasText: "",
    photos: [] as string[],
    areaName: "",
    page: 0,
    hasMore: false,
    loading: false,
    postError: "",
  },
  generation: 0,
  onLoad(o) {
    this.setData({ catId: o.catId || "" });
  },
  onShow() {
    void this.fetchDetail();
  },
  onUnload() {
    this.generation++;
  },
  async fetchDetail() {
    const g = ++this.generation;
    this.setData({
      viewState: "loading",
      viewMessage: "",
      posts: [],
      page: 0,
      hasMore: false,
      loading: false,
      postError: "",
    });
    if (!this.data.catId) {
      this.setData({
        viewState: "error",
        viewMessage: "缺少猫咪ID，请返回图鉴重选",
      });
      return;
    }
    try {
      const cat = await request<Cat>(
        "/api/v1/cats/" + encodeURIComponent(this.data.catId),
      );
      if (g !== this.generation) return;
      this.setData({
        cat,
        aliasText: cat.aliases.join(" / "),
        photos: cat.photoRefs.map(
          (ref) => env.apiBase + "/api/v1/media/" + encodeURIComponent(ref),
        ),
        viewState: "idle",
      });
      void api
        .areas()
        .then((a) => {
          if (g === this.generation)
            this.setData({
              areaName:
                a.items.find((x) => x.id === cat.areaId)?.name || cat.areaId,
            });
        })
        .catch(() => {});
      await this.loadPosts(true);
    } catch (e) {
      if (g === this.generation)
        this.setData({ viewState: "error", viewMessage: errorMessage(e) });
    }
  },
  async loadPosts(reset = false) {
    if (this.data.loading) return;
    const g = this.generation;
    this.setData({ loading: true, postError: "" });
    try {
      const result = await api.catPosts(
        this.data.catId,
        reset ? 1 : this.data.page + 1,
      );
      if (g !== this.generation) return;
      this.setData({
        posts: reset ? result.items : [...this.data.posts, ...result.items],
        page: result.page,
        hasMore: result.hasMore,
      });
    } catch (e) {
      if (g === this.generation) this.setData({ postError: errorMessage(e) });
    } finally {
      if (g === this.generation) this.setData({ loading: false });
    }
  },
  onRetry() {
    void this.fetchDetail();
  },
  retryPosts() {
    void this.loadPosts(this.data.page === 0);
  },
  onReachBottom() {
    if (this.data.hasMore) void this.loadPosts();
  },
  onTapPost(e: WechatMiniprogram.CustomEvent<{ postId: string }>) {
    go("post", { postId: e.detail.postId });
  },
  preview(e: WechatMiniprogram.TouchEvent) {
    wx.previewImage({
      current: e.currentTarget.dataset.url,
      urls: this.data.photos,
    });
  },
  back() {
    back("catalog");
  },
});
