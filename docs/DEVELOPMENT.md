# 开发与调试

## 环境与配置

团队推荐 Node.js 24.22.2 LTS、npm 11、MySQL 8.4。本机先用 Node 26.0.0 验证，随后安装工程隔离的 Node 24.22.2 并完整复测；npm 11.12.1 / MySQL 9.7.0，差异见验证记录；Docker 服务固定 mysql:8.4.7，尚未在本机运行 Docker。所有依赖使用精确版本，安装用 npm ci。

.env 仅本机使用，所有环境变量见 .env.example。setup 随机生成 DB_PASSWORD、MYSQL_ROOT_PASSWORD、DEV_LOGIN_KEY。日志不记录请求体、Authorization、数据库连接串或平台凭证。HOST 默认 127.0.0.1，PORT 默认 3000；若已有程序占用端口，改本项目 PORT 与小程序 apiBase，不停止他人程序。

已有 MySQL：新建 utf8mb4 的 maochumo_demo 库，为该库创建专用账号，填入 .env。不要使用生产库。Docker 模式的环境和密码与 .env 一致。首次创建数据卷后再修改 .env 不会自动修改库内密码，应通过数据库正常账号流程同步；db:down 保留卷。

本次机器使用 `.local/mysql-dev` 的独立 MySQL 实例，监听 127.0.0.1:3307，socket 在 `.local/mysql.sock`，未修改机器既有数据库。重启本次本地实例的命令（仅适用于这台安装了官方 MySQL 的 Mac）：

```sh
/usr/local/mysql/bin/mysqld --no-defaults --datadir="$PWD/.local/mysql-dev" --socket="$PWD/.local/mysql.sock" --port=3307 --bind-address=127.0.0.1 --mysqlx=OFF --pid-file="$PWD/.local/mysql.pid" --log-error="$PWD/.local/mysql.log"
```

该命令在前台运行；已有同一实例运行时不要重复启动。干净克隆请采用 Docker 或自行安装 MySQL，不复制本机数据目录。停止本次实例用该前台进程 Ctrl+C，或通过本项目 socket 执行 mysqladmin shutdown；不要停止系统其它 MySQL。

## 命令

| 命令                    | 作用                                              |
| ----------------------- | ------------------------------------------------- |
| npm ci                  | 按锁文件安装                                      |
| npm run setup           | 生成本地配置，不覆盖已有 .env                     |
| npm run db:up / db:down | 启停 Docker MySQL，down 不删除数据卷              |
| npm run db:migrate      | 校验已应用迁移 hash，再应用新增迁移               |
| npm run db:seed         | development + \*\_demo 库的非破坏种子             |
| npm run dev             | TS 服务热重载                                     |
| npm run build           | 服务端编译、小程序 TS 转 JS 与页面清单检查        |
| npm start               | 启动编译产物                                      |
| npm run typecheck       | 服务端/客户端严格类型检查                         |
| npm test                | 真库集成测试，临时测试记录会清理                  |
| npm run test:page       | 编译首页逻辑经 wx.request 传输适配器访问真实 HTTP |

## 小程序

导入根目录 project.config.json。源码在 miniprogram，产物在 dist/miniprogram，不直接编辑产物。根配置默认保持 URL 检查启用；本地测试时成员在自己的开发者工具设置允许本地 HTTP。不把这种本地设置用于发布。

需要覆盖客户端环境时，创建被忽略的 `miniprogram/core/env.local.ts`：

```ts
export const env = { apiBase: "http://127.0.0.1:3000", development: true };
```

重建后产物使用该配置。这里只允许公开客户端配置，绝不能放 AppSecret、数据库密码或开发密钥。真机不能访问电脑的 127.0.0.1；需确定可达的后端 HTTPS 地址及合法域名，然后关闭 development 并完成真实微信认证。

## 登录及上传

开发登录默认 false。仅本地需要时在 .env 设置 DEV_AUTH_ENABLED=true，保持 NODE_ENV=development 和 HOST=127.0.0.1；从本地 .env 读取开发密钥，在“我的→登录→开发身份登录”手动输入，不要提交或发到聊天。服务端只允许 member/admin 两个种子 profile，真实业务角色从库读，客户端不能任意提交 userId 或 role。开发登录只发 1 小时随机会话，库内只存 token SHA-256；生产启用开发登录直接拒绝启动。

小程序开发页面仅提供 member 登录。管理员联调可本地调用 /auth/dev 的 admin profile；密钥通过本地环境读取，不写在 shell 命令或日志里。此通道不代表真实微信登录通过。真实微信适配已由服务端交换 code、保存平台绑定、发放业务 token；失败不能回退开发身份。

本地上传已实现：`uploadImage(filePath, purpose)` → `POST /api/v1/uploads?purpose=post|avatar|cat`，multipart 字段固定 `file`。使用 `npm run start:demo` 显式启用本机开发身份与本地存储；或在 .env 设置 UPLOAD_DRIVER=local（仅development/回环地址允许）。默认 disabled 仍返回503。文件存于 UPLOAD_DIR（默认.local/uploads），不提交仓库。PUBLIC_API_BASE 是可信图片链接前缀，改 API 端口时须同步调整。

服务端解码并重编码图片，验证大小、像素及静态格式；去除原有元数据，拒绝伪造图片/任意路径。返回 imageRef 供提交，url 供公开展示。未关联图片只有上传者可鉴权读取；已关联图片按公开引用判断，隐藏/删除后不公开。云存储适配尚未提供，未引用清理策略待确认。

微信适配已实现 code→微信固定域名→openid→用户绑定→业务会话，不把 session_key/openid 发给客户端。缺少配置、平台错误均明确失败，不自动降级开发身份。真实平台仍未验收，测试中的注入身份只验证应用适配逻辑。

`npm run test:owner-pages` 需要先启动 start:demo 或 UPLOAD_DRIVER=local 的服务。它会创建和清理自己的测试用户/帖子/图片，不使用成员数据。测试保留不确定结果的原请求标识并模拟成功响应丢失；不会把平台传输适配当成真机渲染。

`npm run debug:server` 使用本机 9229 inspector，VS Code/Chrome 可附加调试；与其它启动命令二选一，避免占用同一端口。普通 `npm run dev` 仍按 .env 工作，不默认启用开发登录。

## 调试及错误

优先看响应 requestId、code、HTTP 状态。401 清理客户端会话，403 权限，404 目标不可用，409 业务冲突，501 业务未实现，503 依赖未就绪或数据库失败。网络写超时视为结果未知，不清输入，不生成新 requestKey 重试。

MySQL DDL 隐式提交，迁移不假装能整体回滚。失败后检查 schema_migrations 与实际表结构；不能删除历史迁移重来，不能修改已应用迁移；修复用新迁移并经负责人审核。测试数据库可重建，但不得删除成员业务库。
