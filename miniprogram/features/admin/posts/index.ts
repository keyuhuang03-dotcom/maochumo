import type { HidePost, Post } from "../../../../contracts/index";
import { errorMessage } from "../../../core/request";
import { requestKey } from "../../../core/submission";
import { back } from "../../../core/routes";
import { isAdmin } from "../access";
import { adminApi } from "../api";

Page({
  data: {
    title: "隐藏帖子",
    admin: false,
    ready: false,
    keyword: "",
    posts: [] as Post[],
    page: 1,
    hasMore: false,
    busy: false,
    message: "",
    selectedId: "",
    reason: "",
  },
  requestKeyValue: "",
  initialized: false,
  loadGeneration: 0,
  loadingList: false,
  onShow() {
    if (!isAdmin()) {
      this.setData({ admin: false, ready: true });
      return;
    }
    this.setData({ admin: true });
    if (!this.initialized) {
      this.initialized = true;
      this.requestKeyValue = requestKey();
    }
    void this.load();
  },
  onUnload() {
    this.loadGeneration++;
    this.initialized = false;
  },
  async load(append = false) {
    if (append && this.loadingList) return;
    const generation = ++this.loadGeneration;
    this.loadingList = true;
    try {
      const result = await adminApi.posts(
        append ? this.data.page + 1 : 1,
        this.data.keyword,
      );
      if (generation !== this.loadGeneration) return;
      this.setData({
        ready: true,
        posts: append ? [...this.data.posts, ...result.items] : result.items,
        page: result.page,
        hasMore: result.hasMore,
      });
    } catch (e) {
      if (generation === this.loadGeneration)
        this.setData({ ready: true, message: errorMessage(e) });
    } finally {
      if (generation === this.loadGeneration) this.loadingList = false;
    }
  },
  more() {
    if (!this.data.busy && this.data.hasMore) void this.load(true);
  },
  searchInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value });
  },
  search() {
    this.setData({ busy: true, message: "", selectedId: "" });
    void this.load().then(() => this.setData({ busy: false }));
  },
  select(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy) return;
    this.requestKeyValue = requestKey();
    this.setData({
      selectedId: e.currentTarget.dataset.id,
      reason: "",
      message: "",
    });
  },
  cancel() {
    if (this.data.busy) return;
    this.setData({ selectedId: "", reason: "", message: "" });
  },
  reasonInput(e: WechatMiniprogram.Input) {
    this.setData({ reason: e.detail.value });
  },
  async confirm() {
    if (this.data.busy || !this.data.selectedId) return;
    const reason = this.data.reason.trim();
    const postId = this.data.selectedId;
    const confirmed = await new Promise<boolean>((resolve) =>
      wx.showModal({
        title: "确认隐藏",
        content:
          "隐藏后首页、搜索、热榜、详情和档案关联均不可见，且没有恢复接口。",
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false),
      }),
    );
    if (!confirmed) return;
    if (!this.requestKeyValue) this.requestKeyValue = requestKey();
    const input: HidePost = {
      reason,
      requestKey: this.requestKeyValue,
    };
    this.setData({ busy: true, message: "" });
    try {
      await adminApi.hidePost(postId, input);
      this.requestKeyValue = requestKey();
      this.setData({
        busy: false,
        selectedId: "",
        reason: "",
        message: "已隐藏帖子 " + postId,
      });
      await this.load();
    } catch (e) {
      this.setData({
        busy: false,
        message: errorMessage(e),
      });
    }
  },
  back() {
    back("admin");
  },
});
