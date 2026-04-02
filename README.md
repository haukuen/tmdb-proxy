# tmdb-proxy

因为 TMDB 的动漫分季过于傻逼，所以有了这个项目。

fork 后在 Cloudflare Workers 上导入即可使用。

## 本地部署教程

### 1) 准备

- 安装 [Bun](https://bun.sh/)
- 准备 Cloudflare 账号

### 2) 安装依赖

```bash
bun install
```

### 3) 登录 Cloudflare

```bash
bun run cf:login
```

### 4) 本地调试（可选）

```bash
bun run cf:dev
```

默认本地地址：`http://127.0.0.1:8787`

### 5) 部署上线

```bash
bun run cf:deploy
```

部署成功后会返回一个 `*.workers.dev` 域名。


## 路由说明

- `/t/p/:path*` -> `https://image.tmdb.org/t/p/:path*`
- 其他路径（如 `/3/...`）-> `https://api.themoviedb.org`
- `Authorization` 请求头会透传给 TMDB


## Overrides 维护方式

- 源数据目录：`src/overrides/`（可按分类建子目录，如 `anime/`）
- 生成文件：`src/overrides.generated.json`（Worker 运行时读取）

### 新增/修改一部番剧

1. 在 `src/overrides/` 下新增或编辑一个 JSON 文件（建议文件名用 TMDB series id）。
2. 文件结构示例：

```json
{
  "series_id": "209867",
  "name": "葬送的芙莉莲",
  "seasons": [
    { "season_number": 1, "name": "葬送的芙莉莲", "originalSeason": 1, "episode_start": 1, "episode_end": 28 }
  ]
}
```

3. 运行构建脚本：

```bash
bun run overrides:build
```

构建脚本会做基础校验（如 `series_id` 格式、季号重复、分段重叠等），然后自动生成 `src/overrides.generated.json`。
