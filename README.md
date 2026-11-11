# 猫出没

原生微信小程序 + TypeScript / Fastify / MySQL 的四人协作 Demo 工程。负责人负责的帖子、地图及公共能力已完成本地 Demo 实现；A/B/C 模块仍待成员交付，尚非完整成品。

已实现：首页与详情、搜索热帖、图文发布、多猫/话题可选关联、点赞、评论回复、通知生成、本人删除，以及演示地图选区/猫列表分页。发布与评论支持超时重试防重，失败保留草稿；图片使用真实本地上传。19 页、五入口保留，A/B/C 页面仍为明确占位。

## 快速启动

推荐 Node.js 24.22.2 LTS、npm 11、MySQL 8.4。依赖版本由 package.json 与 package-lock.json 锁定。Docker 可选；已有 MySQL 也可使用。

```sh
npm ci
npm run setup
# 有 Docker Desktop 的成员：先启动 Docker Desktop
npm run db:up
npm run db:migrate
npm run db:seed
npm run build
npm run start:demo  # 本机开发身份 + 本地真实图片存储
```

`setup` 只在 .env 不存在时生成随机本地密码，不打印密钥。没有 Docker 时，手动建 `maochumo_demo` 空库及专用账号，修改 .env 的 DB\_\* 后从迁移继续。不要将已有业务库当演示库。

在微信开发者工具导入本仓库根目录，工程指向 `dist/miniprogram`。默认 `touristappid` 仅为导入占位；真实 AppID 放在本机 `project.private.config.json`。修改源码后运行 `npm run build:mini`。本地 HTTP 联调需要在开发者工具的本地设置允许本地请求域名；正式环境必须接入 HTTPS 合法域名。无开发者工具时可运行页面逻辑链路测试，但不能代替平台编译或真机验证。

```sh
npm run check       # 类型、构建、真实 MySQL 集成测试；先迁移、种子
npm run test:page   # 另开终端，服务端运行时验证实际页面 JS → HTTP → MySQL
npm run test:owner-pages # start:demo 运行时验证发布/评论丢响应重试等
npm run dev        # 普通开发模式，按 .env 配置；与 start:demo 二选一
npm run debug:server # 本机 9229 调试端口，与其它服务启动命令二选一
```

## 协作入口

- [开发与调试](docs/DEVELOPMENT.md)、[架构](docs/ARCHITECTURE.md)
- [四人边界](docs/OWNERSHIP.md)、[A/B/C 可领取任务与七天里程碑](docs/TASKS.md)
- [决策及待确认项](docs/DECISIONS.md)、[接口契约](contracts/README.md)
- [演示种子](docs/SEEDS.md)、[实际验证记录](docs/VALIDATION.md)

微信登录适配器已实现，缺少 AppID/AppSecret 时仍返回 503；平台真实登录尚未验收。start:demo 只启用本机开发身份和本地图片存储，不开通云资源。B 的个人/消息接口、C 的管理写接口仍返回 501。图片不会随 Git 提交；正式存储和 HTTPS 域名待配置。

仓库为公开仓库，成员可直接查看/克隆；直接推送仍需协作者权限。操作步骤见 [负责人演示与交接](docs/OWNER-DEMO.md)。

main 保持可运行。成员创建 feat/catalog、feat/account、feat/admin 等功能分支，小批量 PR，D2 首版合并、D5 全量合并、D6—D7 测试演示。尚未邀请协作者，待提供三位成员 GitHub 用户名。
