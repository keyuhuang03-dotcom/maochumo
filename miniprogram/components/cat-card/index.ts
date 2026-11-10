Component({
  properties: { cat: { type: Object, value: {} as { id: string } } },
  methods: {
    open() {
      this.triggerEvent("open", { catId: this.data.cat.id });
    },
  },
});
