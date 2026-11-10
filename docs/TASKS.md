# 首批任务卡与七天里程碑

状态：均可领取；姓名、前后端能力和日程在 D1 填写。每卡按“页面首版 / 接口联调 / 验收”分别更新，不把占位当完成。

## A 图鉴与档案

- 分支：feat/catalog；目录：miniprogram/features/catalog、server/src/modules/catalog。
- 页面：list/index、detail/index；档案参数 catId（必需）；list 可在本页使用 areaId/q 筛选。地图通过 go('cat',{catId}) 到档案；返回优先原页面栈，直接进入时回图鉴。
- 接口：GET /cats?page&pageSize&q&areaId、GET /cats/:catId、GET /areas 已实现基础查询；GET /posts?catId 已实现公开关联查询。契约 contracts/index.ts 的 Cat、Area、Post、PageResult。
- 依赖：core/request、core/routes、CatCard、PostCard、view-state；不得按名字合并猫。没有照片时显示资料占位，不随意找真实猫图。
- 交付：D2 列表→档案首版 PR；D3 搜索筛选→关联帖；D4 异常和返回；D5 验收。资料改名后 ID 仍稳定；无数据和网络失败区分。
- 验收：种子两只“橘子”均可独立进入档案；搜“小橘”及组合区域；选择 demo-area-empty 显示空；清筛选恢复；地图进入后返回地图；关联帖跳详情，隐藏删除不出现；停止服务时显示重试。记录 AT-11—14、20、27 的已执行部分。
- 待填：负责人姓名、后端承担人、首版 PR、联调结果、截图、遗留。

## B 个人中心与消息

- 分支：feat/account；目录：miniprogram/features/account、server/src/modules/account。本人资料接口在 identity/routes.ts，修改前与负责人同步。
- 页面：index/settings/posts/likes/messages；消息跳 go('post',{postId,commentId})；登录 returnTo 只能是 core/routes 的路由名，不接任意外部 URL。
- 接口：GET /me 已实现；PUT /me、GET /me/posts、GET /me/likes、GET /me/notifications、GET /me/notifications/unread-count、PUT /me/notifications/:notificationId/read、PUT /me/notifications/read-all 均 501。删除复用 DELETE /posts/:postId（已实现）；上传等待公共适配。
- 依赖：P1 登录、request/session、PostCard；通知由负责人 P3 生成。先用单独测试夹具联调，不能在 UI 里伪造真实通知。表/类型已提供，readAll 只更新本人现有未读记录。
- 交付：D2 我的→消息骨架与真实空列表；D3 本人发布点赞、资料；D4 真实通知与已读；D5 验收。禁止通过 query.userId 选他人数据；不要客户端自减未读数。
- 验收：游客 401；替换通知 ID 不能改他人；进列表不全已读，重复单条/全部已读保持一致；删除后个人点赞不暴露旧正文；通知目标隐藏/删除仍可已读但提示内容不可用；失败保留资料输入。记录 AT-10、15、16、23、25；真实微信 AT-15 需账号实测，开发登录不能代替。
- 待填：姓名、后端承担人、通知细则确认、PR、截图与未实现项。

## C 管理员资料与隐藏

- 分支：feat/admin；目录：miniprogram/features/admin、server/src/modules/admin。
- 页面：index/cats/areas/topics/posts；编辑参数统一 id；隐藏使用 postId。返回优先栈，无栈回“我的”。
- 接口：POST /admin/cats|areas|topics、PUT /admin/cats|areas|topics/:id、PUT /admin/posts/:postId/hide；全部在角色校验后 501。读取复用公共 cats/areas/topics/posts，暂不新增未确认的恢复或删除资料接口。
- 依赖：common/admin、transaction、idempotency_keys、admin_logs、各实体 version；上传未就绪时不得提交虚假 photoRef。所有写入与日志同事务；隐藏锁帖子，重复键不重复日志，不同 payload 同 key 返回 409。
- 交付：D2 猫咪维护最小可运行首版；D3 区域话题维护；D4 隐藏与记录/异常；D5 验收。猫名允许重名，主要区域必选，改名不改 ID；更新版本冲突不能静默覆盖。
- 验收：普通用户篡改客户端 role 仍 403；无效区域拒绝；两只同名猫改名不丢关联；版本冲突 409；隐藏后首页/详情/搜索/档案均不可见；重复隐藏只一条必要记录；写失败回滚。记录 AT-12、17、19、24、26、28。
- 待填：姓名、后端承担人、管理员人选/隐藏标准、PR、截图与遗留。

## 七天里程碑

| 日  | 集成目标                                               |
| --- | ------------------------------------------------------ |
| D1  | 四人启动、账号/能力/日期确认、领取任务；框架与真库样例 |
| D2  | 帖子详情与地图区域；A/B/C 首版各一 PR，开始合并        |
| D3  | 发布上传多猫关联删除、图鉴关联帖、个人内容、资料维护   |
| D4  | 点赞评论通知、热帖搜索、已读、隐藏；每日集成           |
| D5  | 全部功能合并 main，冻结新增范围                        |
| D6  | 越权、幂等、失败重试、跨模块、开发者工具及真机验证     |
| D7  | 修复、核对素材、固定演示数据、完整演练两遍             |

D1 为正式开工日，不擅自把当前日期当成已确认演示排期。若后端集中在负责人，D1 调整工作量，D3 检查核心流程。

## 项目负责人下一步顺序

1. 固定帖子查询字段与分页，补齐搜索/热帖页面及服务端热榜；与 A 联调关联帖。
2. 确认微信账号和存储，做真实登录/上传；实现发帖事务、图片归属、多猫话题关联、requestKey 重试，再接发布页面和本人删除界面。
3. 基于现有点赞接口接 UI；确认通知细则后做评论/回复/通知同事务，与 B 联调。
4. 校对最终底图及区域范围，替换示意图，补地图分页/选区与档案返回。
5. 与 C 联调隐藏，覆盖所有公开入口过滤；D5 合并，D6/D7 走 AT-01—30。
