Component({
  properties: { post: { type: Object, value: {} as { id: string } } },
  methods: {
    open() {
      this.triggerEvent("open", { postId: this.data.post.id });
    },
  },
});
