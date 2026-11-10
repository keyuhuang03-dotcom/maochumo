# 演示种子数据

只允许 NODE_ENV=development 且 DB_NAME 以 \_demo 结尾。执行 `npm run db:seed` 可重复；使用事务和保留原值的 upsert，不清库、不覆盖成员编辑，不重置发布时间。

| ID                                   | 用途                                      |
| ------------------------------------ | ----------------------------------------- |
| demo-member / demo-admin             | 开发成员/管理员；无真实微信身份           |
| demo-area-library / demo-area-garden | 示意区域，非真实学校                      |
| demo-area-empty                      | 无猫区域，用于空状态                      |
| demo-cat-1 / demo-cat-2              | 两只同名“橘子”，不同稳定 ID、不同主要区域 |
| demo-topic                           | 校园日常演示话题                          |
| demo-post-public                     | 首页真实 MySQL 样例，关联两只猫与话题     |
| demo-post-hidden / demo-post-deleted | 公开过滤测试，不应出现在页面              |

种子没有真实照片或个人数据，不包含历史文档/设计素材；不声明真实校园点位。没有预置通知，因为接收细则尚未确认。集成测试使用 test-UUID 记录并清理；测试异常退出后由负责人核对再清理，不用全库 DELETE。

重复种子不会复活被删除的 demo-post-public；测试不修改此记录。需要重置演示状态时由负责人使用单独一次性脚本明确处理，避免种子意外覆盖开发成果。随着日期推移种子可能超过七天，不伪造热榜发布时间；正式演示时专门创建新演示帖。
