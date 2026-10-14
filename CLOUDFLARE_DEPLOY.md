# Cloudflare 网页端部署 / Dashboard deployment

本项目使用 **一个 Cloudflare Worker + 一个 D1 数据库**。Worker 提供家长账号和孩子档案接口，D1 保存学习进度，Static Assets 提供网页、照片和录音。当前规模不需要 R2、KV 或额外的语音 API；点击单词不会重新生成音频。

本说明只使用 Cloudflare 与 GitHub 网页。表格中的构建与部署命令填写在 Cloudflare 控制台，由平台执行，不需要在自己电脑上执行部署命令。

## 1. 准备源代码

目标仓库：[huades/word-adventure](https://github.com/huades/word-adventure)。部署前必须已把项目源码上传到该仓库。

仓库顶层应直接包含 `package.json`、`wrangler.jsonc`、`cloudflare/`、`dist/`、`scripts/` 和本说明。不要把整个项目再套在多余文件夹里，也不要只上传 `dist`。本地的 `data/`、`.env`、`node_modules/`、`.tool-runtime/`、`.cloudflare/`、录音回听文件及运行日志不能上传。

## 2. 创建 D1 并初始化

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。打开 **Storage & Databases → D1 SQL Database**；界面旧版本可能直接显示 **D1**。
2. 点击 **Create database**，名称填写 `word-adventure`，保存。此数据库名称应与配置中的 `database_name` 一致。
3. 打开该数据库，复制 **Database ID**（一串 UUID，是资源标识，不是密钥）。
4. 打开数据库的 **Console** 页签。在 GitHub 仓库打开 `cloudflare/schema.sql`，复制全部 SQL，粘贴到 Console 并执行；若界面只接受一条语句，依次执行每个以分号结束的语句。
5. 在 Console 执行 `SELECT name FROM sqlite_master WHERE type='table';`，应看到 `users`、`sessions`、`profiles`、`progress`、`auth_limits` 等表。
6. 在 GitHub 网页打开 `wrangler.jsonc` → 铅笔编辑，把 `database_id` 的 `00000000-0000-0000-0000-000000000000` 改成第 3 步的真实 ID，然后保存提交。不要把 API Token 填在这里。

`schema.sql` 使用 `CREATE TABLE IF NOT EXISTS`，重复执行不会清空已有记录。本地 SQLite 的账号密码哈希与 Cloudflare 版不同，请按第 6 节迁移学习记录，不要直接上传本地数据库。

## 3. 在 Workers 网页连接 GitHub

1. 打开 **Compute & AI → Workers & Pages → Create application**。
2. 选择创建 **Worker** 并连接 Git 仓库的入口，例如 **Import a repository / Connect to Git**。不要选仅上传静态网页的 Pages 模式。
3. 连接 GitHub，选择 `huades/word-adventure`。如果第一次授权需要选择仓库，只授予此仓库访问权即可；无需把所有仓库都授权。
4. 使用下面的设置。Worker 名称保持 `word-adventure`，与配置文件一致。

| 网页字段 | 填写内容 |
| --- | --- |
| Worker / Project name | `word-adventure` |
| Production branch | `main` |
| Root directory | 仓库顶层；有该字段时留空或使用 `.` |
| Build command | `npm run build:cf` |
| Deploy command | `npm run deploy:cf` |
| Output directory | Workers 不需要单独填写；项目配置使用 `.cloudflare/assets` |
| Build variables | 无必填变量；若构建环境 Node 版本低于 22.13，添加 `NODE_VERSION=22.21.1` |
| Runtime variables / Secrets | 当前功能无需额外变量或密钥 |

5. 点击 **Deploy**。平台安装项目声明的构建工具，构建脚本仅打包网页实际引用的照片和音频，排除审核联系表、被弃用的图片和私人数据。
6. 成功后打开 Worker 的 **Bindings**，应看到 **DB → word-adventure**（D1）和 **ASSETS**（静态资源）。绑定由 `wrangler.jsonc` 声明；如果没有 DB，检查 Database ID 后重新构建，不要只在网页临时添加一个会被下一次部署覆盖的不同配置。

当前无需手工添加 GitHub Token 或 Cloudflare API Token 到源码。Cloudflare Git 集成在网页授权流程中处理构建权限。后续修改 `main` 分支后，平台会按这些设置重新构建。

## 4. 验证网址和功能

先使用平台提供的 HTTPS 地址，例如 `https://word-adventure.<你的子域>.workers.dev`。

1. 打开 `https://你的网址/api/health`，应显示 `{"ok":true,"storage":"D1"}`。这一步可区分网页能打开与账号数据库真正可用。
2. 打开首页、分类词库，点击照片，试听正常与慢速声音；完成一题，检查提示音和对应英语朗读。
3. 创建家长账号和孩子档案，标记一个薄弱词，等页面出现“已保存到服务器”，刷新后检查仍存在。
4. 在另一个浏览器或手机打开**同一个网址**，登录同一账号，检查孩子档案与薄弱词能载入。
5. 创建第二个孩子，确认其进度独立；测试退出后无法访问账号数据。
6. 测试麦克风录音回听。HTTPS 是浏览器允许麦克风的必要条件之一；首次使用还需要用户允许麦克风。

本地测试已覆盖账号接口与数据库契约。Cloudflare 实际网络、Worker CPU 限额及账户额度须在真实部署验证，不能用本地测试替代。注册或登录如果出现 **Error 1102**，在 Worker 的 **Observability / Logs** 查看 CPU 限额错误；不要为绕过限额降低密码哈希强度。先确认实际运行限制，再调整认证架构或计划。

## 5. 域名、免费额度与排错

- **自定义域名（可选）**：先验证 `workers.dev`。再打开 Worker → **Settings → Domains & Routes → Add → Custom Domain**，选择由你在 Cloudflare 管理的域名或子域。保存后用新的 HTTPS 域名重新登录；Cookie 和访客记录不会自动跨域共享。
- **免费额度**：当前 Workers Free 有每日 100,000 次动态请求额度；D1 Free 每日 500 万行读取、10 万行写入，总计 5 GB 存储。静态资源请求有独立计费规则。额度共享于账号，达到限制时功能会受影响；以控制台显示为准。
- **`/api/health` 返回 503**：检查 DB 绑定、真实 Database ID 和 SQL 初始化。仅打开首页成功不能证明账号可用。
- **构建找不到文件**：确认仓库顶层结构、所有 `dist` 图片与音频均已上传，并使用 `npm run build:cf`。构建脚本会检查每个引用文件。
- **登录后无法保存**：使用同一 HTTPS 域名，允许本网站 Cookie；检查 D1 额度与 Worker 日志。不要混用本机地址和云端地址。
- **提示另一设备更新**：先导出当前记录，再在账号页重新载入服务器数据；本版不自动合并两个设备的冲突记录。
- **声音不可用**：先检查设备音量和网页播放权限，试听“听示范”；音频全部随项目保存，不需要配置语音 API key。
- **自动 AI 纠音**：本次部署仍使用家长确认。尚未验证的 CPA 音频能力不会被当作有效自动评测；无需为当前功能填写 AI 密钥。
- **回滚**：在 Worker 的 Deployments 中切回已验证的代码版本。回滚代码不等于回滚数据库；重要记录可先由家长导出 JSON，数据库恢复使用 D1 的网页备份/Time Travel 功能。

## 6. 从本机迁移学习记录

1. 在本机网页登录家长账号，切换到第一个孩子 → 家长设置 → **导出学习记录**，保存 JSON。其他孩子逐个导出。
2. 在云端网址创建新的家长账号，创建对应的孩子档案。
3. 切换到对应孩子 → 家长设置 → **导入记录**，选择该孩子的 JSON。
4. 等待“已保存到服务器”，刷新验证；其他孩子重复以上步骤。

JSON 包含该孩子的薄弱词、星星和进度，不包含密码、登录 Cookie 或其他孩子的数据。JSON 属于私人记录，不要上传到公开 GitHub。此流程不迁移本机账号密码；云端需要重新创建账号。

## English

Deploy one **Worker + D1** application through the Cloudflare Dashboard. The Worker serves the parent/child APIs; D1 stores account progress; Static Assets serves bundled photographs and speech. No R2, KV, or speech API key is required for the implemented features.

1. Upload the project source to [huades/word-adventure](https://github.com/huades/word-adventure), keeping `package.json`, `wrangler.jsonc`, `cloudflare/`, `dist/` and `scripts/` at the repository root. Exclude private/runtime files.
2. In **Storage & Databases → D1**, create `word-adventure`. Run `cloudflare/schema.sql` in its **Console**. Copy the Database ID and replace the zero UUID in `wrangler.jsonc` using the GitHub web editor.
3. In **Workers & Pages**, create a Worker connected to the repository. Set the name to `word-adventure`, branch to `main`, build command to `npm run build:cf`, and deploy command to `npm run deploy:cf`. These are Dashboard fields, not local deployment instructions. No separate output-directory field or runtime secrets are required; assets are configured at `.cloudflare/assets`.
4. Deploy and confirm the **DB** D1 binding and **ASSETS** binding. Open the provided HTTPS `workers.dev` address. `/api/health` must return `{"ok":true,"storage":"D1"}`. Test login, saving, reload, a second device, and microphone permission.
5. Add an optional custom domain under **Settings → Domains & Routes** after verification. Log in again on the new domain. Monitor Workers/D1 quotas and logs; local contract tests do not verify edge CPU limits or production deployment.
6. To migrate local learning, export each child's JSON from the local app, create a cloud parent account and matching profiles, then import each JSON into its corresponding profile. Do not upload the local SQLite database or private JSON to GitHub. Passwords and cookies are not migrated.

Automatic AI pronunciation scoring is not enabled. Speech is cached; child recordings stay in browser memory. For storage errors, check the D1 binding/schema/quotas; for conflicts, export before reloading server progress. Error 1102 requires checking actual Worker CPU limits, without weakening password hashing.

## 官方依据 / Official references

- [Workers Builds 设置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [静态资源与绑定](https://developers.cloudflare.com/workers/static-assets/binding/)
- [D1 网页绑定与调试](https://developers.cloudflare.com/d1/best-practices/remote-development/)
- [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 免费额度](https://developers.cloudflare.com/d1/platform/pricing/)
- [静态资源计费](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
