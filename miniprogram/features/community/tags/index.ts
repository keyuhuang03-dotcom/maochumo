import type { Cat, Ref } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage } from "../../../core/request";
interface Editor {
  data: { catIds: string[]; topicIds: string[]; chosenTags: Ref[] };
  applyTags: (catIds: string[], topicIds: string[], tags: Ref[]) => void;
}
Page({
  data: {
    catIds: [] as string[],
    topicIds: [] as string[],
    topics: [] as (Ref & { selected: boolean })[],
    cats: [] as (Cat & { selected: boolean })[],
    q: "",
    page: 0,
    hasMore: false,
    state: "loading",
    message: "",
    catLoading: false,
  },
  names: {} as Record<string, string>,
  sequence: 0,
  onLoad() {
    const pages = getCurrentPages();
    const editor = pages[pages.length - 2] as unknown as Editor | undefined;
    this.setData({
      catIds: editor?.data.catIds.slice() || [],
      topicIds: editor?.data.topicIds.slice() || [],
    });
    for (const t of editor?.data.chosenTags || []) this.names[t.id] = t.name;
    void this.load();
  },
  async load() {
    this.setData({ state: "loading", message: "" });
    try {
      const topics = await api.topics();
      for (const t of topics.items) this.names[t.id] = t.name;
      this.setData({
        topics: topics.items.map((t) => ({
          ...t,
          selected: this.data.topicIds.includes(t.id),
        })),
        state: "ready",
      });
      await this.search();
    } catch (error) {
      this.setData({ state: "error", message: errorMessage(error) });
    }
  },
  input(e: WechatMiniprogram.Input) {
    this.setData({ q: e.detail.value });
  },
  async search() {
    await this.loadCats(false);
  },
  async more() {
    if (this.data.hasMore && !this.data.catLoading) await this.loadCats(true);
  },
  async loadCats(append: boolean) {
    const sequence = ++this.sequence;
    this.setData({ catLoading: true, message: "" });
    try {
      const result = await api.cats(
        "",
        append ? this.data.page + 1 : 1,
        this.data.q,
      );
      if (sequence !== this.sequence) return;
      for (const c of result.items) this.names[c.id] = c.name;
      const cats = result.items.map((c) => ({
        ...c,
        selected: this.data.catIds.includes(c.id),
      }));
      this.setData({
        cats: append ? this.data.cats.concat(cats) : cats,
        page: result.page,
        hasMore: result.hasMore,
      });
    } catch (error) {
      if (sequence === this.sequence)
        this.setData({ message: errorMessage(error) });
    } finally {
      if (sequence === this.sequence) this.setData({ catLoading: false });
    }
  },
  toggle(e: WechatMiniprogram.TouchEvent) {
    const { id, kind } = e.currentTarget.dataset;
    const field = kind === "cat" ? "catIds" : "topicIds";
    const ids = this.data[field];
    const next = ids.includes(id)
      ? ids.filter((v) => v !== id)
      : ids.concat(id);
    if (next.length > 50) {
      this.setData({ message: "最多关联50项" });
      return;
    }
    this.setData({ [field]: next });
    this.setData({
      topics: this.data.topics.map((t) => ({
        ...t,
        selected: this.data.topicIds.includes(t.id),
      })),
      cats: this.data.cats.map((c) => ({
        ...c,
        selected: this.data.catIds.includes(c.id),
      })),
    });
  },
  clear() {
    this.setData({
      catIds: [],
      topicIds: [],
      cats: this.data.cats.map((c) => ({ ...c, selected: false })),
      topics: this.data.topics.map((t) => ({ ...t, selected: false })),
    });
  },
  done() {
    const pages = getCurrentPages();
    const editor = pages[pages.length - 2] as unknown as Editor | undefined;
    if (!editor?.applyTags) {
      wx.navigateBack();
      return;
    }
    const tags = [...this.data.topicIds, ...this.data.catIds].map((id) => ({
      id,
      name: this.names[id] || id,
    }));
    editor.applyTags(this.data.catIds, this.data.topicIds, tags);
    wx.navigateBack();
  },
});
