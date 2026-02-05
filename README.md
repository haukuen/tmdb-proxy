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


项目也有 Vercel 版本，在 Vercel 导入仓库后可直接部署。
