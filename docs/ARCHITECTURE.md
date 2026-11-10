# 架构与数据

原生小程序 → core/request → 单个 Fastify HTTP 服务 → mysql2 参数化 SQL → 一个 MySQL 库。没有微服务、队列或缓存服务。

## P1—P5 与目录

| 逻辑模块        | 服务端位置                                | 职责与负责边界                                             |
| --------------- | ----------------------------------------- | ---------------------------------------------------------- |
| P1 身份识别     | server/src/modules/identity + common/auth | 登录、会话、本人资料；负责人维护基础，B 接资料             |
| P2 帖子发布浏览 | server/src/modules/posts                  | 公开列表/详情/搜索、发布、多猫话题关联、删除；负责人       |
| P3 互动消息     | modules/interactions + modules/account    | 负责人做点赞、评论回复与通知生成；B 做本人列表、消息和已读 |
| P4 地图档案     | modules/catalog                           | 公用区域/猫查询；负责人做地图，A 做图鉴档案及关联帖        |
| P5 资料内容管理 | modules/admin                             | C 做猫/区域/话题维护及隐藏，负责人审核事务及权限           |

uploads 是 P1/P2/P5 共用的存储边界，common 放数据库、权限、响应和公开可见性。模块是代码职责，不是独立部署。

## 模型

- users + sessions：真实平台绑定可空以支持明确开发身份；role 只在服务端配置，session 存哈希及过期时间。
- posts：published / hidden / deleted；author_id + request_key 唯一，body 允许纯图时空串。
- post_cats / post_topics：复合主键，关联可为零，不通过名字推断猫；猫名非唯一。
- cats：稳定字符串 ID，一条非空 area_id 外键；aliases/photo_refs 为 JSON 数组，version 用于未来并发修改。
- areas：归一化矩形范围 x/y/width/height，非 GPS；真实边界待核对。
- assets / post_images：上传归属与用途；图片顺序 0—8，业务还须验证总数与 ready。
- likes：user_id/post_id 联合主键；事务锁定帖子后设置目标状态，重复不累计。
- comments：同帖回复校验函数在 interactions/guards.ts，未来写接口必须在同一个事务里调用；author_id/request_key 唯一。
- notifications：recipient_id/comment_id 唯一；read_at 是可空时间；未来已读 UPDATE 必须带 recipient_id，COALESCE(read_at, UTC_TIMESTAMP(3))，不能用客户端传入接收者或自增减未读计数。
- admin_logs + idempotency_keys：未来管理变更与日志、幂等响应必须同事务。幂等键范围 actor + scope + key；同 key 不同 request_hash 返回 409，相同返回原结果。表已建，通用幂等业务执行器尚未实现。

## 一致性

公开查询统一 PUBLIC_POST，只返回 published；详情、搜索、关联猫过滤均复用。个人点赞、通知跳转未来也必须复用，不能返回隐藏正文。作者删除是行锁 + author 条件，重复 deleted 成功；hidden 作者删除仍返回 POLICY_PENDING。

点赞与删除共用帖子行锁，避免点赞成功时帖子已被并发删除。计数实时聚合，不维护易失真的冗余数字。后续管理员隐藏也必须锁同一行。已有授权头时列表会校验 session 并返回真实 liked 状态。

未来发布在同事务校验引用并保存主帖/图片/关联/幂等结果；未来评论在同事务检查公开状态、回复目标、保存评论及通知。通知规则未确认前接口保持 501。资料更新用 WHERE id=? AND version=?，不匹配返回 409。

## 安全与异常

SQL 值用占位参数，分页数字由 JSON Schema 限界后插入 SQL；写接口身份/角色在服务端验证。公开响应不返回 wechat_identity、session hash 或配置。未就绪接口返回 501/503，不返回固定成功。通用错误不泄露 SQL、凭证或堆栈。

## 当前边界

分页采用 page/pageSize + hasMore，稳定排序不等于并发新增时快照分页；Demo 接受重新刷新，未来如有需要再引入游标。本期查询为小规模演示，Post hydration 有逐帖关联查询，未作性能承诺。正式部署前补充速率限制、监控、TLS、存储授权及安全复核。
