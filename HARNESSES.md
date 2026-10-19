# 在非 DSH harness 中使用

> 这三份技能最初为 **DSH** 写。核心流程（检索 → 采集 → 成文）**不依赖 DSH**；
> `SKILL.md` 按 [Agent Skills](https://agentskills.io/specification) 规范组织，
> 因此也能在 **pi**、**Claude Code**、**Codex**、**Gemini CLI** 等 harness 里加载。
>
> 本文只讲「换 harness 时要改什么」，不重复技能正文。
> 目录约定会随 harness 版本变化；安装前以各 harness 的官方文档为准。

---

## 0. 一句话结论

| 东西 | 换 harness 后 |
| --- | --- |
| `name` / `description` / 正文 / `references/` | ✅ 直接用 |
| `license: MIT` / `compatibility` | ✅ Agent Skills 规范字段；规范兼容的 harness 会接受（不一定参与路由） |
| `whenToUse` | ⚠️ **只有 DSH 读**。其它 harness 静默忽略；路由靠 `description` |
| `~/.dsh` 路径、DSH 会话记录 | ⛔ DSH 专属，换 harness 后不再有 |
| DSH 检索工具名、`pwsh` 配方、引擎矩阵 | ⛔ DSH 专属，按 §2／§4 替换 |
| `tools/check.mjs` / `tools/publish.mjs` | ✅ 零依赖 Node 脚本，Windows / macOS / Linux 都能跑 |

**没有某项能力时，把它写进缺口清单（`03_变更与缺口.md`），不要假装搜过。**
这是这三份技能自己的纪律，换 harness 也不变。

---

## 1. 装到哪

| Harness | 个人／用户目录 | 项目目录 | 怎么调用 |
| --- | --- | --- | --- |
| **DSH** | `<dshHome>/skills`（默认 `~/.dsh/skills`） | `<项目根>/.dsh/skills` | 按 `description` 自动路由；`whenToUse` 也参与 |
| **pi** | `~/.pi/agent/skills/` | `<项目根>/.pi/skills/` | `/skill:wiki-collect` |
| **Claude Code** | `~/.claude/skills/` | `.claude/skills/` | `/wiki-collect` |
| **Codex** | `~/.agents/skills/` | `.agents/skills/`（逐级向上扫描） | `$wiki-collect` 或 `/skills` 选择 |
| **Gemini CLI** | `~/.gemini/skills/` 或 `~/.agents/skills/` | `.gemini/skills/` 或 `.agents/skills/` | `/skills list`；模型调 `activate_skill` |
| **其它 Agent Skills harness** | `~/.agents/skills/` | `.agents/skills/` | 看该 harness 文档 |

> 目录名必须匹配 `SKILL.md` 里的 `name`。**别为了整理目录多套一层** ——
> 必须是 `<skills>/wiki-collect/SKILL.md`，不是 `<skills>/my-skills/wiki-collect/SKILL.md`。

### 复制安装（macOS / Linux）

```bash
# 任选一个目标；pi 用户可以换成 ~/.pi/agent/skills
target="$HOME/.agents/skills"
mkdir -p "$target"
cp -R wiki-collect wiki-write zhihu "$target/"
```

### 复制安装（Windows PowerShell）

```powershell
# 任选一个目标；Claude Code 用户可以换成 $HOME\.claude\skills
$target = "$HOME\.agents\skills"
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Recurse -Force .\wiki-collect, .\wiki-write, .\zhihu $target
```

Claude Code、Codex、pi 都支持把技能目录做成**符号链接**；想「改仓库即生效」可以用
`ln -s "$PWD/wiki-collect" "$target/wiki-collect"`（Windows 用 `New-Item -ItemType SymbolicLink`）。

---

## 2. 工具名映射

技能正文里的「读 / 写 / 跑命令 / 抓网页 / 搜索」是**能力**，不是某个 harness 的专有工具名。
按你手上的工具替换：

| 能力 | DSH 里的名字 | 其它 harness 常见叫法 |
| --- | --- | --- |
| 读文件 | `read` | `Read` / `read_file` / `read` |
| 写／改文件 | `write` / `edit` | `Write` / `Edit` / `apply_patch` |
| 跑命令 | `bash` / `pwsh` | `Bash` / `shell` / `run_shell_command` |
| 抓网页 | `web_fetch` | `WebFetch` / `web_fetch` / `curl -L` |
| 网页搜索 | `advanced_search` / `multi_search` / `free_search_test` | `WebSearch` / `google_web_search` / `web_search` / 搜索引擎 API |
| 代码平台搜索 | `platform_search` | `gh search` / GitHub API / 平台自带搜索 |
| 并行子代理 | 子代理 | subagent / task / `context: fork` |

⛔ **DSH 的 `advanced_search` / `multi_search` / `free_search_test` / `platform_search` 不是通用工具名。**
换 harness 后按这个顺序处理：

1. 用该 harness 的搜索／抓取工具；
2. 没有就退回 `curl` / `gh` / 官方 API（见 §4）；
3. 都没有 → **记为缺口**，并在交付说明里写清哪一步没做。

---

## 3. DSH 专属内容清单

看到下面这些，知道它们是 **DSH 环境的事实**，不是这套方法的前提：

| 位置 | 内容 | 非 DSH 怎么办 |
| --- | --- | --- |
| `SKILL.md` frontmatter | `whenToUse` | 忽略；用 `description` 路由。要上传 claude.ai / Skills API 时，按规范删掉它或移进 `metadata.whenToUse` |
| `wiki-collect/SKILL.md` §11 | `~/.dsh/sessions/**` 会话记录 | 这是 DSH 的历史溯源方式；换 harness 后改用你自己的会话记录／笔记 |
| `zhihu/SKILL.md` | 「DSH 检索工具速查」、引擎可用性矩阵 | DSH 扩展工具与引擎的现状；**不可迁移**，按当地能力重测 |
| `zhihu/SKILL.md` | `pwsh` 配方、PowerShell 编码坑 | Windows/DSH 写法；bash/zsh 用 §4 的 `curl` / `gh` 等价命令 |
| `zhihu/SKILL.md` | 「当前 DSH profile 没有浏览器 / CUA」 | DSH profile 的限制；别的 harness 可能有浏览器，**按当地能力重测，别当普适结论** |
| `README.md` | DSH 的五个加载根、rank 表 | 见本文 §1 |
| `对接文档.md` | DSH 工作副本／发布仓库的同步流程 | 只对技能作者有效；使用者不用管 |

`_work/`、`_src/`、`00_选题卡.md` … `07_交付说明.md` **不是** DSH 专属，
它们是普通的文件约定，换 harness 照旧。

---

## 4. POSIX 等价配方

`zhihu` 里的 PowerShell 配方在 macOS / Linux 上按下面改写。**不要照抄 `Invoke-*`。**

### 抓网页

```bash
curl -L -A 'Mozilla/5.0' --max-time 45 'URL' -o page.html
```

### GitHub 仓库搜索

```bash
# 有 gh 时最省事
gh search repos 'unreal chunk pak' --limit 6 \
  --json fullName,stargazersCount,description

# 没有 gh 时直接走 API
curl -s -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/search/repositories?q=unreal+chunk+pak+in:name,description&sort=stars&per_page=6'
```

### 量必读集大小（替代 `wiki-collect` 里的 PowerShell）

在 `wiki-collect/` 目录下运行：

```bash
for f in references/采集-代码.md references/采集-剧本与设定.md references/素材账本字段.md SKILL.md; do
  printf '%8d B  %s\n' "$(wc -c < "$f")" "$f"
done
```

---

## 5. 验证装好了没

### 跑仓库自带的自检

```bash
node wiki-collect/tools/check.mjs --implemented
node wiki-write/tools/check.mjs  --selftest
node wiki-write/tools/publish.mjs --selftest
```

⚠️ `wiki-collect/tools/check.mjs --selftest` 跑完会拿**当前目录**当专题再查一遍，
在仓库根会报「找不到 `01_素材账本.md`」并以退出码 1 结束。**那不是安装失败**，
原因写在 `README.md` 的「快速开始」里。

### 在 harness 里调用

| Harness | 验证命令 |
| --- | --- |
| pi | `/skill:wiki-collect` |
| Claude Code | `/wiki-collect` |
| Codex | `$wiki-collect` 或 `/skills` |
| Gemini CLI | `/skills list` |
| DSH | 直接说「先采集素材」，看它是否按 `description` 命中 |

---

## 6. 兼容性边界

- **需要文件读写 + 命令执行**。纯聊天、不能落盘的 harness 可以读 `SKILL.md` 当提示词，
  但账本／草稿／检查器都要手动搬。
- **`zhihu` 需要联网**。没有网络或没有搜索工具时，把检索阶段标成缺口，不要编来源。
- **Windows 不是前提**。PowerShell 片段只是 DSH 在 Windows 上的现成配方；
  macOS / Linux 用 §4 的等价命令。
- **没有在所有 harness 上实测过**。pi 1.3.0 的技能发现已实测（`loadSkills` 返回三份技能、零诊断）；
  Claude Code / Codex / Gemini CLI 的目录与字段按各自官方文档核对，安装前请以当地版本为准。

官方文档：

- Agent Skills 规范：<https://agentskills.io/specification>
- Claude Code skills：<https://code.claude.com/docs/en/skills>
- Codex skills：<https://learn.chatgpt.com/docs/build-skills>
- Gemini CLI skills：<https://geminicli.com/docs/cli/skills/>
- pi：<https://pi.dev>
