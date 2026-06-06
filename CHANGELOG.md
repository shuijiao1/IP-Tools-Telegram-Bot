# Changelog

## [0.1.7] - 2026-06-06

- 新增 `/ip` 文本查询命令，支持直接查询 IP/域名的地理位置、ISP、组织、AS、时区和代理/数据中心标记。
- 回复包含 IP/域名的消息后发送 `/ip` 可自动提取目标。
- IP/BGP 图片选择菜单新增“IP 信息”按钮。

## [0.1.6] - 2026-06-06

- 补齐上次发布后的版本号，确保本地源码、GitHub Release 和 Docker 镜像版本一致。

## [0.1.5] - 2026-05-20

- 补充 SECURITY 安全说明和 Issue 模板，并完善 Release 附件。

## [0.1.4] - 2026-05-20

- 加入基础 CI、防泄密检查、Actions Node24 兼容设置和本地项目健康检查。

## [0.1.3] - 2026-05-20

- 补齐中英双语 README、统一部署说明，并加入本地 release helper。

All notable changes to this project are documented here.

## [0.1.2] - 2026-05-19

- 修复 Release workflow YAML，确保 tag 发布会自动用 CHANGELOG 生成 Release notes。

## [0.1.1] - 2026-05-19

- 维护版本发布流程：新增 CHANGELOG 与 Release Drafter；Docker 发布保留 latest、版本号和 sha 标签。
