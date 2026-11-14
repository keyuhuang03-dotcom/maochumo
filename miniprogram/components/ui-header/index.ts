import { back } from "../../core/routes";
Component({
  properties: {
    title: { type: String, value: "" },
    back: { type: Boolean, value: false },
    background: { type: String, value: "#FFFEFA" },
  },
  data: { statusHeight: 20, navHeight: 44 },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo();
      const capsule = wx.getMenuButtonBoundingClientRect();
      this.setData({
        statusHeight: info.statusBarHeight,
        navHeight: Math.max(
          44,
          (capsule.top - info.statusBarHeight) * 2 + capsule.height,
        ),
      });
    },
  },
  methods: {
    returnBack() {
      back();
    },
  },
});
