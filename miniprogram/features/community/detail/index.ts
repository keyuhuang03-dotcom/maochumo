import type { Post, Comment, CreateComment } from "../../../../contracts/index";
import { textLength } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage, RequestError } from "../../../core/request";
import { back, go } from "../../../core/routes";
import { requireLogin } from "../../../core/auth";
import { getSession } from "../../../core/session";
import { requestKey, resultUnknown } from "../../../core/submission";
Page({
  data: {
    post: null as Post | null,
    state: "loading",
    message: "",
    postId: "",
    commentId: "",
    comments: [] as Comment[],
    commentPage: 0,
    commentMore: false,
    commentState: "idle",
    commentError: "",
    body: "",
    replyToId: null as string | null,
    replyName: "",
    pending: null as CreateComment | null,
    likeTarget: null as boolean | null,
    liking: false,
    sending: false,
    deleting: false,
    canDelete: false,
  },
  draftKey: "",
  generation: 0,
  context() {
    const generation = this.generation,
      token = getSession()?.token;
    return () =>
      generation === this.generation && token === getSession()?.token;
  },
  onHide() {
    this.generation++;
  },
  onUnload() {
    this.generation++;
  },
  onLoad(o) {
    this.setData({ postId: o.postId || "", commentId: o.commentId || "" });
  },
  onShow() {
    this.generation++;
    this.setData({ liking: false, sending: false, deleting: false });
    const key =
      "maochumo.comment." +
      (getSession()?.user.id || "guest") +
      "." +
      this.data.postId;
    if (key !== this.draftKey) {
      const changedIdentity = !!this.draftKey;
      const draft = wx.getStorageSync(key) as
        | {
            body: string;
            replyToId: string | null;
            replyName: string;
            pending: CreateComment | null;
          }
        | undefined;
      const guestKey = "maochumo.comment.guest." + this.data.postId;
      const guest =
        this.draftKey === guestKey && getSession()
          ? wx.getStorageSync(guestKey)
          : undefined;
      this.draftKey = key;
      this.setData({
        body: "",
        replyToId: null,
        replyName: "",
        pending: null,
        likeTarget: null,
        canDelete: false,
        ...(changedIdentity ? { commentId: "" } : {}),
        ...(draft || guest || {}),
      });
      if (!draft && guest) {
        this.persist();
        wx.removeStorageSync(guestKey);
      }
    }
    void this.load();
  },
  persist() {
    const key =
      "maochumo.comment." +
      (getSession()?.user.id || "guest") +
      "." +
      this.data.postId;
    if (this.draftKey !== key) return;
    wx.setStorageSync(this.draftKey, {
      body: this.data.body,
      replyToId: this.data.replyToId,
      replyName: this.data.replyName,
      pending: this.data.pending,
    });
  },
  async load() {
    const current = this.context();
    this.setData({ state: "loading", post: null, comments: [], message: "" });
    try {
      const post = await api.post(this.data.postId);
      if (!current()) return;
      this.setData({
        post,
        state: "ready",
        canDelete: post.author.id === getSession()?.user.id,
      });
      await this.loadComments(false, this.data.commentId);
    } catch (e) {
      if (!current()) return;
      this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  async loadComments(append = false, focusId = "") {
    const current = this.context();
    this.setData({ commentState: "loading", commentError: "" });
    try {
      const result = await api.comments(
        this.data.postId,
        append ? this.data.commentPage + 1 : 1,
        focusId,
      );
      if (!current()) return;
      this.setData({
        comments: append
          ? this.data.comments.concat(result.items)
          : result.items,
        commentPage: result.page,
        commentMore: result.hasMore,
        commentState: result.items.length ? "ready" : "empty",
      });
      if (focusId)
        wx.nextTick(
          () =>
            current() &&
            wx.pageScrollTo({ selector: "#comment-" + focusId, duration: 200 }),
        );
    } catch (e) {
      if (!current()) return;
      this.setData({ commentState: "error", commentError: errorMessage(e) });
    }
  },
  retryComments() {
    void this.loadComments(false);
  },
  moreComments() {
    if (this.data.commentMore && this.data.commentState !== "loading")
      void this.loadComments(true);
  },
  firstComments() {
    this.setData({ commentId: "" });
    void this.loadComments(false);
  },
  async like() {
    if (this.data.liking || !this.data.post) return;
    if (!requireLogin("post")) return;
    const current = this.context();
    const target =
      this.data.likeTarget === null
        ? !this.data.post.liked
        : this.data.likeTarget;
    this.setData({ liking: true, likeTarget: target, message: "" });
    try {
      const result = await api.like(this.data.postId, target);
      if (!current()) return;
      this.setData({
        post: { ...this.data.post, ...result },
        likeTarget: null,
      });
    } catch (e) {
      if (!current()) return;
      if (!resultUnknown(e)) this.setData({ likeTarget: null });
      this.setData({ message: errorMessage(e) });
    } finally {
      if (current()) this.setData({ liking: false });
    }
  },
  input(e: WechatMiniprogram.Input) {
    if (this.data.pending) return;
    this.setData({ body: e.detail.value });
    this.persist();
  },
  reply(e: WechatMiniprogram.TouchEvent) {
    if (this.data.pending || this.data.sending) return;
    this.setData({
      replyToId: e.currentTarget.dataset.id,
      replyName: e.currentTarget.dataset.name || "校园同学",
    });
    this.persist();
  },
  cancelReply() {
    if (this.data.pending || this.data.sending) return;
    this.setData({ replyToId: null, replyName: "" });
    this.persist();
  },
  async send() {
    if (this.data.sending) return;
    this.persist();
    if (!requireLogin("post")) return;
    const body = this.data.body.trim();
    if (!body || textLength(body) > 2000) {
      this.setData({ message: "评论须为1至2000字" });
      return;
    }
    const current = this.context();
    const payload = this.data.pending || {
      body,
      replyToId: this.data.replyToId,
      requestKey: requestKey(),
    };
    this.setData({ sending: true, pending: payload, message: "" });
    this.persist();
    try {
      const comment = await api.comment(this.data.postId, payload);
      if (!current()) return;
      this.setData({
        body: "",
        replyToId: null,
        replyName: "",
        pending: null,
        commentId: comment.id,
      });
      this.persist();
      const post = await api.post(this.data.postId);
      if (!current()) return;
      this.setData({ post });
      await this.loadComments(false, comment.id);
    } catch (e) {
      if (!current()) return;
      if (!resultUnknown(e)) {
        this.setData({ pending: null });
        this.persist();
      }
      this.setData({ message: errorMessage(e) });
    } finally {
      if (current()) this.setData({ sending: false });
    }
  },
  async remove() {
    if (this.data.deleting || !this.data.canDelete) return;
    const current = this.context();
    const confirmed = await new Promise<boolean>((resolve) =>
      wx.showModal({
        title: "删除这篇帖子？",
        content: "删除后不会出现在公开列表，操作不能在小程序内恢复。",
        confirmText: "删除",
        success: (r) => resolve(r.confirm),
        fail: () => resolve(false),
      }),
    );
    if (!confirmed || !current()) return;
    this.setData({ deleting: true, message: "" });
    try {
      await api.deletePost(this.data.postId);
      if (!current()) return;
      go("home");
    } catch (e) {
      if (!current()) return;
      this.setData({ message: errorMessage(e) });
    } finally {
      if (current()) this.setData({ deleting: false });
    }
  },
  back() {
    back();
  },
});
