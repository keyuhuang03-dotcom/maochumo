Component({
  properties: {
    state: { type: String, value: "idle" },
    message: { type: String, value: "" },
  },
  methods: {
    retry() {
      this.triggerEvent("retry");
    },
  },
});
