import type { Area, Cat } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage } from "../../../core/request";
import { go } from "../../../core/routes";
Page({
  data: {
    areas: [] as Area[],
    cats: [] as Cat[],
    state: "loading",
    message: "",
    areaId: "",
    areaName: "",
    page: 0,
    hasMore: false,
    mapState: "loading",
    mapError: "",
  },
  sequence: 0,
  onShow() {
    void this.load();
  },
  async load() {
    this.setData({ mapState: "loading", mapError: "" });
    try {
      const result = await api.areas();
      this.setData({
        areas: result.items,
        mapState: result.items.length ? "ready" : "empty",
        state: "idle",
      });
      if (
        this.data.areaId &&
        result.items.some((a) => a.id === this.data.areaId)
      )
        await this.select(this.data.areaId);
      else this.setData({ areaId: "", areaName: "", cats: [] });
    } catch (e) {
      this.setData({ mapState: "error", mapError: errorMessage(e) });
    }
  },
  async select(id: string) {
    const sequence = ++this.sequence;
    const area = this.data.areas.find((a) => a.id === id);
    if (!area) return;
    this.setData({
      areaId: id,
      areaName: area.name,
      state: "loading",
      message: "",
      cats: [],
      page: 0,
      hasMore: false,
    });
    try {
      const result = await api.cats(id, 1);
      if (sequence !== this.sequence) return;
      this.setData({
        cats: result.items,
        page: 1,
        hasMore: result.hasMore,
        state: result.items.length ? "ready" : "empty",
      });
    } catch (e) {
      if (sequence === this.sequence)
        this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  async more() {
    if (!this.data.hasMore || this.data.state === "loading") return;
    const sequence = this.sequence;
    this.setData({ state: "loading" });
    try {
      const result = await api.cats(this.data.areaId, this.data.page + 1);
      if (sequence !== this.sequence) return;
      this.setData({
        cats: this.data.cats.concat(result.items),
        page: result.page,
        hasMore: result.hasMore,
        state: "ready",
      });
    } catch (e) {
      if (sequence === this.sequence)
        this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  retry() {
    void this.select(this.data.areaId);
  },
  choose(e: WechatMiniprogram.TouchEvent) {
    void this.select(e.currentTarget.dataset.id);
  },
  openCat(e: WechatMiniprogram.CustomEvent<{ catId: string }>) {
    go("cat", { catId: e.detail.catId });
  },
});
