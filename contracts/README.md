# v1 接口与响应契约

共享 DTO 在 index.ts；完整逐接口清单、状态、成功/空数据/错误样例在 endpoints.json。状态 implemented 表示本阶段真实实现，reserved 表示返回 501，blocked 表示外部能力未接入返回 503。开发登录默认禁用返回 404。未来成功样例显式标记 contract-only-not-implemented，不代表可调用成功。

## 通用约定

- 路径 /api/v1；JSON UTF-8；字符串 ID；时间 UTC ISO 8601，数据库时区 Z。
- 成功 `{ok:true,data:T,requestId:string}`；错误 `{ok:false,error:{code,message},requestId}`，HTTP 状态不是一律200。
- 列表 page/pageSize，默认1/20，上限50；`{items:[],page:1,pageSize:20,hasMore:false}` 是真实空成功。详情不存在404；写入空/无效400，不制造“空成功”。
- 401 UNAUTHORIZED；403 FORBIDDEN；404 NOT_FOUND；409 POLICY_PENDING/CONFLICT；400 VALIDATION_ERROR；501 NOT_IMPLEMENTED；503 WECHAT_NOT_CONFIGURED / UPLOAD_NOT_CONFIGURED / SERVICE_UNAVAILABLE。
- 私有接口 `Authorization: Bearer <opaque-token>`；token 仅本地登录态，角色和用户范围从数据库确认。不在URL中放凭证。
- q 支持 MySQL LIKE 通配字符；当前未提供字面通配符搜索开关。默认分页不是快照，并发新增时用户可刷新。
- 上传返回的是经过验证的资源 ID；URL 由可信服务生成，不能把用户任意 URL 直接当合法图片。

## 写入与重试

发布 CreatePost、评论 CreateComment、管理 Create/Update/Hide 使用 requestKey（最长80字符）。按钮处理中禁用，但服务端仍须防重。相同用户/业务范围/key + 相同 payload 返回原结果；异 payload 返回409；数据库唯一约束兜底。idempotency_keys 与 common/idempotency.ts 的 once 已供发布和评论使用，C 管理写入已复用同一实现。

点赞 PUT liked=true/false 已实现；删除重复本人 deleted 已实现。消息 read/read-all 已实现，采用接收者条件 + read_at=COALESCE(read_at,当前时间)，未读由数据库计算。

## 页面路由

所有小程序路径与跳转见 core/routes.ts。五入口用 switchTab，不通过 tab URL 传 query；子页用 navigateTo。档案 catId、帖子 postId、消息定位 commentId；管理编辑 id；筛选 areaId/q/topicId；登录 returnTo 为受控路由名。返回优先 navigateBack，无栈回所属 tab。

2026-11-15 B/C 业务已接入真库；详见 docs/INTEGRATION-ABC.md。所有契约变更同步 DTO、样例和消费者 PR。

## 2026-11-11 负责人接口更新

POST /posts、GET /posts/hot、GET/POST /posts/:postId/comments 已实现。评论GET支持focusId，返回包含目标的实际page；不存在或不属于当前公开帖则404。评论回复通知帖主+被回复作者，去重并排除自己。

POST /uploads 使用 multipart 字段 file 和 query purpose，不再接收旧的 JSON UploadIntent 占位请求。客户端调用 uploadImage；结果仍为 UploadResult。GET /media/:id 返回图片二进制，不是 JSON envelope；404等错误仍为 JSON。Post.images 为可展示URL，CreatePost.imageRefs为资源ID，不混用。

微信接口实现了服务端交换，但缺少账号时仍503；success契约不等于平台实测。B/C接口状态已更新，不再用501占位。

## 2026-11-15 集成更新

PUT /me 接收 `{nickname:string,avatarRef:string|null}`（昵称 trim 后非空，技术上限80），返回 User；简介未入契约。GET /me/posts 与 /me/likes 返回 PageResult<Post>，排除隐藏/删除。GET /me/notifications 返回 PageResult<Notification>；targetAvailable=false 不泄露原正文。未读数返回 `{count:number}`。单条已读返回 `{id:ID,readAt:string}`，全部已读返回数据库实时统计的 `{unreadCount:number}`，重复调用不改变首次 read_at。POST /auth/logout 返回 `{loggedOut:true}` 并撤销当前会话。GET /admin/topics 返回 `{items:Topic[]}`，含启用/停用，仅管理员可读。私有资源始终从服务端会话定位，不接受 userId 选他人资料。
