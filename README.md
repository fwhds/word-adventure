# 🌸 单词大闯关 · Word Adventure

面向小学 1—3 年级初学者的家庭英语学习网页。根据两页分类词汇整理 **257 个词、8 个类别、215 个词的配图（190 个词使用真实照片，25 个身体部位使用 AI 写实特写）**，用照片、听读和每轮 20 题练习，让孩子把不会的词集中复练。

[Cloudflare 网页部署说明](CLOUDFLARE_DEPLOY.md) · [图片出处](PHOTO_CREDITS.md) · [身体图片生成记录](AI_IMAGE_PROMPTS.md) · [声音出处](AUDIO_CREDITS.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fhuades%2Fword-adventure)

**推荐一键部署入口**：点击上方按钮，在 Cloudflare 网页登录并连接 GitHub，确认项目名称后部署。平台会创建、绑定 D1，部署流程自动初始化数据表，无需手动复制数据库 ID 或 SQL。若使用你已拥有源仓库的 GitHub 账号，请给新复制的仓库选择不同名称，例如 **word-adventure-app**。这是由平台引导的网页流程，首次登录和授权仍需本人完成。

## 主要功能

| 功能 | 使用方式 |
| --- | --- |
| 分类词库 | 每页 20 词，支持翻页、类别与搜索；点击图片直接播放英文，无词卡弹窗 |
| 图片与听力练习 | 每轮 20 题；答对有提示音并朗读对应英语，答错加入薄弱词 |
| 我的薄弱词 | 区分“不认识、听不懂、说不出、发音再练”，优先复练 |
| 已掌握词 | 词卡可手动标记，显示淡绿色光晕；自动跳过出题，支持取消后重新练习 |
| 分类测发音 | 每轮 20 题，薄弱词优先；听示范、录音回听、家长确认 |
| 示范声音 | 全部 257 词统一 Zira 美式音色，支持正常和慢速播放 |
| 家长账号与孩子档案 | 多个孩子进度分别保存，支持改名、头像、归档和恢复 |
| 备份与同步 | 登录后自动保存到服务器，可导入导出单个孩子的 JSON |

同一薄弱项在 **3 个不同轮次**中练对才会移出。累计练对至少 3 次且没有薄弱项时会自动标为掌握，也可由家长手动确认。已掌握词保留在词库，显示淡绿色光晕，并从学习、薄弱词复练和发音测试的题目中排除；仍可点击图片试听。手动标记掌握会清除该词的薄弱项；取消掌握会重置该词的练对计数，重新加入练习，保留总星星和轮次。再次标记薄弱项也会取消掌握。

待练词不足 20 个时轮换复练；若剩余词在这一轮中全部掌握，会提前完成，不再用已掌握词凑题。同一词的同一项在同一轮重复练对，只计一次掌握进度。旧版已熟悉词自动兼容为已掌握；状态随孩子档案保存，可导入导出。关闭提示音不影响英文朗读。

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
3. 在首页选择类别练习，或到分类词库点图片听英语。“跟读 / 标记”进入学习页，可以慢速听、录音回听、标记再练原因。
4. 在薄弱词页选困难类型复练；分类测发音由家长听录音后确认。
5. 家长设置可调语速与提示音；当前统一 Zira 美式，不混用其他音色。新档案默认正常速度；已保存的个人速度设置保留。
6. 登录后等页面显示 **已保存到服务器**。添加第二个孩子后切换档案再学习。访客记录可导入新档案，不自动覆盖已有孩子。

## 照片与声音

照片随网页保存，不依赖远程图片链接。25 个身体部位使用独立生成的高清 AI 写实特写，采用自然的东亚人物风格，保持完整分辨率，没有定位圈、箭头或答案标签；模型等素材明确标注。数字用数字/数量表达。仍缺合适实拍素材的词保留“暂缺实拍照片”提示。

**全部 257 个词统一播放 Microsoft Zira Desktop 的美式合成 WAV**。点击图片、听示范、答对后的朗读均使用同一音源；正常速度为 1 倍，慢速播放保持音高。旧账号的声音/口音选择会统一迁移，练习进度和个人速度设置保留。音频失败提示重试，不静默切换到其他音色。运行时不需要系统安装英语语音、联网生成或语音 API key。

32 段 Commons 真人录音保留在源码中作为有授权的参考归档，不参与网页播放，也不打包到 Cloudflare 静态资源。可选神经语音生成脚本保留，但当前未生成、未启用，不会自动改变现有播放策略。来源和生成方法见 [AUDIO_CREDITS.md](AUDIO_CREDITS.md)。

照片与 Commons 真人录音各自适用出处中列出的许可证；合成输出独立说明，不能套用真人素材的 CC 许可证。当前仓库未指定整体代码许可证。

## 手机与微信内打开

词卡使用随项目保存的 480 像素 WebP 缩略图，保持完整构图，不裁切或放大；学习详情页保留原始图片。215 张缩略图共 **6,035,298 字节**，相同图片原文件共 **38,756,065 字节**，减少约 **84.4%**。这是整套词卡图片的对比，不表示首页会下载全部图片。词库每页最多渲染 20 词，图片延迟加载，音频只在播放时请求。

Cloudflare 构建把 5 个脚本合并为 1 个延迟执行脚本，并为脚本、样式和缩略图使用内容指纹文件名与长期缓存；内容改变后 URL 自动变化。首页保留默认重新验证策略，账号接口保持不缓存。当前初始脚本 gzip 体积估算约 49 KiB，实际传输编码由部署平台决定。本地手机尺寸与限速模拟已检查；真实手机、微信内核及公网线路仍需部署后验证，不能保证固定打开时长。

普通启动和 Cloudflare 构建不需要重新生成图片。维护者新增配图后，可在项目目录安装开发依赖再运行 `npm run images:optimize`（使用 sharp）；已生成的缩略图随代码入库。来源和许可证继续适用 [PHOTO_CREDITS.md](PHOTO_CREDITS.md) 中对应原图的说明。

词库每页前 4 张图片立即加载并提示高优先级，其余保持延迟加载与浏览器自动优先级；当前题目和听力选项图片也立即加载。高优先级是浏览器提示，旧版微信内核可能忽略该提示，但仍可使用立即加载设置。若小图片本身下载很快、等待响应却很久，应比较手机 Wi-Fi/流量的访问，继续排查线路；压缩图片不能消除网络首字节等待。不要为排错清除浏览器站点数据，以免删除尚未同步的访客记录。

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

使用 **Workers + Static Assets + D1**，完整网页操作见 [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)。可使用顶部按钮创建项目，或在现有 Worker 的 **Settings → Build** 中确认关联仓库与 main 分支。

| 控制台字段 | 值 |
|---|---|
| Build command | **npm run build** |
| Deploy command | **npm run deploy** |
| Root directory | 仓库顶层 |
| Output directory | Workers 无需单独填写 |

构建 Token 需保留 Worker 发布权限并增加 **Account → D1 → Edit**；在 Cloudflare 的 **My Profile → API Tokens** 网页管理。默认构建 Token 的权限列表不包含 D1。

部署脚本使用真实 D1 ID，或按名称复用/创建数据库，先初始化表再发布。源配置不填写全零占位 ID，构建中的解析配置不入库。不要继续使用控制台默认的 **npx wrangler deploy**，它会跳过部署迁移。新版 Worker 还会在首次 API 请求发现缺表时，以幂等建表语句补齐基础表；不删除记录、不代替未来版本迁移。若 Cloudflare 关联的是一键复制的独立仓库，需要同步更新到那个副本。

当前无必填运行时密钥。部署后核对 **DB / ASSETS**、**/api/health**、登录与跨设备保存。真实 Cloudflare 权限、网络和 CPU 限额仍需上线验证；本版自动 AI 纠音未启用。

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
    node tests/deploy-cloudflare.test.mjs
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

**Word Adventure** is a family vocabulary app for beginner primary-school learners, with **257 entries across eight categories and images for 215 entries (190 real-photo entries and 25 AI-generated body closeups)**, picture-based learning, 20-question quizzes, weak-word review, parent-confirmed pronunciation practice and separate child profiles.

The library renders up to 20 words per page, with search and category filters. Cards use uncropped 480-pixel WebP copies; detail views retain source pictures. All 215 card copies total 6,035,298 bytes versus 38,756,065 source bytes (84.4% less). This is a whole-set comparison, not a first-page download estimate. Images load lazily and audio loads only when played. The production build combines five scripts into one deferred runtime and uses content-hashed runtime/CSS/card URLs with long browser caching; HTML revalidates and account APIs remain uncached. The initial runtime has an estimated gzip size of about 49 KiB. Mobile viewport and throttling simulations have been checked locally; actual WeChat/device/network speed must still be verified after deployment. Existing thumbnails are committed; maintainers can regenerate them with `npm run images:optimize` after installing development dependencies. Original image credits and licenses also cover their corresponding card copies.

The first four library pictures load eagerly with a high-priority hint; the remaining cards stay lazy with automatic priority. Current practice targets and listening-option pictures also load eagerly. Priority hints depend on browser support; eager loading remains available when older WebViews ignore the hint. If small images transfer quickly after a long initial wait, compare the phone's Wi-Fi and cellular paths before changing hosting. Image compression cannot eliminate network response latency. Avoid clearing site data while diagnosing, as unsynced guest records may be removed.

Click a picture to hear the word. Correct answers play a cue followed by that word; incorrect answers enter review. A weak skill clears after success in three separate rounds. Words with at least three successful checks and no weak skills become mastered automatically; parents can also mark mastery directly on cards. Mastered cards have a soft green glow and are excluded as targets in every practice/test mode, while remaining available for browsing and playback. Manual mastery clears that word's weak skills; undo resets its successful-check count and returns it to practice without changing total stars or rounds. A new weak-skill mark also revokes mastery. Mastery syncs with child profiles and JSON backups; legacy familiar words migrate automatically. Pending words rotate to complete 20 questions, but rounds finish early when all remaining words become mastered. Repeated success for the same skill within one round counts once toward mastery.

**Local setup:** use Node.js 22.13+ (tested on 22.21.1). Run **node server.mjs** from the project directory and open http://127.0.0.1:4173. No dependency installation is required. Parent accounts use data/learning.sqlite; guests use browser storage. Create an account from **账号与数据**, select a child and wait for the saved status. Stop all servers before backing up the complete data directory.

Photos and speech are bundled. All 25 body words use dedicated high-resolution AI-generated closeups with a natural East Asian visual style, retaining full source resolution without enlarged crops, location markers or answer labels; models and missing photos are labelled. All 257 entries use one Microsoft Zira Desktop US voice. Pictures, examples and correct-answer playback share the same recordings. Slow playback preserves pitch. Legacy voice/accent preferences migrate to Zira US; learning progress and personal speed settings remain. Playback errors prompt a retry instead of changing voices. Human recordings remain credited source archives and are excluded from the Cloudflare asset bundle. Optional neural generation is not active. See the image/audio credits and AI_IMAGE_PROMPTS.md for coverage, provenance, prompts and separate licensing. No overall code license is specified.

**Cloudflare Dashboard:** follow [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md). Use branch **main**, the repository root, **npm run build** and **npm run deploy** in the Dashboard fields. Keep Worker deployment permissions and grant the build token **Account → D1 → Edit** in Cloudflare's secure profile interface. No separate output field or runtime secrets are required.

The template omits fake IDs; the deployment script honors a real ID or reuses/creates an exactly named D1, applies migrations before publishing and preserves progress. Replace the default deployment command, which skips migrations. As a fallback, the Worker checks its database on the first API request and applies idempotent initial DDL only when tables are missing; existing records are preserved. This fallback does not replace future versioned migrations. Confirm that the connected repository contains the update; button-created copies do not sync automatically. Verify DB/ASSETS, **/api/health** and saving on the same HTTPS URL. Account deployment and CPU limits remain live checks.

To migrate progress, export each child's JSON, create cloud accounts/profiles, and import into the corresponding profile. Passwords/cookies do not migrate. Do not publish private databases, backups or credentials. Child microphone recordings stay in page memory. Automatic AI scoring, password recovery and automatic conflict merging are not implemented.

Run the six local checks above. Worker contract tests use a D1-shaped SQLite adapter; actual edge CPU limits and hosting still need production verification. Check volume/permissions for audio errors and D1 health/quotas for account errors. Export unsaved progress before resolving conflicts.
