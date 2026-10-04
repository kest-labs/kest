# Kest Flow 测试方法论研究报告

> 目的：回答三个问题。(1) 现在的用法对不对？(2) 这套"长的、有序的、带 captures 的 Markdown flow"是否已经优雅？(3) 有没有更好的做法？
> 方法：Part A 对产品负责人本机的 `.flow.md` 做只读统计和抽样阅读（报告不含任何文件内容、主机名、凭据）；Part B 查阅业界工具官方文档；Part C 给结论。
> 约定：**[事实]** 来自统计、源码或官方文档；**[推断]** 是我的判断；**[未验证]** 是没能确认的点。

## 0. 结论先行

1. 对"一个会话内有因果顺序的业务链路"（注册→登录→创建→查询→删除），ordered step + captures 是**正确且自然**的模型，Hurl、Step CI、Tavern 都是同一模型。问题不在模型，在于**把它用到了所有场景**。
2. 现有用法的最大病灶不是"文件太长"，而是 **零复用 + 零生命周期**：登录步骤复制了 371 次；`setup`/`teardown` 块使用 0 次；`[Poll]`/`[Wait]` 使用 0 次；`@tags` 写了 207 次但 CLI 没有按标签选择。
3. 好的一面也很实在：138 个文件（32%）用 `run_id` 造唯一数据，580 个步骤（14%）断言 4xx/5xx 负向用例，72% 的 HTTP 步骤有 body 断言。这些做法要保住。
4. "更好的做法"不是换模型，而是**分层**：小而独立的契约/授权用例（可并行）+ 少量精选的有状态场景（顺序）+ 由 OpenAPI 自动派生的 schema 一致性和覆盖率检查。
5. 对 Kest "给 AI 编码代理用的 API 验证层"的定位，最该做的不是更丰富的 DSL，而是：**OpenAPI schema 断言、API 覆盖率报告、按改动选择并给出根因归并的结构化结果**。

---

## Part A：产品负责人真实用法评估

### A.1 样本与基本盘 [事实]

- 共 3528 个 `.flow.md`，按内容 md5 去重后 **431 个**（重复 8.2 倍；大量来自部署目录下的 worktree 快照）。去重后文件名也只有 385 个。
- 格式：311 个文件用新的 `step` 块，116 个（27%）仍是旧的 `kest`/`http` 块（共 1422 个旧块）。
- 步骤：4108 个 step（3911 HTTP + 197 exec）。**每文件步骤数中位数 9，P90 为 27，最大 129**；≥10 步的文件 148 个（34%），≥30 步的只有 26 个（6%）。
- 行数：中位数 189，P90 534，最大 2216。

> 修正一个印象：典型文件并不是"巨型流"，中位数文件只有 9 步。巨型流是少数（约 6%），但它们承载的是最重的集成场景，也是最难维护的部分。

### A.2 这些测试是什么类型 [推断，基于约 25 个抽样文件 + 统计]

| 目录/类型 | 观察到的形态 | 归类 |
|---|---|---|
| sandbox 系列（20+ 个，平均 50~430 行） | 一个文件聚焦一个行为（超时、配额、限速、出口策略），断言业务码和 `exit_code`，创建的沙箱设置 TTL，末尾删除 | **行为/契约测试**，最接近理想形态 |
| picku 系列（30~160 行） | 预置 `fixture_*` 变量，同一接口用 owner 和他人身份各打一次，断言 200 vs 404 | **授权/隔离的负向契约测试**，小、独立 |
| seedland / metanode 日常流 | 每次 `run_id` 注册新用户→登录→CRUD→删除；断言错误码 `error_code` | **场景型 E2E**，质量较好 |
| metanode 前端兼容性门禁（2216 行，129 步） | 注册→改密→部门→项目→工作流→课程→…→逆序删除；中间插 curl+node 校验 CORS 和图结构 | **回归/兼容性 E2E 巨型流** |
| aac 系列（1000~2100 行） | 多角色登录，用 psql 直接改库造权限/状态，再用 SQL 校验结果 | **状态机/工作流验收**，强依赖数据库后门 |
| studi 的 dev-release | 真实 worker、真实向量库、真实模型调用，用 `@retry 30` + `@retry-wait` 轮询等索引完成 | **发布前冒烟/验收**，很规范（见 A.4） |
| zgi `15-simple-load-test` | 顺序发 10 个请求，设延迟阈值 | **伪负载测试**：串行、无并发、无统计，不是 load test |
| zgi-console 支付 E2E | 固定租户 ID，先取余额再充值再比对 | **有状态 E2E，数据固定**，换环境或重跑易出问题 |

结论：**没有安全测试、没有 property-based、没有真正的负载测试**；契约测试和场景测试混在同一种文件里，没有分层。27% 的旧格式文件里有 "验证点" 这类写在正文里的预期（27 个文件、42 处），这是给人看的，**机器不会校验**。

### A.3 反模式与证据

| # | 问题 | 证据 [事实] | 影响 |
|---|---|---|---|
| 1 | **登录复制粘贴** | 371 个登录 POST，分布在 207 个文件（48%），集中在 3 个路径 | 改一次登录接口要改几十处；每个文件都多付一次登录延迟 |
| 2 | **顺序耦合的巨型流** | 129 步的文件里 53 GET、38 POST、13 DELETE 共用一条变量链 | 第 20 步失败，后面 100 步全部失去前提；无法单独跑第 80 步 |
| 3 | **Edge 是装饰** | 1296 条 edge，全部 `@on success`，97 个文件**全是线性链，0 个分支** | 与步骤顺序完全重复，插入一步还得改 edge；有的文件在两个互不依赖的步骤间连了 edge |
| 4 | **setup/teardown 未使用** | CLI 解析支持 `setup`/`teardown` 块，样本中 0 个文件使用；63 个文件（15%）以手写 DELETE 收尾，121 个文件有 ≥3 个非登录 POST 却无任何 DELETE | 清理只能靠"前面全部成功"；失败时数据泄漏。靠 `run_id` 和 TTL 兜底，但库里会积累垃圾 |
| 5 | **重试用在非幂等 POST 上** | 270 个 `@retry`，其中 216 个是 `@retry 2`，几乎全是 login / register / send_code（POST） | 重试 register 或发验证码会掩盖真实失败，且可能产生重复副作用；本意多半是"对付偶发慢"，应该修环境或做幂等 |
| 6 | **轮询没用原生能力** | `@retry-wait` 14 个文件使用（好）；`[Poll]` / `[Wait]` / `@poll-timeout` 使用 0 次 | 轮询语义被塞进 retry，报告里显示成"失败后重试"而不是"等待就绪" |
| 7 | **exec 做了工具该做的事** | 197 个 exec 步骤（89 个文件）；内容里 curl 122 次、node 83 次、psql 35 次、sleep 3 次 | curl 多为读取响应头（CORS、`X-Total-Count`）：assert 引擎只支持 `status`/`duration`/body 路径，**没有响应头断言**；node 多为数组/图结构校验 |
| 8 | **DB 后门造数据** | aac 系列用 `psql` 改角色和权限、再用 SQL 断言 | 测试只能跑在能连库的环境；绕过了 API 的授权路径，测的是"被改过的世界" |
| 9 | **密码明文** | 464 处字面量密码，分布在 211 个文件（49%）；另有 209 处用 `{{var}}`（111 个文件）；1 处字面 JWT；一个负载测试里有字面 API key | 凭据进了版本库和 `history`；好的写法已经存在（见 A.4） |
| 10 | **环境耦合** | 357 个请求用绝对 URL（35 个文件），61 个文件含 localhost；87 个请求（2%）路径里写死数字/UUID（例如固定的 assessment 编号） | 换环境要改文件；写死 ID 的测试依赖特定数据 |
| 11 | **断言偏弱** | 758 个 HTTP 步骤（19%）只断言 status；1537 个（39%）只有 status 或 exists；断言里对日期/UUID/长数字做精确相等的仅 12 处（**这点做得好**） | 状态码 200 不代表业务正确；但 72% 的步骤有 body 断言，整体不算差 |
| 12 | **延迟阈值混在功能测试里** | 314 处 `duration <`，分布在 53 个文件 | 功能测试被机器负载波动影响，易成为 flaky 来源 |
| 13 | **并行不安全** | 全局固定名称/固定租户 ID 的文件（如支付流）；`run_id` 要靠外部传入 | 同一环境并发跑两个文件会互相踩数据 |

补充 [推断，来自阅读源码]：`{{$uuid}}` 等内置动态变量**每次引用都会重新生成**，没有"本次运行内稳定"的值，所以负责人自发约定了外部注入的 `run_id`（138 个文件）。这是一个产品缺口，不是用户的错。

### A.4 值得保留的好做法 [事实]

1. **`run_id` 唯一数据**（138 个文件）：邮箱、组织名、标题都带 `run_id`，使文件可重跑、可并行。
2. **dev-release 回归流**：文件头写明运行条件和代价（会有 4 次付费生成）；密码走 `{{qa_password}}` 变量；轮询用 `@retry 30` + `@retry-wait`；用 `request_id` 幂等键并追加"重放同一请求返回缓存结果"的步骤。**这是全库最接近教科书的写法。**
3. **sandbox 系列**：一个文件一个行为；创建资源时设 TTL（即使流中途失败也会自行回收）；同时断言 HTTP 状态和业务码。
4. **picku 系列**：用 `fixture_*` 把"造数据"与"测行为"分开，文件很小，天然可并行。
5. **负向用例**：580 步断言 4xx/5xx，并断言稳定的 `error_code` 而不是错误文案。
6. **步骤 `@id`/`@name` 描述性强**（"Auth Service Reads HR Registration Code"），失败时一眼知道是哪一步。
7. **使用相对 URL + `{{base_url}}`**（356 个文件）、数据库 DSN 走环境变量。
8. **差值断言**：支付流先取 `balance_before` 再比较，而不是断言绝对余额。

### A.5 长流失败难以定位的地方

- **级联噪声**：默认不加 `--fail-fast`，第一个失败后后续依赖其 capture 的步骤会连续报"变量未定义"（源码里有 `failedSteps` 与 `ErrorKindVariable`，已能识别这类级联，但**报告层是否折叠成一个根因 [未验证]**）。
- **回读式 exec 校验**（curl + node 一段脚本验证整个图）失败时只剩 `Error: xxx missing`，缺少响应体上下文。
- **清理在末尾**：中途失败既丢失清理，又让下一次运行面对脏数据。
- **同一个 login 重复 371 次**：登录挂了，数十个文件同时红，真正的根因只有一个。
- **旧格式文件**：无 `@id`，只能靠行号定位。

### A.6 "用法健康度"评分（1 差 ~ 5 好，基于抽样 + 统计）

| 维度 | 分 | 一句话理由 |
|---|---|---|
| 测试意图与命名 | 4 | `@id`/`@name` 描述性强，sandbox/picku 目标单一 |
| 唯一数据与可重跑 | 3 | 32% 文件有 `run_id`；支付等流写死租户 ID |
| 并行安全 | 2 | `run_id` 需外部注入，固定数据与固定名称并存 |
| 断言质量 | 3 | 有 body/错误码/负向用例；19% 只验状态码；无 schema 校验 |
| 复用与去重 | 1 | 登录 371 次，同内容文件 8 倍重复，无 include |
| 清理可靠性 | 2 | 手写末尾 DELETE，0 个 teardown 块 |
| 等待与重试 | 3 | 轮询 OK，但 `@retry 2` 套在非幂等 POST 上，`[Poll]` 未用 |
| 密钥处理 | 2 | 49% 文件有明文密码，同时有 `{{var}}` 好例子 |
| 环境可移植 | 3 | 多数相对 URL；DB 后门与绝对 URL 拖后腿 |
| 故障可定位 | 3 | 描述性 id 好；巨型流与登录复制拖后腿 |
| 原生能力利用 | 2 | setup/teardown、`[Poll]`、`[Soft Asserts]`、tags 过滤均未形成习惯 |
| **综合** | **2.6 / 5** | 模型没问题，工程化习惯不足 |

### A.7 给负责人自己 flow 的 Top 10 建议

1. **先去重**：清理部署快照目录里的重复 flow（3528→431），只保留一份源文件。
2. **把凭据全部变量化**：`{{qa_password}}` + `--var` 或环境，批量替换 464 处字面量；已出现过的字面 JWT 和 API key 视为已泄漏，需轮换。
3. **用 `teardown` 块代替末尾手写 DELETE**，把清理放到失败也会执行的位置（先在小文件验证 `--fail-fast` 下的行为 [未验证]）。
4. **登录抽成一处**：短期用一个 `setup` 步骤 + `--var token=...`（外部先登录一次），长期等 Kest 做 include/fixture（见 Part C）。
5. **所有写操作的数据加 `{{run_id}}`**，并把 `run_id` 的生成约定写进 README（如 `--var run_id=$(date +%s)`）。支付类固定租户 ID 改为每次创建租户。
6. **删掉线性 edge**（1296 条中没有一条携带分支信息），顺序本来就由文档顺序决定。
7. **拆分 ≥30 步的 26 个文件**：按"业务对象"拆成 5~15 步的独立 flow，每个自己 setup 自己 teardown；巨型兼容性门禁保留为一个"精选的跨服务场景"。
8. **去掉 login/register/send_code 上的 `@retry 2`**；真有偶发就修环境。需要等待就绪时用 `[Poll]`/`@poll-timeout`。
9. **补强弱断言**：对 758 个只验状态码的步骤，至少补一条 body 字段或 `exists`；把 `duration <` 从功能 flow 移到独立的性能 flow。
10. **减少 exec**：响应头断言等待 Kest 原生支持前，把 curl 脚本集中到少数文件并注明原因；DB 造数据改为 API 或种子脚本（seed 在 flow 之外执行，flow 只用 `fixture_*`）。

---

## Part B：业界对照

### B.1 工具对比 [事实来自官方文档；评价为推断]

| 工具 | 测试模型 | 强项 | 弱项 | Kest 可借鉴 |
|---|---|---|---|---|
| [Hurl](https://hurl.dev/docs/manual.html) | 纯文本请求序列 + 捕获 + 断言；`--test` 默认并行，`--retry`/`--retry-interval`、`--glob`、`--secret`、JUnit/HTML/TAP/JSON 报告 | 极简、单二进制、断言类型丰富（[header、cookie、xpath、jsonpath、duration、证书、`isUuid`、`isIsoDate`](https://hurl.dev/docs/asserting-response.html)） | 按[捕获页](https://hurl.dev/docs/capturing-response.html)变量会话级扁平，无文件间 include；JSON Schema 校验未见内置 [未验证：基于文档页及搜索，非全面确认] | `isUuid`/`isIsoDate` 类型谓词、响应头断言、`--secret` 日志脱敏、`--glob` |
| [Tavern](https://tavern.readthedocs.io/en/latest/) | YAML stage + pytest | 复用 pytest fixture / marks / hooks，YAML anchors，`ext` 函数逃生 | 依赖 Python 环境；YAML 冗长 | marks → tags 选择；自定义校验的"逃生口" |
| [Karate](https://github.com/karatelabs/karate) | Gherkin feature；Background、Scenario Outline + Examples、内置并行 | 数据驱动、模糊 schema 匹配、同框架做 mock/性能/UI | 自带 DSL 学习曲线，复杂逻辑难调试 | Examples 表驱动；`Background`（每场景共享前置） |
| Postman Collections / [Newman](https://www.npmjs.com/package/newman) / [Flows](https://learning.postman.com/docs/postman-flows/gs/flows-overview/) | 请求集合 + JS 脚本；Newman CLI；Flows 为可视化画布 | 生态、协作、迭代数据文件（CSV/JSON） | Newman 仅支持 v2.1 JSON，新版需迁到 Postman CLI（[官方迁移说明，经搜索摘要，未直接打开页面]）；Flows 与测试断言关系弱 | 迭代数据文件；**不要**做可视化画布 |
| [Bruno](https://docs.usebruno.com/bru-cli/runCollection.md) | 文件系统集合（`.bru`）+ `bru run` | Git 友好；`--tags`/`--exclude-tags` 过滤（≥2.8.0）、`--parallel`、`--bail`、`--delay`、CSV/JSON 驱动；有 [Bruno MCP](https://mcpservers.org/servers/ostico/bruno-mcp)（第三方）| 并行默认关；脚本沙箱模式变化 | 标签过滤（Kest 已写 tags 但未实现过滤）、退出码约定 |
| [Step CI](https://docs.stepci.com/) | YAML workflow + checks + captures | OpenAPI 导入、内置 schema 校验和负载测试 | 项目热度与持续性需自行评估 [未验证] | schema check 作为一等断言 |
| [Playwright API testing](https://playwright.dev/docs/api-testing) / pytest+httpx | 代码即测试，`request` fixture，`beforeAll`/`afterAll` | fixture 作用域、并行 worker、鉴权状态复用（`storageState`） | 需要写代码 | **fixture 作用域**：登录一次、多处使用；setup/teardown 的失败也能执行 |
| [REST Assured](https://rest-assured.io/) | Java given/when/then DSL，`RequestSpecification` 复用 | JSON Schema 校验、与 JUnit 集成 | 仅 JVM | `RequestSpecification` ≈ 默认头/鉴权的复用 |
| [k6](https://grafana.com/docs/k6/next/using-k6/checks/) | JS 脚本，checks + thresholds + scenarios/executors | **check 默认不让测试失败**，必须配 threshold 才退出非零；SLO 表达力强 | 不是功能测试工具 | 把"延迟/SLO"从功能断言里分出去，做成 threshold；不要自己造负载引擎 |
| [Schemathesis](https://schemathesis.readthedocs.io/en/stable/) | 从 OpenAPI/GraphQL 生成 property-based 用例；[stateful 模式](https://schemathesis.readthedocs.io/en/latest/guides/stateful-testing/)用 OpenAPI links（含自动推断、Location 头学习） | 零手写用例找 5xx、schema 不一致、校验缺口；失败附 curl 复现；[TraceCov](https://schemathesis.readthedocs.io/en/stable/guides/coverage/) 做 operation/parameter/keyword/response 覆盖 | 不理解业务语义；需要好的 OpenAPI | 失败附最小复现；覆盖五维度报告 |
| [Dredd](https://github.com/apiaryio/dredd) | 按 API 描述中的示例逐个请求 | 简单 | 有状态流需写 hooks；OpenAPI 3 为实验性；**仓库已于 2024-11-08 归档** | 反面教材：只靠文档示例生成的测试太浅 |
| [Pact](https://docs.pact.io/) | 消费者驱动契约，"by example"，Broker + `can-i-deploy` | 多团队独立部署的安全网 | 只覆盖消费者实际用到的交互；需要流程投入 | 对单人/小团队 Kest 属于过重；仅借鉴"契约是可执行产物" |
| [Specmatic](https://github.com/specmatic/specmatic) | 契约先行：OpenAPI 即可执行契约；契约测试、服务虚拟化、向后兼容检查、生成式测试、覆盖率报告 | 一份 spec 同时驱动测试/桩/兼容性 | JVM 生态，偏重 | **spec 即契约 + 覆盖报告 + 向后兼容检查** |
| [WireMock](https://wiremock.org/docs/) / [Prism](https://docs.stoplight.io/docs/prism/83dbbd75532cf-http-mocking) | 桩服务器 / 基于 OpenAPI 的 mock 与校验代理 | 隔离下游、故障注入、录制回放 | 桩会漂移，需契约测试把关 | Kest 已有 `mock`，不必继续扩 |
| [Keploy](https://github.com/keploy/keploy) | eBPF 录制真实流量，回放生成测试与依赖 mock | 零代码起步、覆盖真实用法 | Linux 为主；噪声字段、时间需处理 | **record-from-traffic**：Kest 已有 `history`/`replay`，可转成 flow |
| LLM/Agent 测试（[AutoRestTest](https://arxiv.org/abs/2411.07098)、LlamaRestTest、MASTEST；[MCP 测试工具盘点](https://mojoauth.com/blog/top-12-api-mcp-testing-tools)） | 学术上用 LLM 生成真实参数值、多智能体 + 强化学习探索操作依赖；工程上用 MCP 让代理调用请求/跑集合 | 补足人工想不到的输入值和操作顺序 | 学术结果在公开基准上，生产可用性 [未验证]；LLM 生成的 oracle 可能错 | 代理应该**调用确定性的验证层**，而不是自己当 oracle |

### B.2 公认的测试理论要点

- **测试金字塔**：[Fowler](https://martinfowler.com/articles/practical-test-pyramid.html) 建议大量小测试、少量 E2E，并"尽量把测试往下推"；E2E 易 flaky，应只保留核心旅程。[事实]
- **契约 vs 场景 vs 属性测试** [推断综合]：契约测试验"接口形状与规则"（便宜、可并行）；场景测试验"跨调用的业务不变量"（贵、顺序、易碎）；property-based 测试验"对任意合法输入不崩"（靠工具生成）。三者互补，不应混在同一种文件里。
- **隔离与 AAA**：Fowler 的[非确定性文章](https://martinfowler.com/articles/nonDeterminism.html)指出隔离缺失、异步、远程依赖、时间是 flaky 主因；"永远不要用裸 sleep 等异步结果，用轮询加超时"；建议**隔离的测试优先于事后清理**；失败的 flaky 测试应隔离到隔离区并设数量或时限上限。每个测试按 Arrange / Act / Assert 组织。[事实]
- **Flaky 的量级**：[Google 披露](https://testing.googleblog.com/2016/05/) 约 1.5% 的测试运行为 flaky，近 16% 的测试有一定 flaky；测试越大越易 flaky。[事实，经搜索摘要]
- **幂等唯一数据 / fixture / factory** [推断，业界通行]：每次运行生成带唯一后缀的数据（factory），fixture 作用域决定共享程度；并行安全 = 不共享可变状态。
- **API 覆盖率**：[Restats 论文](https://arxiv.org/abs/2108.08209)定义了基于 OpenAPI 的路径、操作、参数、状态码、内容类型覆盖；Schemathesis TraceCov 扩展到 schema 关键字级。[事实]
- **Schema 一致性作为一等断言**：Specmatic、Schemathesis、REST Assured 都把"响应符合 OpenAPI/JSON Schema"当作默认检查；Hurl 目前主要靠 JSONPath。[事实 + 部分 未验证]

---

## Part C：结论与建议

### C.1 直接回答

**这种风格（长、有序、有状态、带 captures）是好方法吗？**

| 场景 | 判断 |
|---|---|
| 业务旅程验收（注册→付款→发货）、发布前冒烟 | **好**，这就是它的设计用途；控制在 5~15 步 |
| 异步/最终一致（等索引、等 worker） | **好**，前提是用 `[Poll]`，不用 sleep 或裸 retry |
| 授权隔离、错误码、参数校验、限额类行为 | **不好**：应拆成小而独立的契约用例，可并行，不需要登录链 |
| 80~130 步的兼容性门禁 | **有条件**：作为少量精选的串行场景可以，但必须自带 teardown 与分段 |
| 响应结构/字段兼容 | **不好**：应由 OpenAPI schema 断言一次性覆盖，而不是逐字段手写 |
| 负载/性能 | **不要用**：交给 k6 |
| 找未知 bug（边界输入） | **不要用**：交给 Schemathesis 类工具 |

**已经优雅了吗？** 请求+捕获+断言的写法已经优雅（接近 Hurl，且 Markdown 里能放说明）。**不优雅的是工程化缺口**：没有复用、没有生命周期、没有选择、没有 schema/覆盖、edge 是冗余概念。

### C.2 理想的 Kest 测试模型 [提案]

```
.kest/
  fixtures/auth.flow.md     # 登录一次，导出 token（可 include）
  contract/*.flow.md        # 小、独立、可并行：单接口 + schema + 错误码
  scenario/*.flow.md        # 5~15 步有序旅程：自带 setup/teardown
  openapi.yaml              # 契约来源：生成 schema 断言与覆盖率
```

要点：小而可组合的 flow + `include` 的共享 fixture；`{{$runId}}` 运行内稳定的唯一前缀；步骤尽量独立，必须依赖时显式声明；响应 schema 默认来自 OpenAPI；每次运行输出 API 覆盖率；用标签选择；按 `jobs` 并行跑互不共享数据的文件；失败按根因归并；AI 负责起草和诊断，**断言由确定性规则裁决**。

### C.3 十个产品押注排序

排序依据：价值、工作量、差异化三列用 高/中/低 标注，综合排序为推断。

| 排名 | 押注 | 用户价值 | 工作量 | 相对 Hurl/Bruno/Postman 的差异化 | Agent 定位 |
|---|---|---|---|---|---|
| 1 | **OpenAPI 响应 schema 一致性断言**（`[Asserts] schema: openapi`，自动按 operationId 取 schema） | 高 | 中 | 高（Hurl 无内置 JSON Schema [未验证]） | **是** |
| 2 | **API 覆盖率报告**（operation / status code / 参数，对照 OpenAPI，JSON 输出） | 高 | 中 | 高（仅 Specmatic、Schemathesis 有） | **是** |
| 3 | **按改动选择 + 根因归并的结构化结果**（`kest verify --changed`，级联失败折叠，JSON/MCP 返回） | 高 | 中 | 高（现有工具面向人，不面向代理） | **是** |
| 4 | include / fixture 复用 + `{{$runId}}` | 高 | 低~中 | 中（Hurl 无 include） | 否 |
| 5 | tags 选择（`--tag`/`--exclude-tag`）+ 退出码约定 | 中 | 低 | 低（Bruno 已有） | 否 |
| 6 | 响应头断言、`isUuid`/`isIsoDate`/`isInt` 类型谓词 | 中 | 低 | 低（Hurl 已有） | 否 |
| 7 | 从 OpenAPI 生成"冒烟 + 负向"flow（扩展现有 `import openapi`，带唯一数据与 teardown） | 中高 | 中 | 中 | 部分 |
| 8 | 从 `history` 录制转 flow（record-from-traffic 的轻量版，自动提取 captures） | 中 | 中 | 中（Keploy 是重量级） | 部分 |
| 9 | 并行安全声明与检查（lint：缺 `run_id`、固定 ID、写操作无清理时警告） | 中 | 低~中 | 中（lint 少见） | 部分 |
| 10 | flow 级 `kest why`（带整份运行摘要而不是只看最后一个请求） | 中 | 中 | 中 | 部分 |

> 注：`import openapi`、`mock`、`snap`、`why`、MCP 的 `kest_run_flow` / `kest_snapshot_verify` / `kest_why` 在代码中已存在 [事实]，上述押注是在其上增强。

**最贴合"AI 编码代理的 API 验证层"的三项：#1、#2、#3。** 理由 [推断]：代理改完代码后最需要三件事——"响应还符合契约吗"（#1）、"我验证了多少接口"（#2）、"哪里坏了、是不是同一个根因"（#3）。三者都是确定性的、可 JSON 化的信号，代理可据此自我纠错，而不用信任 LLM 的判断。

### C.4 明确不要做的事

1. **可视化画布 / 低代码流**（Postman Flows 路线）：与"Markdown 在 Git 里"的定位相反。
2. **分支/循环 DSL，让 edge 变成图灵完备**：样本中 1296 条 edge 0 个分支，需求不存在。
3. **内置 JS/Python 脚本引擎**（Karate/Postman 路线）：exec 已是逃生口；脚本会摧毁可读性与可审计性。
4. **自研负载引擎、fuzz/property-based 引擎**：交给 k6、Schemathesis；Kest 做集成而不是重造。
5. **Pact 式 Broker、can-i-deploy 流程**：对单团队过重。
6. **内置数据库驱动 / SQL 步骤**：鼓励"后门造数据"，让测试越界；用 seed 脚本+fixture。
7. **让 LLM 当断言裁判**：LLM 只用于起草 flow 与解释失败，通过/失败由规则决定。
8. **继续扩大 mock server 能力**：WireMock/Prism 已成熟。

### C.5 如何写好 Kest flow（可对外发布的指南，示例均为合成）

**1) 一个文件一个意图；契约与场景分开**

```step
@id get-unknown-order-returns-404
GET /orders/{{run_id}}-missing
Authorization: Bearer {{token}}

[Asserts]
status == 404
body.error_code == "ORDER.NOT_FOUND"
```
不要：在同一个 30 步文件里顺带验证这条。

**2) 数据永远带 `run_id`，并在同文件内自带清理**

```step
@id create-order
POST /orders
Content-Type: application/json

{"sku": "demo-{{run_id}}", "qty": 1}

[Captures]
order_id = data.id

[Asserts]
status == 201
body.data.sku == "demo-{{run_id}}"
```
不要：写死 `"sku": "TestItem"` 或路径里写死 `/orders/42`。

**3) 凭据只能是变量**：`"password": "{{qa_password}}"`，运行时 `--var qa_password=...`。不要把密码、token 写进 flow。

**4) 等待用轮询，不用 sleep，不用 retry 掩盖失败**

```step
@id wait-order-ready
@retry 30
@retry-wait 1500
GET /orders/{{order_id}}

[Asserts]
status == 200
body.data.status == "ready"
```
（Kest 原生 `[Poll]` 更贴切，参见 CLI 帮助。）不要对 login、register、发验证码这类 POST 加 `@retry`。

**5) 断言要断言"意图"**：状态码 + 业务码 + 关键字段；不要对时间戳、自增 ID、UUID 做精确相等；延迟阈值放性能 flow。

**6) 步骤 `@id` 写成句子**（`delete-order-after-cancel`），失败时直接可读。

**7) 不写线性 edge**：顺序就是文档顺序；只有真的有条件分支才用 edge。

**8) 长度预算**：>15 步就应考虑拆分；>30 步必须说明为什么不能拆。

**9) 文件头写清**：运行方式、所需变量、副作用与成本（付费调用、发邮件）。

---

## 附：无法验证与注意事项

- 您提到的 kubectl exec 用法，在去重后的 431 个文件中**搜到 0 处**（curl / node / psql / jq / date 才是主要内容）；可能在未纳入的目录或已被改写。
- 您给出的统计与我计算的口径略有不同：我数得 4108 个 step、2769 个步骤含 `status == 200`（67%）、1296 条 edge，与您一致；密码字面量我数得 464 处（您为 442）。口径差异只影响个位百分点。
- "Poll / setup / teardown 在您使用的 Kest 版本里是否已可用"无法确认：我读的是 `feat/agent-verification-layer` 分支的解析器。
- 失败后级联步骤在报告中是否被折叠为根因、`teardown` 在 `--fail-fast` 下是否执行，**我读到了相关代码但没有实际运行验证**；`--fail-fast` 路径中看到失败即返回，teardown 很可能被跳过 [推断]。
- Hurl 无 include 和无 JSON Schema 的结论来自 Hurl 文档的 capturing 页及搜索摘要，未读完整手册；Bruno、k6、Newman 的细节来自搜索摘要而非逐页阅读（对应官方页面抓取超时）。
- LLM/Agent 测试方面，仅核对到 AutoRestTest 论文摘要层面；搜索结果中出现的其他新论文（含 2026 年编号）我没有打开阅读，未引用。
- "近 16% 的 Google 测试有 flaky 记录"取自搜索摘要，请引用前回到原博客核对。
- 本报告的评分是基于抽样阅读 + 正则统计的判断，不是自动评测；正则统计可能漏掉非常规写法。
