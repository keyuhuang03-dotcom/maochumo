# 猫出没

原生微信小程序 + TypeScript / Fastify / MySQL 的四人协作 Demo 工程。当前版本是开发基础，不是完整业务成品。

已实现：首页与详情真实数据查询、示意地图区域查询、统一请求与错误、服务端会话校验、开发登录边界、点赞目标状态接口、作者删除接口。19 个页面和五个底部入口已注册；A/B/C 业务页面是明确标识的占位。

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
npm run dev
```

`setup` 只在 .env 不存在时生成随机本地密码，不打印密钥。没有 Docker 时，手动建 `maochumo_demo` 空库及专用账号，修改 .env 的 DB\_\* 后从迁移继续。不要将已有业务库当演示库。

在微信开发者工具导入本仓库根目录，工程指向 `dist/miniprogram`。默认 `touristappid` 仅为导入占位；真实 AppID 放在本机 `project.private.config.json`。修改源码后运行 `npm run build:mini`。本地 HTTP 联调需要在开发者工具的本地设置允许本地请求域名；正式环境必须接入 HTTPS 合法域名。无开发者工具时可运行页面逻辑链路测试，但不能代替平台编译或真机验证。

```sh
npm run check       # 类型、构建、真实 MySQL 集成测试；先迁移、种子
npm run test:page   # 另开终端，服务端运行时验证实际页面 JS → HTTP → MySQL
npm start          # 运行已构建服务端，与 dev 二选一
```

## 协作入口

- [开发与调试](docs/DEVELOPMENT.md)、[架构](docs/ARCHITECTURE.md)
- [四人边界](docs/OWNERSHIP.md)、[A/B/C 可领取任务与七天里程碑](docs/TASKS.md)
- [决策及待确认项](docs/DECISIONS.md)、[接口契约](contracts/README.md)
- [演示种子](docs/SEEDS.md)、[实际验证记录](docs/VALIDATION.md)

真实微信登录及图片存储尚未接入，分别返回 503。其它预留业务接口返回 501；不能把契约中的未来成功样例当作已实现结果。

main 保持可运行。成员创建 feat/catalog、feat/account、feat/admin 等功能分支，小批量 PR，D2 首版合并、D5 全量合并、D6—D7 测试演示。尚未邀请协作者，待提供三位成员 GitHub 用户名。
