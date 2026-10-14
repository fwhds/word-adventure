# 🌸 单词大闯关 · Word Adventure

面向小学 1—3 年级初学者的家庭英语学习网页。根据两页分类词汇整理 **257 个词、8 个类别、215 个词的真实照片**，用照片、听读和每轮 20 题练习，让孩子把不会的词集中复练。

[Cloudflare 网页部署说明](CLOUDFLARE_DEPLOY.md) · [照片出处](PHOTO_CREDITS.md) · [声音出处](AUDIO_CREDITS.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fhuades%2Fword-adventure)

**推荐一键部署入口**：点击上方按钮，在 Cloudflare 网页登录并连接 GitHub，确认项目名称后部署。平台会创建、绑定 D1，部署流程自动初始化数据表，无需手动复制数据库 ID 或 SQL。若使用你已拥有源仓库的 GitHub 账号，请给新复制的仓库选择不同名称，例如 **word-adventure-app**。这是由平台引导的网页流程，首次登录和授权仍需本人完成。

## 主要功能

| 功能 | 使用方式 |
| --- | --- |
| 分类词库 | 选择类别或搜索；点击照片直接播放英文，无词卡弹窗 |
| 图片与听力练习 | 每轮 20 题；答对有提示音并朗读对应英语，答错加入薄弱词 |
| 我的薄弱词 | 区分“不认识、听不懂、说不出、发音再练”，优先复练 |
| 分类测发音 | 每轮 20 题，薄弱词优先；听示范、录音回听、家长确认 |
| 示范声音 | 全部 257 词统一 Zira 美式音色，支持正常和慢速播放 |
| 家长账号与孩子档案 | 多个孩子进度分别保存，支持改名、头像、归档和恢复 |
| 备份与同步 | 登录后自动保存到服务器，可导入导出单个孩子的 JSON |

同一薄弱项在 **3 个不同轮次**中练对才会移出。类别不足 20 个词时轮换复练；同一词在同一轮重复练对，只计一次掌握进度。关闭提示音不影响英文朗读。

**发音测试当前由家长确认。** 尚未接入自动 AI 纠音，不用识别文字生成发音分数。孩子录音仅在页面内存中回听，不上传到服务器。没有找回或重置密码功能。

## 本机启动：无需安装依赖

需要 **Node.js 22.13+**，已验证版本 **22.21.1**。SQLite 是保存记录的数据库，本机版使用 Node.js 内置功能。

在 PowerShell 中进入项目目录并启动：

    cd 'D:/Desktop/小学/英语单词大闯关'
    node server.mjs

出现 Local: http://127.0.0.1:4173 后，打开 [本机网页](http://127.0.0.1:4173/)。Ctrl+C 停止。SQLite 的 experimental 提示不代表失败。本机服务器只监听 127.0.0.1，其他设备不能直接访问。

端口被占用时可换端口：

    $env:PORT='4187'
    node server.mjs

此时打开 [备用本机地址](http://127.0.0.1:4187/)。账号记录仍在同一数据库，访客浏览器记录按网址分别保存。

## 第一次使用

1. 先作为访客体验，记录保存在当前浏览器。
2. 打开 **账号与数据 → 创建家长账号**。账号名使用 3—32 位英文字母、数字、点、横线或下划线，密码为 8—128 个字符；孩子只填昵称。
3. 在首页选择类别练习，或到分类词库点照片听英语。“跟读 / 标记”进入学习页，可以慢速听、录音回听、标记再练原因。
4. 在薄弱词页选困难类型复练；分类测发音由家长听录音后确认。
5. 家长设置可调语速与提示音；当前统一 Zira 美式，不混用其他音色。新档案默认正常速度；已保存的个人速度设置保留。
6. 登录后等页面显示 **已保存到服务器**。添加第二个孩子后切换档案再学习。访客记录可导入新档案，不自动覆盖已有孩子。

## 照片与声音

照片随网页保存，不依赖远程图片链接。身体部位使用实拍局部或实拍加定位圈；模型等素材明确标注。数字用数字/数量表达。仍缺合适实拍素材的词保留“暂缺实拍照片”提示。

**全部 257 个词统一播放 Microsoft Zira Desktop 的美式合成 WAV**。点击图片、听示范、答对后的朗读均使用同一音源；正常速度为 1 倍，慢速播放保持音高。旧账号的声音/口音选择会统一迁移，练习进度和个人速度设置保留。音频失败提示重试，不静默切换到其他音色。运行时不需要系统安装英语语音、联网生成或语音 API key。

32 段 Commons 真人录音保留在源码中作为有授权的参考归档，不参与网页播放，也不打包到 Cloudflare 静态资源。可选神经语音生成脚本保留，但当前未生成、未启用，不会自动改变现有播放策略。来源和生成方法见 [AUDIO_CREDITS.md](AUDIO_CREDITS.md)。

照片与 Commons 真人录音各自适用出处中列出的许可证；合成输出独立说明，不能套用真人素材的 CC 许可证。当前仓库未指定整体代码许可证。

## 账号与数据

| 运行位置 | 保存位置 |
| --- | --- |
| 本机 Node.js 服务器 | data/learning.sqlite |
| Cloudflare Worker | 绑定名为 DB 的 D1 数据库 |
| 未登录访客 | 当前浏览器的本地存储 |

自动保存薄弱词、星星、轮次、词条状态和声音设置。两个设备修改同一进度时有版本校验，冲突不会静默覆盖；网页保留本机恢复备份，可导出后重新载入服务器记录。

**迁到云端**：每个孩子分别导出 JSON，在云端重新创建家长账号与孩子档案，切换到对应孩子后导入，再刷新验证。密码和 Cookie 不迁移；不要直接上传本地数据库到 D1。

备份整个本机数据库时，先停止所有使用该数据库的服务器，再复制完整 data 文件夹，包括可能存在的 -wal 和 -shm 文件。私人 JSON 与数据库不能上传公开仓库。

本机环境变量：PORT 指定端口；WORD_DATA_DIR 指定持久数据目录；COOKIE_SECURE=1 仅用于 HTTPS 普通服务器部署。本机 HTTP 不要启用 Secure Cookie。

## Cloudflare 网页端部署

推荐 **Workers + Static Assets + D1**，完整流程见 [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)。仅上传 dist 到静态托管不能提供账号功能。

优先使用 README 顶部的 **Deploy to Cloudflare** 按钮。平台识别标准 **build / deploy** 脚本，创建资源后更新 D1 标识，自动执行数据库迁移与发布。已有账号和学习记录不会在重复部署时清空。此路径不需要执行下方手工创建数据库的步骤。

以下为已有 D1 或已有 Worker 的手工 Git 集成路径：

1. 在 D1 网页创建 word-adventure，在 Console 执行 cloudflare/schema.sql。
2. 在 GitHub 网页编辑 wrangler.jsonc，把全零 database_id 替换成真实 Database ID。
3. 在 Workers 网页连接仓库，名称 word-adventure，分支 main，Root directory 为仓库顶层。
4. 在网页 **Build command** 填 **npm run build:cf**，**Deploy command** 填 **npm run deploy:cf**。Cloudflare 自动执行，无需在本机执行部署命令。Workers 无单独的 Output directory 字段；资源目录配置为 .cloudflare/assets。
5. 当前无需运行时密钥或额外变量。部署后确认 **DB** 与 **ASSETS** 绑定，通过 HTTPS 打开 /api/health，验证注册、保存、刷新及跨设备登录。

当前没有自动 AI 评测。CPA 音频能力需另行核验，不用把 AI 密钥放进前端或仓库。真实 Cloudflare 部署和额度需实际验证，本地契约测试不代表已经上线。

## 目录与验证

    dist/                    网页、词库、照片与缓存音频
    cloudflare/worker.mjs     Worker 账号 API
    cloudflare/schema.sql     D1 初始化语句
    cloudflare/migrations/    平台部署时自动应用的版本化数据库初始化
    wrangler.jsonc            Worker 与 D1/静态资源配置
    account-server.mjs        本机 Node.js / SQLite 后端
    server.mjs                本机启动入口
    scripts/                 资产生成、核对与打包工具
    tests/                   学习、音频、账号和 Worker 契约检查
    data/                    私人运行数据，不上传

在项目目录运行检查，无需安装 npm 依赖：

    node tests/answer-audio.test.mjs
    node tests/assets.test.mjs
    node tests/accounts.test.mjs
    node scripts/build-cloudflare.mjs
    node tests/cloudflare.test.mjs

账号测试使用临时数据库。Worker 测试使用真实处理函数和 SQL、SQLite 实现的 D1 接口适配器，覆盖登录、Secure Cookie、CSRF、跨家庭访问、并发保存、档案上限、归档恢复和限流；不模拟真实边缘 CPU 配额。GitHub Actions 运行这些检查，实际结果在仓库 Actions 页查看。

## 常见问题

- **找不到 node:sqlite**：升级 Node.js 至 22.13+。
- **没有声音**：检查音量和浏览器播放权限，点击“听示范”重试。
- **不能录音**：允许本站麦克风；云端使用 HTTPS。当前只支持本地回听。
- **保存冲突**：先导出未同步记录，再载入服务器进度。
- **云端首页能开但账号失败**：打开 /api/health 检查 D1，按部署说明排错。
- **换域名后访客记录不见**：Cookie 与浏览器记录按域名隔离，登录家长账号或导入对应 JSON。

## English

**Word Adventure** is a family vocabulary app for beginner primary-school learners, with **257 entries across eight categories and real photographs for 215 entries**, photograph-based learning, 20-question quizzes, weak-word review, parent-confirmed pronunciation practice and separate child profiles.

Click a picture to hear the word. Correct answers play a cue followed by that word; incorrect answers enter review. A weak skill clears after success in three separate rounds. Small categories rotate vocabulary to complete 20 questions; repeated success within one round counts once toward mastery.

**Local setup:** use Node.js 22.13+ (tested on 22.21.1). Run **node server.mjs** from the project directory and open http://127.0.0.1:4173. No dependency installation is required. Parent accounts use data/learning.sqlite; guests use browser storage. Create an account from **账号与数据**, select a child and wait for the saved status. Stop all servers before backing up the complete data directory.

Photos and speech are bundled. Body photos can include location markers; models and missing photos are labelled. All 257 entries use one Microsoft Zira Desktop US voice. Pictures, examples and correct-answer playback share the same recordings. Slow playback preserves pitch. Legacy voice/accent preferences migrate to Zira US; learning progress and personal speed settings remain. Playback errors prompt a retry instead of changing voices. Human recordings remain credited source archives and are excluded from the Cloudflare asset bundle. Optional neural generation is not active. See the photo/audio credits for coverage, provenance and separate licensing. No overall code license is specified.

**Cloudflare Dashboard:** follow [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md). Create D1, run the schema in its Console and replace the zero database UUID through GitHub's web editor. Connect the repository to a Worker named word-adventure using branch main and the repository root. Set the Dashboard build field to **npm run build:cf** and deploy field to **npm run deploy:cf**. Assets use .cloudflare/assets; no separate output field or runtime secrets are required. Verify DB/ASSETS, /api/health and persistence on the same HTTPS URL.

**Recommended shortcut:** use the **Deploy to Cloudflare** button above. Sign in, connect GitHub, choose the project/resource names and deploy. Cloudflare provisions D1 and updates its identifier; the standard build/deploy scripts package assets, apply versioned migrations and publish. No manual SQL or database-ID copying is needed on this path. If you already own the source repository, use a different name for its new copy, such as **word-adventure-app**. Initial sign-in and authorization are still required. The manual instructions above remain available for an existing Worker/D1. Actual account deployment has not been exercised by the maintainer here; verify health and account persistence after deployment.

To migrate progress, export each child's JSON, create cloud accounts/profiles, and import into the corresponding profile. Passwords/cookies do not migrate. Do not publish private databases, backups or credentials. Child microphone recordings stay in page memory. Automatic AI scoring, password recovery and automatic conflict merging are not implemented.

Run the five local checks above. Worker contract tests use a D1-shaped SQLite adapter; actual edge CPU limits and hosting still need production verification. Check volume/permissions for audio errors and D1 health/quotas for account errors. Export unsaved progress before resolving conflicts.
