import type { Post } from "../../../contracts/index";
import { api } from "../../core/api";
import { requireLogin } from "../../core/auth";
import { errorMessage } from "../../core/request";
import { resultUnknown } from "../../core/submission";
import { go } from "../../core/routes";
Component({
  properties: {
    post: { type: Object, value: {} as Post },
    detail: { type: Boolean, value: false },
  },
  data: {
    liking: false,
    likeTarget: null as boolean | null,
    message: "",
    timeLabel: "",
  },
  observers: {
    post(post: Post) {
      if (!post?.createdAt) return;
      const date = new Date(post.createdAt);
      this.setData({
        timeLabel: `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      });
    },
  },
  methods: {
    async like() {
      if (this.data.liking || !requireLogin("home")) return;
      const target =
        this.data.likeTarget === null
          ? !this.data.post.liked
          : this.data.likeTarget;
      this.setData({ liking: true, likeTarget: target, message: "" });
      try {
        const result = await api.like(this.data.post.id, target);
        this.setData({
          post: { ...this.data.post, ...result },
          likeTarget: null,
        });
      } catch (error) {
        if (!resultUnknown(error)) this.setData({ likeTarget: null });
        this.setData({ message: errorMessage(error) });
      } finally {
        this.setData({ liking: false });
      }
    },
    open() {
      this.triggerEvent("open", { postId: this.data.post.id });
    },
    preview(e: WechatMiniprogram.TouchEvent) {
      wx.previewImage({
        current: e.currentTarget.dataset.url,
        urls: this.data.post.images,
      });
    },
    cat(e: WechatMiniprogram.TouchEvent) {
      go("cat", { catId: e.currentTarget.dataset.id });
    },
    topic(e: WechatMiniprogram.TouchEvent) {
      go("search", { topicId: e.currentTarget.dataset.id });
    },
  },
});
