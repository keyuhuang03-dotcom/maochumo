import type { Area, Cat } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage } from "../../../core/request";
import { go } from "../../../core/routes";
Page({
  data: {
    loading: false,
    viewState: "loading",
    viewMessage: "",
    currentAreaName: "",
    q: "",
    areaId: "",
    areaList: [] as Area[],
    page: 0,
    catList: [] as Cat[],
    hasMore: false,
  },
  generation: 0,
  onShow() {
    void this.fetchAreaList();
    void this.fetchCatList(true);
  },
  onUnload() {
    this.generation++;
  },
  async fetchAreaList() {
    try {
      const res = await api.areas();
      this.setData({ areaList: res.items });
    } catch (e) {
      this.setData({ viewMessage: errorMessage(e) });
    }
  },
  async fetchCatList(reset = false) {
    if (!reset && this.data.loading) return;
    const generation = reset ? ++this.generation : this.generation;
    const page = reset ? 1 : this.data.page + 1;
    this.setData({
      loading: true,
      ...(reset ? { catList: [], viewState: "loading", viewMessage: "" } : {}),
    });
    try {
      const res = await api.cats(this.data.areaId, page, this.data.q);
      if (generation !== this.generation) return;
      const catList = reset ? res.items : [...this.data.catList, ...res.items];
      this.setData({
        catList,
        page: res.page,
        hasMore: res.hasMore,
        viewState: catList.length ? "idle" : "empty",
        viewMessage: catList.length ? "" : "暂无猫咪，换个条件试试",
      });
    } catch (e) {
      if (generation === this.generation)
        this.setData({ viewState: "error", viewMessage: errorMessage(e) });
    } finally {
      if (generation === this.generation) this.setData({ loading: false });
    }
  },
  onSearchInput(e: WechatMiniprogram.Input) {
    this.setData({ q: e.detail.value });
  },
  onSearch() {
    void this.fetchCatList(true);
  },
  onAreaChange(e: WechatMiniprogram.PickerChange) {
    const a = this.data.areaList[Number(e.detail.value)];
    if (a) {
      this.setData({ areaId: a.id, currentAreaName: a.name });
      void this.fetchCatList(true);
    }
  },
  clearFilter() {
    this.setData({ q: "", areaId: "", currentAreaName: "" });
    void this.fetchCatList(true);
  },
  onReachBottom() {
    if (this.data.hasMore && this.data.viewState === "idle")
      void this.fetchCatList();
  },
  onRetry() {
    void this.fetchAreaList();
    void this.fetchCatList(true);
  },
  onTapCatCard(e: WechatMiniprogram.CustomEvent<{ catId: string }>) {
    go("cat", { catId: e.detail.catId });
  },
});
