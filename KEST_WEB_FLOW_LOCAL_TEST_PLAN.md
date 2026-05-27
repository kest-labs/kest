# Kest Web Flow 本地测试计划

可以按这条路径测，先不要一上来测 CI，先把 Web + CLI 跑通。

## 1. 启动本地服务

后端：

```bash
cd /Users/mingde/item/K/kest2/api
make dev
```

前端：

```bash
cd /Users/mingde/item/K/kest2/web
pnpm dev
```

打开：

```text
http://localhost:3000/workspace
```

## 2. Web 上传 .flow.md

进入某个 workspace 的「流程」页面：

```text
/workspace/<workspaceId>/flows
```

点「导入 .flow.md」，上传：

```text
/Users/mingde/item/K/kest2/.kest/flow/local-smoke.flow.md
```

验收点：

- 弹窗只有文件上传，没有手动 content 输入框
- 上传后列表出现 flow
- flow detail 里能看到 parse status
- 如果 flow 解析成功，应该能看到可视化 graph
- enabled 状态默认可用于自动运行

## 3. 创建 CLI Key

在 Web 里进入 workspace 的「密钥」页面，生成带这些 scope 的 CLI key：

```text
flow:run
flow:write
collection:read
collection:run
```

复制 Web 给你的 `kest key ...` 命令。

在 CLI 目录执行：

```bash
cd /Users/mingde/item/K/kest2/cli
go run . key 'kest_key_xxx'
```

确认配置：

```bash
go run . config list
```

要看到：

```text
platform_url
platform_token
platform_workspace_id
```

## 4. 测试机本地跑 Web flow 并同步

从 CLI 拉 Web 上已启用的 flow 来跑：

```bash
cd /Users/mingde/item/K/kest2/cli
go run . run --workspace-flow all --runner-type test_machine --sync --base-url http://localhost:8025
```

验收点：

- CLI 会拉取 Web 上的 enabled flows
- CLI 执行 flow
- Web 的 flow run history 出现一条 `test_machine`
- run detail 里能看到 step result、错误信息、kest log

如果你只想跑某一个 flow，可以用 flow 名称、source path 或 flow id：

```bash
go run . run --workspace-flow local-smoke --runner-type test_machine --sync --base-url http://localhost:8025
```

## 5. 模拟服务器 CI

先测 webhook 是否可用。用 workspace CLI token 调：

```bash
curl -X POST "http://localhost:8025/api/v1/workspaces/<workspaceId>/cli/ci/webhook" \
  -H "Authorization: Bearer <CLI_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "local-ci-test-1",
    "provider": "local",
    "ref": "refs/heads/codex/kest-web-flow-source-of-truth",
    "commit_sha": "local",
    "profile": "ci",
    "base_url": "http://localhost:8025"
  }'
```

然后模拟 CI runner 执行：

```bash
cd /Users/mingde/item/K/kest2/cli
go run . run --workspace-flow all --runner-type server_ci --profile ci --base-url http://localhost:8025 --sync
```

验收点：

- Web run history 出现 `server_ci`
- 可以按 runner 类型筛选
- `test_machine` 和 `server_ci` 两类结果都存在 Web 表里
- 每条 run 可以看到 step logs 和 kest logs

## 6. 最终通过标准

这几项都满足，就说明这套 Source of Truth 主流程可用：

- `.flow.md` 只在 Web 上传/管理
- Web 能保存原文并生成 graph
- CLI 能从 Web 拉 enabled flows
- 本地测试机结果同步到 Web
- server CI 结果同步到 Web
- Web 中 workspace 成员能看到 flow、history、logs

当前最建议你先测第 2 到第 4 步。只要 Web 上传 + CLI `test_machine` 同步跑通，核心链路就通了。
