# 本阶段实际验证

日期：2026-11-10。此记录验证工程基础，不表示 AT-01—AT-30 全部业务已完成。

## 环境

- 本机 macOS arm64；原有 Node 26.0.0 / npm 11.12.1。
- 后续下载项目隔离 Node 24.22.2 LTS（.local/runtime，不提交），在推荐 Node 版本重新执行安装与全部检查。
- 本机 MySQL Community 9.7.0，隔离目录 .local/mysql-dev，127.0.0.1:3307，专用 maochumo_demo 库和账号；未使用现有业务库。
- Docker CLI 存在但 daemon 未运行；MySQL 8.4.7 compose 与 GitHub CI 配置已提供，本机 Docker 流程未验收。
- 未发现微信开发者工具，未提供真实 AppID、AppSecret、存储或域名。

## 已执行

| 验证                        | 结果                                                          |
| --------------------------- | ------------------------------------------------------------- |
| npm install、随后 npm ci    | 成功，锁文件可重装；npm audit 0 vulnerabilities               |
| npm run typecheck           | 服务端与小程序严格 TS 检查通过                                |
| npm run build               | 服务端编译、小程序 JS 构建通过                                |
| 页面/组件产物清单           | 19 页、5 tab、PostCard/CatCard/view-state 文件齐全            |
| npm run db:migrate 连续两次 | 首次应用、再次识别 checksum 跳过                              |
| npm run db:seed 连续两次    | 事务种子成功，保留原记录，无重复同 ID                         |
| npm start                   | 构建产物服务启动于 127.0.0.1:3000                             |
| npm test                    | 9 组真实数据库集成测试全部通过                                |
| npm run test:page           | 编译首页 Page → 公共 request → HTTP → MySQL → setData，通过   |
| 页面空/失败                 | 通过真实空查询和400响应触发 empty/error 状态；隐藏详情404通过 |

9 组测试覆盖：数据库会话 UTC；公开成功/空/无效参数/隐藏删除过滤；重名猫稳定 ID/空区域/无效区域外键；身份角色与501/503边界；8次并发点赞唯一、取消、真实liked读取、非作者删除拒绝和重复删除；事务回滚/共享同帖回复检查；production 禁止开发登录；显式开发登录、角色篡改拒绝、会话过期；数据库不可用的脱敏503。

## 发现与处理

本机 MySQL 9.7 的同帖回复复合自引用外键在直接插入测试中没有按预期拒绝跨帖引用，尽管 SHOW CREATE TABLE 显示约束存在。未据此声称数据库约束充分；保留外键，并提供 interactions/guards.ts 的事务内显式查询校验，正常/跨帖/不存在目标都已测试。后续评论写入必须调用该校验，当前评论接口仍501，因此没有可绕过它的已开放评论写入。是否属于该 MySQL 版本行为仍待进一步确认，不能推广为所有版本结论。

曾尝试额外触发器，受二进制日志下建触发器权限限制；没有扩大数据库账号权限。该未应用的尝试未纳入迁移或交付，最终只保留已验证001迁移与应用层校验。

## 不能声称已通过

- 小程序 WXML/WXSS 的微信平台编译、模拟器画面与交互、真实设备检查。当前只检查 TypeScript/JS 和页面注册，Node 传输适配器没有模拟平台渲染。
- 真实微信登录、首次头像昵称授权、图片上传及对象存储访问。后端明确503，开发身份不等于微信认证。
- 正式域名/TLS/部署、容量性能、最终校园底图及真实照片资料。
- A/B/C 全模块、发布、热榜、评论通知、个人内容/已读、管理写入；接口状态以 contracts/endpoints.json 为准。

## 复现

按 README 启动库并迁移/种子，执行 `npm run check`。另开终端 `npm start`，再执行 `npm run test:page`。本机隔离 LTS 可临时用：

```sh
PATH="$PWD/.local/runtime/node_modules/node/bin:$PATH" npm run check
```

干净克隆使用 .nvmrc 指定版本，不依赖 .local。CI 验证结果以 GitHub Actions 实际运行状态为准，本记录不预先宣称远端通过。

地图页面逻辑也通过真实区域/猫咪 HTTP 查询及空区域状态检查。
