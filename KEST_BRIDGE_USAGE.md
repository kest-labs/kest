# Kest Bridge 使用说明

`kest bridge` 用来在本机启动一个本地 HTTP bridge，让 Kest Web 可以通过你的电脑实际发出 API 请求，从而避开浏览器直接请求目标接口时的 CORS 限制。

默认监听地址：

```text
http://127.0.0.1:8788
```

Web 端默认读取的本地 bridge 地址也就是这个值，配置见 [web/.env.example](/Users/mingde/item/kest/web/.env.example:8)。

## 1. 启动命令

默认启动：

```bash
kest bridge
```

自定义端口：

```bash
kest bridge --port 8799
```

指定监听地址：

```bash
kest bridge --host 0.0.0.0 --port 8788
```

限制允许访问 bridge 的前端来源：

```bash
kest bridge --cors-mode strict --allow-origin https://your-kest.example.com
```

如果需要允许多个来源，可以重复传入：

```bash
kest bridge \
  --cors-mode strict \
  --allow-origin http://localhost:3000 \
  --allow-origin https://your-kest.example.com
```

## 2. 验证是否启动成功

启动后你会看到类似输出：

```text
🔌 Kest local bridge listening on http://127.0.0.1:8788
```

也可以直接检查健康接口：

```bash
curl http://127.0.0.1:8788/health
```

正常返回类似：

```json
{"ok":true,"name":"kest-local-bridge","cors_mode":"auto"}
```

## 3. 在 Kest Web 里的使用方式

1. 启动 `kest bridge`
2. 打开 Kest Web 的 Request Workbench
3. 选择一个 Environment，并确保其中配置了 `base_url`
4. 导入 API Markdown，或者直接打开已有 request
5. 点击发送，请求会先发到本地 bridge，再由 bridge 从你的电脑发往真实 API

如果请求 URL 使用了 `{{base_url}}/path`，Workbench 会先按当前 Environment 解析变量，再交给 bridge 执行。

## 4. `unknown command "bridge"` 的处理方法

如果执行下面的命令时报错：

```bash
kest bridge
```

并看到：

```text
Error: unknown command "bridge" for "kest"
```

通常不是没安装，而是你当前 PATH 里的 `kest` 是旧版本。

先确认当前命中的二进制：

```bash
which kest
kest --help
```

如果 `--help` 里没有 `bridge`，用当前仓库源码重新构建覆盖本机二进制：

```bash
cd /Users/mingde/item/kest/cli
go build -o ~/.local/bin/kest .
hash -r
kest bridge --help
```

## 5. 为什么 `go install .` 可能不生效

在这个仓库里，CLI 模块路径是：

```text
github.com/kest-labs/kest/cli
```

所以你在 `cli/` 目录执行：

```bash
go install .
```

Go 可能会生成一个名为 `cli` 的二进制，而不是覆盖你 PATH 里的 `kest`。这也是为什么看起来“安装了新版”，但执行 `kest bridge` 还是老版本。

更稳妥的更新方式是直接指定输出文件名：

```bash
cd /Users/mingde/item/kest/cli
go build -o ~/.local/bin/kest .
hash -r
```

## 6. 常用排查命令

查看当前使用的 `kest` 路径：

```bash
which kest
```

查看当前版本支持的命令：

```bash
kest --help
```

查看 bridge 帮助：

```bash
kest bridge --help
```

检查本地 bridge 是否存活：

```bash
curl http://127.0.0.1:8788/health
```

## 7. 相关接口

Bridge 本地提供两个接口：

- `GET /health`
- `POST /run`

实现位置见 [cli/bridge.go](/Users/mingde/item/kest/cli/bridge.go:60)。
