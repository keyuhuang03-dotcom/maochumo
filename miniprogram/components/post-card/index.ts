import { go } from "../../core/routes";
Component({
  properties: {
    post: { type: Object, value: {} as { id: string; images: string[] } },
  },
  methods: {
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
