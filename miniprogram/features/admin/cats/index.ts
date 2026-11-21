import { getSession } from "../../../core/session";
import { pendingAdmin, submitAdmin, pendingMessage } from "../submission";
import type {
  Area,
  Cat,
  CreateCat,
  UpdateCat,
} from "../../../../contracts/index";
import { errorMessage, RequestError } from "../../../core/request";
import { requestKey } from "../../../core/submission";
import { uploadImage } from "../../../core/upload";
import { back } from "../../../core/routes";
import { isAdmin } from "../access";
import { adminApi, mediaUrl } from "../api";

interface FormState {
  name: string;
  areaId: string;
  aliases: string;
  sex: "male" | "female" | "unknown";
  appearance: string;
  personality: string;
}
interface PhotoDraft {
  path: string;
  imageRef: string;
}
type CatRow = Cat & { areaName: string; aliasText: string };
const sexes: FormState["sex"][] = ["male", "female", "unknown"];
const emptyForm = (areaId = ""): FormState => ({
  name: "",
  areaId,
  aliases: "",
  sex: "unknown",
  appearance: "",
  personality: "",
});

Page({
  data: {
    title: "猫咪档案维护",
    admin: false,
    ready: false,
    areas: [] as Area[],
    areaNames: [] as string[],
    areaIndex: 0,
    sexNames: ["公猫", "母猫", "未知"],
    sexIndex: 2,
    cats: [] as CatRow[],
    photos: [] as PhotoDraft[],
    form: emptyForm(),
    editingId: "",
    editingVersion: 0,
    busy: false,
    pending: false,
    message: "",
    conflict: false,
    keyword: "",
    page: 1,
    hasMore: false,
  },
  requestKeyValue: "",
  initialized: false,
  actorId: "",
  loadGeneration: 0,
  loadingList: false,
  onShow() {
    const actorId = getSession()?.user.id || "";
    if (actorId !== this.actorId) {
      this.actorId = actorId;
      this.initialized = false;
      this.setData({ busy: false, pending: false });
    }
    if (!isAdmin()) {
      this.setData({ admin: false, ready: true });
      return;
    }
    this.setData({ admin: true });
    this.restorePending();
    if (!this.initialized) {
      this.initialized = true;
      this.newDraft();
    }
    void this.load();
  },
  onUnload() {
    this.loadGeneration++;
    this.initialized = false;
  },
  restorePending() {
    const item = pendingAdmin<CreateCat | UpdateCat>("cats");
    this.setData({ pending: !!item });
    if (item) {
      const input = item.input;
      this.requestKeyValue = input.requestKey;
      this.setData({
        editingId: item.id,
        editingVersion: "version" in input ? input.version : 0,
        form: {
          name: input.name,
          areaId: input.areaId,
          aliases: input.aliases.join("，"),
          sex: input.sex,
          appearance: input.appearance || "",
          personality: input.personality || "",
        },
        sexIndex: sexes.indexOf(input.sex),
        photos: input.photoRefs.map((ref) => ({
          path: mediaUrl(ref),
          imageRef: ref,
        })),
      });
      this.setData({ message: pendingMessage });
    }
  },
  newDraft() {
    if (this.data.busy || this.data.pending) return;
    this.requestKeyValue = requestKey();
    this.setData({
      editingId: "",
      editingVersion: 0,
      photos: [],
      areaIndex: 0,
      sexIndex: 2,
      form: emptyForm(this.data.areas[0]?.id || ""),
      message: "",
      conflict: false,
    });
  },
  async load(append = false) {
    if (append && this.loadingList) return;
    const generation = ++this.loadGeneration;
    this.loadingList = true;
    try {
      const [areas, cats] = await Promise.all([
        adminApi.areas(),
        adminApi.cats(append ? this.data.page + 1 : 1, this.data.keyword),
      ]);
      if (generation !== this.loadGeneration) return;
      const names = areas.items.map((a) => a.name);
      const rows: CatRow[] = cats.items.map((c) => ({
        ...c,
        areaName: areas.items.find((a) => a.id === c.areaId)?.name || c.areaId,
        aliasText: c.aliases.join("、"),
      }));
      const areaId = this.data.form.areaId;
      const areaIndex = Math.max(
        0,
        areas.items.findIndex((a) => a.id === areaId),
      );
      this.setData({
        ready: true,
        areas: areas.items,
        areaNames: names,
        areaIndex,
        cats: append ? [...this.data.cats, ...rows] : rows,
        page: cats.page,
        hasMore: cats.hasMore,
      });
      if (!this.data.form.areaId && !this.data.editingId && areas.items[0])
        this.setData({
          form: { ...this.data.form, areaId: areas.items[0].id },
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
    this.setData({ busy: true, message: "" });
    void this.load().then(() => this.setData({ busy: false }));
  },
  fieldInput(e: WechatMiniprogram.Input) {
    if (this.data.busy || this.data.pending) return;
    const field = e.currentTarget.dataset.field as keyof FormState;
    this.setData({ form: { ...this.data.form, [field]: e.detail.value } });
  },
  areaChange(e: WechatMiniprogram.PickerChange) {
    if (this.data.busy || this.data.pending) return;
    const index = Number(e.detail.value);
    const area = this.data.areas[index];
    if (area)
      this.setData({
        areaIndex: index,
        form: { ...this.data.form, areaId: area.id },
      });
  },
  sexChange(e: WechatMiniprogram.PickerChange) {
    if (this.data.busy || this.data.pending) return;
    const index = Number(e.detail.value);
    this.setData({
      sexIndex: index,
      form: { ...this.data.form, sex: sexes[index] || "unknown" },
    });
  },
  choosePhotos() {
    if (this.data.busy || this.data.pending) return;
    if (this.data.busy || this.data.photos.length >= 9) return;
    wx.chooseMedia({
      count: 9 - this.data.photos.length,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        this.setData({
          photos: [
            ...this.data.photos,
            ...res.tempFiles.map((f) => ({
              path: f.tempFilePath,
              imageRef: "",
            })),
          ],
        });
      },
    });
  },
  removePhoto(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.pending) return;
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ photos: this.data.photos.filter((_, i) => i !== index) });
  },
  preview(e: WechatMiniprogram.TouchEvent) {
    const path = e.currentTarget.dataset.path as string;
    if (path) wx.previewImage({ current: path, urls: [path] });
  },
  async edit(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy) return;
    await this.loadCat(e.currentTarget.dataset.id as string);
  },
  async refreshCurrent() {
    if (this.data.busy || this.data.pending) return;
    if (this.data.editingId) await this.loadCat(this.data.editingId);
  },
  async loadCat(id: string) {
    if (this.data.busy || this.data.pending) return;
    this.setData({ busy: true, message: "", conflict: false });
    try {
      const cat = await adminApi.cat(id);
      this.requestKeyValue = requestKey();
      this.setData({
        editingId: cat.id,
        editingVersion: cat.version,
        form: {
          name: cat.name,
          areaId: cat.areaId,
          aliases: cat.aliases.join("，"),
          sex: cat.sex,
          appearance: cat.appearance || "",
          personality: cat.personality || "",
        },
        areaIndex: Math.max(
          0,
          this.data.areas.findIndex((a) => a.id === cat.areaId),
        ),
        sexIndex: sexes.indexOf(cat.sex),
        photos: cat.photoRefs.map((ref) => ({
          path: mediaUrl(ref),
          imageRef: ref,
        })),
      });
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    } finally {
      this.setData({ busy: false });
    }
  },
  async submit() {
    if (this.data.busy) return;
    const form = this.data.form;
    const name = form.name.trim();
    if (!name) return this.setData({ message: "请填写猫咪名称" });
    if (!form.areaId) return this.setData({ message: "请选择主要活动区域" });
    if (!this.requestKeyValue) this.requestKeyValue = requestKey();
    this.setData({ busy: true, message: "", conflict: false });
    try {
      const photos = this.data.photos.map((p) => ({ ...p }));
      for (const photo of photos)
        if (!photo.imageRef) {
          const uploaded = await uploadImage(photo.path, "cat");
          photo.imageRef = uploaded.imageRef;
          this.setData({ photos });
        }
      const base: CreateCat = {
        name,
        areaId: form.areaId,
        aliases: form.aliases
          .split(/[，,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        photoRefs: photos.map((p) => p.imageRef),
        sex: form.sex,
        appearance: form.appearance.trim() || null,
        personality: form.personality.trim() || null,
        requestKey: this.requestKeyValue,
      };
      const input: CreateCat | UpdateCat = this.data.editingId
        ? { ...base, version: this.data.editingVersion }
        : base;
      const saved = await submitAdmin(
        "cats",
        this.data.editingId,
        input,
        (id, payload) =>
          id
            ? adminApi.updateCat(id, payload as UpdateCat)
            : adminApi.createCat(payload),
      );
      this.setData({ pending: false });
      this.requestKeyValue = requestKey();
      this.setData({
        editingId: saved.id,
        editingVersion: saved.version,
        form: {
          ...form,
          name: saved.name,
          aliases: saved.aliases.join("，"),
          appearance: saved.appearance || "",
          personality: saved.personality || "",
        },
        photos: saved.photoRefs.map((ref) => ({
          path: mediaUrl(ref),
          imageRef: ref,
        })),
        busy: false,
        message: "已保存，当前版本 " + saved.version,
      });
      await this.load();
    } catch (e) {
      const pending = !!pendingAdmin("cats");
      this.setData({ pending });
      if (!pending) this.requestKeyValue = requestKey();
      const conflict =
        e instanceof RequestError && e.code === "VERSION_CONFLICT";
      this.setData({
        busy: false,
        conflict,
        message: conflict
          ? "该档案已被其他人修改，请载入最新版本后重试"
          : pending
            ? pendingMessage
            : errorMessage(e),
      });
    }
  },
  back() {
    back("admin");
  },
});
