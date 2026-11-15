import type { Area, CreateArea, UpdateArea } from "../../../../contracts/index";
import { errorMessage, RequestError } from "../../../core/request";
import { requestKey } from "../../../core/submission";
import { back } from "../../../core/routes";
import { isAdmin } from "../access";
import { adminApi } from "../api";

interface RegionForm {
  x: string;
  y: string;
  width: string;
  height: string;
}
interface FormState extends RegionForm {
  name: string;
}
const emptyForm = (): FormState => ({
  name: "",
  x: "0",
  y: "0",
  width: "0.3",
  height: "0.3",
});

Page({
  data: {
    title: "活动区域维护",
    admin: false,
    ready: false,
    areas: [] as Area[],
    form: emptyForm(),
    editingId: "",
    editingVersion: 0,
    busy: false,
    message: "",
    conflict: false,
  },
  requestKeyValue: "",
  initialized: false,
  onShow() {
    if (!isAdmin()) {
      this.setData({ admin: false, ready: true });
      return;
    }
    this.setData({ admin: true });
    if (!this.initialized) {
      this.initialized = true;
      this.newDraft();
    }
    void this.load();
  },
  onUnload() {
    this.initialized = false;
  },
  newDraft() {
    this.requestKeyValue = requestKey();
    this.setData({
      editingId: "",
      editingVersion: 0,
      form: emptyForm(),
      message: "",
      conflict: false,
    });
  },
  async load() {
    try {
      const result = await adminApi.areas();
      this.setData({ ready: true, areas: result.items });
    } catch (e) {
      this.setData({ ready: true, message: errorMessage(e) });
    }
  },
  fieldInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as keyof FormState;
    this.setData({ form: { ...this.data.form, [field]: e.detail.value } });
  },
  edit(e: WechatMiniprogram.TouchEvent) {
    const area = this.data.areas.find(
      (a) => a.id === e.currentTarget.dataset.id,
    );
    if (!area) return;
    this.requestKeyValue = requestKey();
    this.setData({
      editingId: area.id,
      editingVersion: area.version,
      form: {
        name: area.name,
        x: String(area.region.x),
        y: String(area.region.y),
        width: String(area.region.width),
        height: String(area.region.height),
      },
      message: "",
      conflict: false,
    });
  },
  async refreshCurrent() {
    try {
      const result = await adminApi.areas();
      const area = result.items.find((a) => a.id === this.data.editingId);
      this.setData({ areas: result.items });
      if (!area) {
        this.setData({ message: "该区域已不存在" });
        return;
      }
      this.setData({
        editingVersion: area.version,
        form: {
          name: area.name,
          x: String(area.region.x),
          y: String(area.region.y),
          width: String(area.region.width),
          height: String(area.region.height),
        },
        message: "已载入最新版本 " + area.version,
        conflict: false,
      });
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    }
  },
  async submit() {
    if (this.data.busy) return;
    const form = this.data.form;
    const name = form.name.trim();
    if (!name) return this.setData({ message: "请填写区域名称" });
    const x = Number(form.x);
    const y = Number(form.y);
    const width = Number(form.width);
    const height = Number(form.height);
    const numbers = [x, y, width, height];
    if (numbers.some((n) => !Number.isFinite(n)))
      return this.setData({ message: "区域范围必须是数字" });
    if (
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > 1 ||
      y + height > 1
    )
      return this.setData({
        message: "区域范围必须是单位地图内的非空矩形（0—1）",
      });
    if (!this.requestKeyValue) this.requestKeyValue = requestKey();
    this.setData({ busy: true, message: "", conflict: false });
    try {
      const base: CreateArea = {
        name,
        region: { x, y, width, height },
        requestKey: this.requestKeyValue,
      };
      let saved: Area;
      if (this.data.editingId) {
        const payload: UpdateArea = {
          ...base,
          version: this.data.editingVersion,
        };
        saved = await adminApi.updateArea(this.data.editingId, payload);
      } else {
        saved = await adminApi.createArea(base);
      }
      this.requestKeyValue = requestKey();
      this.setData({
        editingId: saved.id,
        editingVersion: saved.version,
        form: {
          name: saved.name,
          x: String(saved.region.x),
          y: String(saved.region.y),
          width: String(saved.region.width),
          height: String(saved.region.height),
        },
        busy: false,
        message: "已保存，当前版本 " + saved.version,
      });
      await this.load();
    } catch (e) {
      const conflict =
        e instanceof RequestError && e.code === "VERSION_CONFLICT";
      this.setData({
        busy: false,
        conflict,
        message: conflict
          ? "该区域已被其他人修改，请载入最新版本后重试"
          : errorMessage(e),
      });
    }
  },
  back() {
    back("admin");
  },
});
