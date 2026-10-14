# Cloudflare 网页端部署 / Dashboard deployment

本项目使用一个 **Worker + D1 数据库 + Static Assets**。D1 保存家长账号、孩子档案与学习进度；图片和统一 Zira 音频随网页保存，运行时不调用图像或语音生成服务。本指南只使用 Cloudflare/GitHub 网页；下列命令填写在控制台字段中，由 Cloudflare 执行。

## 先修复已有部署的 10181 报错

报错中的全零 Database ID 是旧版占位符，不是已存在的数据库。新版源配置不再填写假 ID，部署脚本会确认或创建数据库并先初始化表。

1. 打开 Cloudflare → **Workers & Pages → word-adventure → Settings → Build**。
2. 确认 **Git repository** 是包含本次更新的仓库，**Git branch** 为 **main**。如果一键部署曾复制成另一个仓库，先把更新同步到那个副本，或将构建关联改为 **huades/word-adventure**；源仓库的更新不会自动同步到独立副本。
3. 保存下表设置。原来的 **npx wrangler deploy** 会跳过本项目的数据库初始化，需要改为 **npm run deploy**。
4. 按下一节检查构建 Token 的 D1 权限，然后在 Deployments/Builds 选择最新提交重新部署。

| 网页字段 | 填写内容 |
|---|---|
| Worker name | word-adventure；若在一键流程改名，保持源配置与 Worker 一致 |
| Git branch | main |
| Root directory | 仓库顶层；留空或使用 . |
| Build command | **npm run build** |
| Deploy command | **npm run deploy** |
| Output directory | Workers 无需单独填写；配置使用 .cloudflare/assets |
| Node version | 环境需 Node ≥22.13；有需要时添加构建变量 NODE_VERSION=22.21.1 |
| Runtime variables / Secrets | 当前功能无必填项 |

## 构建 Token 的 D1 权限

Cloudflare 默认自动生成的 Workers Builds Token 的权限列表不包含 D1。创建数据库和应用初始化迁移需要 **Account → D1 → Edit**。

1. 在 Worker 的 **Settings → Build** 查看当前使用的 **API token**。
2. 打开 Cloudflare 头像 → **My Profile → API Tokens**，编辑对应 Token 的权限，在保留原有 Worker 发布权限的基础上增加 **Account → D1 → Edit**，资源范围选择部署所用账号。
3. 如果原 Token 不允许编辑，在这个安全网页中创建具有原发布权限和 D1 Edit 权限的新 Token，再回到 Worker 的 Build 设置选用它。不要把 Token 写进仓库、命令参数或聊天。
4. 保存设置，再重新部署。出现 Authentication error / 403 时先检查此项；不要为了绕过权限而删除已有数据库。

## 新项目的一键入口

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fhuades%2Fword-adventure)

1. 点击按钮，在 Cloudflare 网页登录、连接 GitHub。
2. 确认复制仓库、Worker 和数据库名称。账号已拥有 word-adventure 时，副本可命名 word-adventure-app；保留 **DB** 绑定名。
3. 确认 **Build command = npm run build**、**Deploy command = npm run deploy**，并确保构建 Token 有前述 D1 权限。
4. 点击 Deploy，完成后验证下方网址和账号功能。

首次登录、授权和名称确认仍需本人完成。本项目的实际 Cloudflare 账号权限、资源创建、网络与 CPU 限额必须在真实部署中验证；本地测试不能代替上线检查。

## 数据库如何初始化

部署脚本优先使用源配置中的真实 database_id；未配置时，查找与 database_name **完全同名**的 D1，存在则复用，不存在才创建。取得真实 ID 后，写入仅属于本次构建的 .cloudflare/deploy.json，再应用 cloudflare/migrations 中未执行的迁移，最后发布 Worker。源配置和已有账号进度不会被改写或清空；任一数据库步骤失败即停止发布。

新版 Worker 在首次 API 请求时检查基础表，仅在收到“no such table”错误时执行打包的 **CREATE TABLE/INDEX IF NOT EXISTS** 补齐语句，已有记录保留。并发请求共享当前 Worker 实例的初始化结果；初始化失败后可以重试。它不会把连接失败当成缺表，也不替代后续版本迁移。/api/health 会重新检查数据表。

如果旧版线上首页正常，但注册失败且 /api/health 显示“D1 尚未初始化”，可以先在网页中恢复：打开 **Worker → Bindings → DB**，进入它实际绑定的 D1（不要只按同名猜测），在 **Console** 粘贴并执行仓库 [cloudflare/schema.sql](cloudflare/schema.sql) 的完整内容，再刷新 /api/health。这些语句只补齐缺失表和索引，不清空账号。不要新建替代数据库或删除原库。也可部署包含自动补表功能的新版代码后再次访问健康检查。

默认 database_name 为 word-adventure。若你要绑定另一个已有数据库，在 GitHub 网页编辑 wrangler.jsonc 的 DB 项，将 database_name 改成其名称并添加真实 database_id。Database ID 可从 **Storage & Databases → D1 → 对应数据库 → Overview** 复制；它是资源标识，不是密钥。该配置文件保持标准 JSON 格式，不要添加全零占位 ID。正常使用新版部署脚本时，无需手工粘贴 SQL。

直接使用平台默认的 Wrangler 发布命令可能创建资源，但不会执行本项目的表初始化，因此应保留上表的 **npm run deploy**。

## 部署后的验证

1. 打开生成的 HTTPS 地址，例如 https://word-adventure.<你的子域>.workers.dev。
2. 访问 **/api/health**，应返回 **{"ok":true,"storage":"D1"}**。首页能打开不代表数据库已就绪。
3. 查看 **Bindings**，应有 **DB**（D1）和 **ASSETS**（静态资源）。
4. 注册家长账号、创建孩子档案、标记一个薄弱词，等“已保存到服务器”，刷新并在另一设备登录核对。
5. 点击图片试听，完成一题检查提示音与英文朗读；测试 HTTPS 下的麦克风授权与回听。
6. 在手机与微信中打开网址，进入分类词库检查每页 20 词、翻页和缩略图；标记“我已掌握”后应出现淡绿色光晕，刷新后仍保留，学习和测试不再以该词出题。

构建会生成带内容指纹的脚本/样式，并发布词卡缩略图。它们使用一年浏览器缓存，更新内容会改变 URL；首页使用平台默认重新验证，账号 API 不缓存。不要在 Cloudflare 网页额外添加覆盖整个网站或 /api/* 的“全部缓存”规则。想检查实际提速，应在同一手机、同一网络下分别测试首次和再次打开；本地限速模拟不代表公网速度。此缓存方式遵循 [Cloudflare 静态资源头配置](https://developers.cloudflare.com/workers/static-assets/headers/)。

## 迁移本机记录、域名与排错

- 本机账号与云端密码哈希实现不同，不直接上传 SQLite。逐个孩子导出 JSON，在云端创建账号/对应档案后导入，刷新核对。私人记录不上传 GitHub。
- 自定义域名：验证 workers.dev 后，在 Worker → Settings → Domains & Routes 添加 Custom Domain。换域名后重新登录，Cookie 不跨域共享。
- 10181 / all-zero ID：确认拉取的是新版源码，改用上表 Deploy command；若源配置有显式真实 ID，确认它属于当前账号。
- D1 创建/迁移失败：检查同名数据库、构建 Token 的 D1 权限及账号额度；脚本不会删库或回退到不相关数据库。
- /api/health 返回 503：检查 DB 绑定与迁移日志，重新运行正确的网页部署流程。
- 登录出现 Error 1102：在 Worker 的 Observability/Logs 检查 CPU 限额，实际运行验证后再调整认证方案；不要降低密码哈希强度。
- 另一设备更新：先导出当前记录再重新载入服务器数据，本版不自动合并冲突。
- 回滚代码不回滚数据库；可使用导出的 JSON 和 D1 Time Travel 网页功能恢复数据。
- 自动 AI 纠音仍未启用，本版使用家长确认，不需要为当前功能填写 AI 密钥。

## English

Use the Cloudflare Dashboard only. For an existing Worker, open **Settings → Build**, select the repository containing the updated code and branch **main**, set **Build command = npm run build** and **Deploy command = npm run deploy**, save, then redeploy the latest commit. The default **npx wrangler deploy** skips application migrations. Independent repositories created by the deployment button do not automatically receive upstream updates.

The build token must retain Worker deployment permissions and include **Account → D1 → Edit**. Inspect it under the Worker build settings and manage permissions in **My Profile → API Tokens**. Keep credentials in Cloudflare's secure interface, never in source or chat.

The source template omits fake database IDs. The deployment script honors a configured real ID; otherwise it reuses an exactly named database or creates one, writes a build-local resolved config, applies versioned migrations, and only then publishes the Worker. Failed database steps stop deployment. Existing data is preserved. Use the button above for a new project, confirm names and commands, and check token permissions.

No separate output directory or runtime secrets are required. Verify **/api/health**, DB/ASSETS bindings, account saving across refresh/devices, audio and HTTPS microphone access. Local tests mock account operations and check the Worker/D1 contract; actual deployment and edge CPU limits have not been verified here. Export/import child JSON to migrate local progress; passwords and cookies do not migrate.

The Worker also repairs missing initial tables using bundled idempotent CREATE statements when the first API request reports "no such table". Connection failures do not trigger DDL, failed attempts can retry, existing records remain, and later versioned migrations still belong in the deployment step. For an older live Worker reporting an uninitialized D1, open **Worker → Bindings → DB**, go to that actual bound database's **Console**, execute the complete **cloudflare/schema.sql** from the repository, and verify /api/health again. Do not delete or replace the database.

After deployment, test the 20-card library, paging, thumbnails and reversible green mastery cards on a phone and in WeChat. Content-hashed runtime/CSS/card URLs use long browser caching, while HTML revalidates and account APIs stay uncached. Do not override /api/* with site-wide cache rules. Compare first/repeat visits using the same device and network; local throttling is not a production speed guarantee.

## 官方依据 / Official references

- [Workers Builds 设置、部署命令和 Token 权限](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Wrangler 自动资源创建](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning)
- [Deploy to Cloudflare 按钮](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [D1 创建、查询与迁移命令](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
