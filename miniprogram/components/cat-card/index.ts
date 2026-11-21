Component({
  properties: {
    cat: { type: Object, value: {} as { id: string } },
    card: { type: Boolean, value: false },
    caption: { type: String, value: "" },
  },
  methods: {
    open() {
      this.triggerEvent("open", { catId: this.data.cat.id });
    },
  },
});
