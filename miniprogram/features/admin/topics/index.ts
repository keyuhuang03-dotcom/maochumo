import type {
  CreateTopic,
  Ref,
  Topic,
  UpdateTopic,
} from "../../../../contracts/index";
import { errorMessage, RequestError } from "../../../core/request";
import { requestKey } from "../../../core/submission";
import { back } from "../../../core/routes";
import { isAdmin } from "../access";
import { adminApi } from "../api";

type TopicRow = Topic;
type Status = "active" | "inactive";
const statuses: Status[] = ["active", "inactive"];
const statusNames = ["启用", "停用"];
const emptyForm = () => ({ name: "", status: "active" as Status });

Page({
  data: {
    title: "话题维护",
    admin: false,
    ready: false,
    topics: [] as TopicRow[],
    form: emptyForm(),
    statusNames,
    statusIndex: 0,
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
      statusIndex: 0,
      message: "",
      conflict: false,
    });
  },
  async load() {
    try {
      const result = await adminApi.topics();
      this.setData({ ready: true, topics: result.items });
    } catch (e) {
      this.setData({ ready: true, message: errorMessage(e) });
    }
  },
  fieldInput(e: WechatMiniprogram.Input) {
    this.setData({ form: { ...this.data.form, name: e.detail.value } });
  },
  statusChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value);
    this.setData({
      statusIndex: index,
      form: { ...this.data.form, status: statuses[index] || "active" },
    });
  },
  edit(e: WechatMiniprogram.TouchEvent) {
    const topic = this.data.topics.find(
      (t) => t.id === e.currentTarget.dataset.id,
    );
    if (!topic) return;
    this.requestKeyValue = requestKey();
    this.setData({
      editingId: topic.id,
      editingVersion: topic.version,
      form: { name: topic.name, status: topic.status },
      statusIndex: statuses.indexOf(topic.status),
      message: "",
      conflict: false,
    });
  },
  async refreshCurrent() {
    try {
      const result = await adminApi.topics();
      const topic = result.items.find((t) => t.id === this.data.editingId);
      this.setData({ topics: result.items });
      if (!topic) {
        this.setData({
          message: "该话题当前不可见（可能已停用），请改为新增或联系负责人",
          conflict: false,
        });
        return;
      }
      this.setData({
        editingVersion: topic.version,
        form: { name: topic.name, status: topic.status },
        statusIndex: statuses.indexOf(topic.status),
        message: "已载入最新版本 " + topic.version,
        conflict: false,
      });
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    }
  },
  async submit() {
    if (this.data.busy) return;
    const name = this.data.form.name.trim();
    if (!name) return this.setData({ message: "请填写话题名称" });
    if (!this.requestKeyValue) this.requestKeyValue = requestKey();
    this.setData({ busy: true, message: "", conflict: false });
    try {
      const base: CreateTopic = {
        name,
        status: this.data.form.status,
        requestKey: this.requestKeyValue,
      };
      let saved: Topic;
      if (this.data.editingId) {
        const payload: UpdateTopic = {
          ...base,
          version: this.data.editingVersion,
        };
        saved = await adminApi.updateTopic(this.data.editingId, payload);
      } else {
        saved = await adminApi.createTopic(base);
      }
      this.requestKeyValue = requestKey();
      this.setData({
        editingId: saved.id,
        editingVersion: saved.version,
        form: { name: saved.name, status: saved.status },
        statusIndex: statuses.indexOf(saved.status),
        busy: false,
        message:
          saved.status === "inactive"
            ? "已保存。公开列表不再显示，可在此重新启用。"
            : "已保存，当前版本 " + saved.version,
      });
      await this.load();
    } catch (e) {
      const conflict =
        e instanceof RequestError && e.code === "VERSION_CONFLICT";
      this.setData({
        busy: false,
        conflict,
        message: conflict
          ? "该话题已被其他人修改，请载入最新版本后重试"
          : errorMessage(e),
      });
    }
  },
  back() {
    back("admin");
  },
});
