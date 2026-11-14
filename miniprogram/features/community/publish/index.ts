import type { Cat, Ref, CreatePost } from "../../../../contracts/index";
import { textLength } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { requireLogin } from "../../../core/auth";
import { getSession } from "../../../core/session";
import { uploadImage } from "../../../core/upload";
import { errorMessage } from "../../../core/request";
import { requestKey, resultUnknown } from "../../../core/submission";
import { go } from "../../../core/routes";
interface ImageDraft {
  path: string;
  imageRef?: string;
}
interface Draft {
  body: string;
  images: ImageDraft[];
  catIds: string[];
  topicIds: string[];
  pending: CreatePost | null;
}
const empty = (): Draft => ({
  body: "",
  images: [],
  catIds: [],
  topicIds: [],
  pending: null,
});
Page({
  data: {
    ...empty(),
    length: 0,
    cats: [] as (Cat & { selected: boolean })[],
    topics: [] as (Ref & { selected: boolean })[],
    busy: false,
    message: "",
    optionsError: "",
    catQ: "",
    catPage: 0,
    catMore: false,
    catLoading: false,
    chosenTags: [] as Ref[],
  },
  draftKey: "",
  catSequence: 0,
  onShow() {
    const key = "maochumo.publish." + (getSession()?.user.id || "guest");
    if (this.draftKey !== key) {
      const own = wx.getStorageSync(key) as Draft | undefined;
      const guest = wx.getStorageSync("maochumo.publish.guest") as
        | Draft
        | undefined;
      const draft = own || guest || empty();
      this.draftKey = key;
      this.setData({ ...draft, length: textLength(draft.body), message: "" });
      if (!own && guest && getSession()) {
        this.persist();
        wx.removeStorageSync("maochumo.publish.guest");
      }
    }
    void this.loadOptions().then(() => this.updateChosenTags());
  },
  updateChosenTags() {
    this.setData({
      chosenTags: [
        ...this.data.topicIds.map((id) => ({
          id,
          name:
            this.data.topics.find((t) => t.id === id)?.name ||
            this.data.chosenTags.find((t) => t.id === id)?.name ||
            "话题",
        })),
        ...this.data.catIds.map((id) => ({
          id,
          name:
            this.data.cats.find((c) => c.id === id)?.name ||
            this.data.chosenTags.find((c) => c.id === id)?.name ||
            "猫咪档案",
        })),
      ],
    });
  },
  applyTags(catIds: string[], topicIds: string[], chosenTags: Ref[]) {
    this.setData({ catIds, topicIds, chosenTags });
    this.persist();
  },
  selectTags() {
    if (!this.data.busy && !this.data.pending) go("tags");
  },
  persist() {
    const { body, images, catIds, topicIds, pending } = this.data;
    wx.setStorageSync(this.draftKey, {
      body,
      images,
      catIds,
      topicIds,
      pending,
    });
  },
  bodyInput(e: WechatMiniprogram.Input) {
    if (this.data.pending) return;
    this.setData({ body: e.detail.value, length: textLength(e.detail.value) });
    this.persist();
  },
  async loadOptions() {
    this.setData({ optionsError: "" });
    try {
      const result = await api.topics();
      this.setData({
        topics: result.items.map((t) => ({
          ...t,
          selected: this.data.topicIds.includes(t.id),
        })),
      });
      await this.searchCats();
    } catch (e) {
      this.setData({ optionsError: errorMessage(e) });
    }
  },
  catInput(e: WechatMiniprogram.Input) {
    this.setData({ catQ: e.detail.value });
  },
  async searchCats() {
    this.setData({ catPage: 0 });
    await this.loadCats(false);
  },
  async moreCats() {
    await this.loadCats(true);
  },
  async loadCats(append: boolean) {
    if (append && (!this.data.catMore || this.data.catLoading)) return;
    const sequence = ++this.catSequence;
    this.setData({ catLoading: true });
    try {
      const result = await api.cats(
        "",
        append ? this.data.catPage + 1 : 1,
        this.data.catQ,
      );
      if (sequence !== this.catSequence) return;
      const cats = result.items.map((c) => ({
        ...c,
        selected: this.data.catIds.includes(c.id),
      }));
      this.setData({
        cats: append ? this.data.cats.concat(cats) : cats,
        catPage: result.page,
        catMore: result.hasMore,
      });
    } catch (e) {
      if (sequence === this.catSequence)
        this.setData({ optionsError: errorMessage(e) });
    } finally {
      if (sequence === this.catSequence) this.setData({ catLoading: false });
    }
  },
  toggle(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.pending) return;
    const id = e.currentTarget.dataset.id;
    const kind = e.currentTarget.dataset.kind as "cat" | "topic";
    const key = kind === "cat" ? "catIds" : "topicIds";
    const next = this.data[key].includes(id)
      ? this.data[key].filter((v) => v !== id)
      : this.data[key].concat(id);
    if (next.length > 50) {
      this.setData({ message: "最多关联50项" });
      return;
    }
    this.setData({ [key]: next });
    this.setData({
      cats: this.data.cats.map((c) => ({
        ...c,
        selected: this.data.catIds.includes(c.id),
      })),
      topics: this.data.topics.map((t) => ({
        ...t,
        selected: this.data.topicIds.includes(t.id),
      })),
    });
    this.persist();
  },
  async chooseImages() {
    if (this.data.busy || this.data.pending) return;
    const remaining = 9 - this.data.images.length;
    if (remaining <= 0) return;
    try {
      const selected =
        await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>(
          (resolve, reject) =>
            wx.chooseMedia({
              count: remaining,
              mediaType: ["image"],
              sourceType: ["album", "camera"],
              success: resolve,
              fail: reject,
            }),
        );
      const images = this.data.images.slice();
      for (const file of selected.tempFiles) {
        if (file.size > 8 * 1024 * 1024) throw new Error("每张图片不超过8MB");
        const saved = await new Promise<string>((resolve, reject) =>
          wx.getFileSystemManager().saveFile({
            tempFilePath: file.tempFilePath,
            success: (r) => resolve(r.savedFilePath),
            fail: reject,
          }),
        );
        images.push({ path: saved });
        this.setData({ images });
        this.persist();
      }
    } catch (e) {
      if (
        !(
          e &&
          typeof e === "object" &&
          "errMsg" in e &&
          String(e.errMsg).includes("cancel")
        )
      )
        this.setData({ message: errorMessage(e) });
    }
  },
  removeImage(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.pending) return;
    this.setData({
      images: this.data.images.filter(
        (_, i) => i !== Number(e.currentTarget.dataset.index),
      ),
    });
    this.persist();
  },
  preview(e: WechatMiniprogram.TouchEvent) {
    wx.previewImage({
      current: e.currentTarget.dataset.path,
      urls: this.data.images.map((i) => i.path),
    });
  },
  async submit() {
    if (this.data.busy) return;
    this.persist();
    if (!requireLogin("publish")) return;
    if (
      textLength(this.data.body) > 2000 ||
      (!this.data.body.trim() && !this.data.images.length)
    ) {
      this.setData({ message: "正文和图片至少有一项，正文最多2000字" });
      return;
    }
    this.setData({ busy: true, message: "" });
    try {
      let payload = this.data.pending;
      if (!payload) {
        for (let i = 0; i < this.data.images.length; i++) {
          if (this.data.images[i].imageRef) continue;
          const uploaded = await uploadImage(this.data.images[i].path);
          const images = this.data.images.slice();
          images[i] = { ...images[i], imageRef: uploaded.imageRef };
          this.setData({ images });
          this.persist();
        }
        payload = {
          body: this.data.body,
          imageRefs: this.data.images.map((i) => i.imageRef!),
          catIds: this.data.catIds.slice(),
          topicIds: this.data.topicIds.slice(),
          requestKey: requestKey(),
        };
        this.setData({ pending: payload });
        this.persist();
      }
      const post = await api.createPost(payload);
      wx.removeStorageSync(this.draftKey);
      this.setData({ ...empty(), length: 0 });
      go("success", { postId: post.id });
    } catch (e) {
      if (!resultUnknown(e)) {
        this.setData({ pending: null });
        this.persist();
      }
      this.setData({ message: errorMessage(e) });
    } finally {
      this.setData({ busy: false });
    }
  },
});
