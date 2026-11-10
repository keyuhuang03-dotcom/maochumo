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
  },
  onLoad() {
    void this.load();
  },
  async load() {
    this.setData({ state: "loading", message: "" });
    try {
      const result = await api.areas();
      this.setData({
        areas: result.items,
        state: result.items.length ? "ready" : "empty",
      });
      if (this.data.areaId) await this.select(this.data.areaId);
    } catch (e) {
      this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  async select(id: string) {
    const area = this.data.areas.find((a) => a.id === id);
    this.setData({
      areaId: id,
      areaName: area?.name || "",
      state: "loading",
      cats: [],
    });
    try {
      const result = await api.cats(id);
      this.setData({
        cats: result.items,
        state: result.items.length ? "ready" : "empty",
      });
    } catch (e) {
      this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  choose(e: WechatMiniprogram.TouchEvent) {
    void this.select(e.currentTarget.dataset.id);
  },
  openCat(e: WechatMiniprogram.CustomEvent<{ catId: string }>) {
    go("cat", { catId: e.detail.catId });
  },
});
