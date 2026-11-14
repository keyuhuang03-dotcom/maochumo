export const routes = {
  home: "/features/community/home/index",
  map: "/features/campus-map/index/index",
  publish: "/features/community/publish/index",
  catalog: "/features/catalog/list/index",
  account: "/features/account/index/index",
  post: "/features/community/detail/index",
  cat: "/features/catalog/detail/index",
  search: "/features/community/search/index",
  hot: "/features/community/hot/index",
  tags: "/features/community/tags/index",
  success: "/features/community/success/index",
  settings: "/features/account/settings/index",
  posts: "/features/account/posts/index",
  likes: "/features/account/likes/index",
  messages: "/features/account/messages/index",
  login: "/features/account/login/index",
  admin: "/features/admin/index/index",
  adminCats: "/features/admin/cats/index",
  adminAreas: "/features/admin/areas/index",
  adminTopics: "/features/admin/topics/index",
  adminPosts: "/features/admin/posts/index",
};
export type RouteName = keyof typeof routes;
const tabs: RouteName[] = ["home", "map", "publish", "catalog", "account"];
export function go(name: RouteName, params: Record<string, string> = {}) {
  const url = routes[name];
  if (tabs.indexOf(name) >= 0) {
    wx.switchTab({ url });
    return;
  }
  const query = Object.keys(params)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
    .join("&");
  wx.navigateTo({ url: url + (query ? "?" + query : "") });
}
export function back(fallback: RouteName = "home") {
  if (getCurrentPages().length > 1) wx.navigateBack();
  else go(fallback);
}
export function resume(name: string | undefined) {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    wx.navigateBack();
    return;
  }
  const key = name as RouteName;
  if (
    key &&
    Object.prototype.hasOwnProperty.call(routes, key) &&
    key !== "post" &&
    key !== "cat"
  )
    go(key);
  else go("account");
}
