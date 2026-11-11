# 四人协作边界

| 负责人     | 小程序目录                              | 服务端目录                                     | 本期交付                                    |
| ---------- | --------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| 项目负责人 | core、components、community、campus-map | common、identity、uploads、posts、interactions | 框架、帖子、地图、通知生成、集成            |
| A          | features/catalog                        | modules/catalog                                | 图鉴、名字别名/区域筛选、档案、公开关联帖子 |
| B          | features/account                        | modules/account；identity 的资料接口需协调     | 个人资料、本人发布点赞、消息/已读           |
| C          | features/admin                          | modules/admin                                  | 猫咪区域话题维护、隐藏、管理记录            |

所有路径以 miniprogram 或 server/src 为根。A/B/C 是成员代号，真实姓名、GitHub 用户名及后端承担能力待 D1 确认。如果只承担前端，D1 在任务卡注明，由负责人承接对应服务端；D2 前保证最小接口，不能默认三人都有后端能力。

公共文件：package.json/lock、app.json、project.config.json、contracts、core、components、common、migrations、seeds、CI 由负责人协调。需要改动时先说明影响，在独立 PR 中修改，不各自复制公共请求或修改同一迁移。

main 可运行；每人从 main 创建功能分支，先提交能运行的最小切片。D2 开始合并；D3/D4 每天集成；D5 全功能合并，D6/D7 只修复和演示准备。PR 写明接口变更、实际测试、截图与遗留问题。负责人审阅后普通合并，不强推 main。

没有配置 CODEOWNERS：缺少成员真实 GitHub 账号，不制造无效指派。仓库已公开，尚未邀请具有写权限的成员，也未假定分支保护已经启用；由仓库管理员在成员确认后配置。
