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

发布 CreatePost、评论 CreateComment、管理 Create/Update/Hide 使用 requestKey（最长80字符）。按钮处理中禁用，但服务端仍须防重。相同用户/业务范围/key + 相同 payload 返回原结果；异 payload 返回409；数据库唯一约束兜底。idempotency_keys 表已建，执行器尚待业务阶段完成。

点赞 PUT liked=true/false 已实现；删除重复本人 deleted 已实现。消息 read/read-all 已预留，必须接收者条件 + read_at=COALESCE(read_at,当前时间)，未读由数据库计算。

## 页面路由

所有小程序路径与跳转见 core/routes.ts。五入口用 switchTab，不通过 tab URL 传 query；子页用 navigateTo。档案 catId、帖子 postId、消息定位 commentId；管理编辑 id；筛选 areaId/q/topicId；登录 returnTo 为受控路由名。返回优先 navigateBack，无栈回所属 tab。

当前 B/C 业务逻辑未完成：底层有 session 校验不代表个人列表和已读已实现，表中有 admin_logs 不代表隐藏已实现。所有契约变更同步 DTO、样例和消费者 PR。
