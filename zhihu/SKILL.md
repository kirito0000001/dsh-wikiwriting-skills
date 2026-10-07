---
name: zhihu
description: 动手前先查别人走过的路。固定流程：先多轮检索并建立候选清单，再统一研读知乎/CSDN/GitHub/官方文档，最后自己验证（实跑一次 / 一手原文 / 官方页自验）。适用于实现新功能、改不熟悉的第三方插件、验证机制是否生效、排查说不清的故障、技术选型与规范调研，尤其是引擎、构建、打包、热更新这类黑盒；写「资料搜集 / 方案对比」类文档时同样适用。用户说「开始做 / 动手 / 验证 / 查一下原因 / 研究一下 / 调研一下 / 先搜集资料」时触发。
---

# Research First

**在动手之前先查别人走过的路。** 目的只有两个：不重复造轮子，不绕大弯子去踩别人已经踩过的坑。

## 什么时候必须跑这个流程

- 要**实现**一个新功能、或改一个不熟悉的第三方插件
- 要**验证**一个机制（"这个功能到底生不生效"）
- 要**排查**一个说不清原因的故障
- 要**调研**一个不熟的技术方向、或要产出「资料搜集 / 方案对比 / 规范清单」类文档
- 任何涉及**引擎/构建/打包/更新**这类"黑盒感很强"的东西

**判断标准**：如果这件事"别人大概率做过"，就先查。

> 两类任务的侧重不同：**代码黑盒类**重点是"少踩坑、别重造轮子"；**调研类**重点是"先摸清总共有多少方案/规范，再决定做什么"——后者尤其要防"只读了前三条结果就开写"。

## 流程：完整检索 → 统一研读 → 自行验证

### 阶段 1 · 完整检索（Search Gate）

这一阶段只做发现、扩展关键词和建立候选清单。先不要顺着第一篇文章或第一个仓库继续深入。

至少跑完这几组检索：

1. 用户原词 + 同义词 + 中英文术语。
2. 报错原文 + 机制名 + 引擎/框架/插件版本。
3. `site:zhihu.com` 站内检索（用下面的工具矩阵）。
4. 如果这件事可能有人开源成仓库、插件或模板，再补 GitHub 检索。

#### 多轮检索的角度清单（照这张表铺查询，别每次从零想）

| # | 角度 | 查询怎么写 |
| --- | --- | --- |
| 1 | 中文原词 | 用户原词 + 同义词 |
| 2 | 站内中文实践 | `site:zhihu.com <关键词>`（`multi_search` 里**显式**指定 engines） |
| 3 | 英文术语 | 英文同义词 + 领域词（英文一手资料常比中文转载好） |
| 4 | 官方一手 | `<产品> official docs`、`site:<官方域名>` |
| 5 | 标准 / 法规 | 标准号、法规名、法律名（**版本年必须核**，见阶段 3） |
| 6 | 机制 / 报错 | 报错原文 + 机制名 + 版本号 |
| 7 | 同类仓库 | GitHub 仓库 / 插件 / 模板（见「二、GitHub」） |
| 8 | 工具链 | 相关 CLI / linter / 脚手架（规范类必有可执行实现） |
| 9 | 反例与坑 | `<方案> 坑 / 失败 / 不生效 / 常见错误` |
| 10 | 时效 | 加年份，或用 `timeRange`（规范会换版、引擎会挂） |
| 11 | 方案对比 | `A vs B`、`<领域> 选型`（选型类任务必备） |
| 12 | 缺口自查 | 把已命中标题里的**新词回灌**再搜，直到只回重复项 |

**操作手法**：一次并行发 5–8 条查询（单发一轮太慢，且容易过早深入）；每条换**角度**，别换同义词重发。

把结果整理成候选清单，先判断"搜完了没有"，再决定读什么：

| 来源 | 一手/二手 | 标题 / 仓库 | 链接 | 为什么可能相关 | 可抓性 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 知乎 / CSDN / GitHub / 官方文档 / 标准 | 一手 / 二手 | ... | ... | 对应用户问题中的哪一条线索 | ✅直抓 / 🔶需试 `/tardis/` / 🔒付费登录 | 高 / 中 / 低 |

> 后两列不是装饰：**可抓性**决定后面怎么读，**一手/二手**决定它能不能当结论。

**信源质量红线**：SEO 农场、工具推广页（降重/代写/查重/AI 检测）、无署名转载、纯营销页 —— **只当线索，不进结论**。搜"AI 味 / 写作规范"这类词时尤其容易被它们淹没。

**阶段完成条件：**

- 已经覆盖问题、报错、机制和版本等不同查询角度。
- 新增查询开始只返回重复项或明显无关项。
- 候选清单已经列出主要文章、仓库和官方来源。
- 此时仍停留在检索阶段，尚未开始逐篇精读。

只有满足这些条件，才进入阶段 2。

#### DSH 检索工具速查（2026-10-06 复测）

> ⚠️ **这张表会过期。** 实测 4 天内 firecrawl 从 ✅ 变 ❌、keenable 从 ❌ 变 ✅。
> **拿不准就先体检，别拿旧表当现状**：

```
free_search_test(query="site:zhihu.com 关键词")     # 不传 engines，走默认全量
```

⚠️ **别传 `multi` / `auto`** —— 会触发输出 schema 校验错误，整条体检直接崩：
`"value.results[17].engineUsed" is not a declared property`。

**站内检索主力 —— 一条命令搞定：**

```
multi_search(engines=["tavily","exa","deepseek-official"],
             query="site:zhihu.com <关键词>", maxResults=8)
```

返回结果带 `[seen in: tavily, exa]` 交叉来源标记 —— 被多个引擎同时命中的那篇，通常最值得读。

⚠️ **必须显式写 `engines=`**：`multi_search` 的默认引擎由 smart route 挑，可能混进**不认 `site:` 的引擎**（keenable / bing），把站内检索污染成全网检索。

**各引擎实测矩阵（2026-10-06）：**

| 引擎 | 可用 | 认 `site:` | 摘要厚度 | 定位 |
| --- | --- | --- | --- | --- |
| **tavily** | ⚠️ 可用但**有每日额度**：10-06 晚实测 **`HTTP 429 daily_cap_reached`**（`You reached the daily keyless Tavily limit`）后**当天彻底不可用**；另有偶发 `This operation was aborted` | ✅ 命中知乎 | 中 | 站内检索主力，但**额度耗尽后立刻换引擎**，别死等 |
| **exa** | ✅ 但会**瞬时 429** | ✅ 部分 | **最厚，常带整段正文原文** | 找 `/tardis/` 链接 + 要厚摘要 |
| ⚠️ **回落信号（要分情况）** | exa 失败时 `advanced_search` **自动回落 keenable 并打印** `Search (keenable)` + `Note: exa failed (transient)… using keenable` | — | — | **① 查询带 `site:` 或指望站内命中 → 整批丢掉**（实测有组收到「耳机测评 / 大路灯选购」当"性能测试"结果）；**② 查询本来就不带 `site:`（纯英文术语/专名）→ 回落结果反而准**，可逐条 HTTP 自验后使用 |
| **deepseek-official** | ✅ **召回最广（实测约 60% 的一手命中靠它）** | ✅ 命中知乎 | ❌ 只有标题无摘要 | **拿它铺面，不只是补漏** —— 它常能捞出 tavily/exa 都没命中的一手官方页 |
| **parallel** | ✅ | ✅ 能命中知乎 | 中 | 可用，本次两条查询都命中知乎教程 |
| anysearch | ✅ | ⚠️ 部分 | 中 | 备用 |
| **keenable** | ✅ **10-06 起已可用**（旧记录是 ❌ MCP failed） | ❌ **忽略 `site:`**（查知乎返回美团报告、标点科普） | 中 | 只能用于**不带 `site:`** 的宽查询 |
| **bing** | ✅ | ❌ **完全忽略 `site:`** | 中 | **用户指定的可信搜索源**（Edge 的默认搜索引擎）；查**站内**别用它，站内一律走 `multi_search` |
| **firecrawl** | ❌ **10-06 起全程 403** `[auth]`（IP 被判定可疑 + 无 key） | — | — | 暂不可用，别指望 |
| ddg / ddg-lite | ❌ `connection error: fetch failed` | — | — | 不可用 |
| searxng | ❌ 所有实例 aborted | — | — | 不可用 |
| baidu / kimi / doubao / aliyun / perplexity / you / serpbase / serply | ❌ **未配置 API key** | — | — | 不可用；**baidu 不必再试（用户明确不要）** |

- ⚠️ `advanced_search(engine="baidu")` 没 key 时**会 fallback 到 exa，但会明确打印**：
  `baidu unavailable or failed (BAIDU_API_KEY is not configured), using exa.`
  —— 看到这行就知道结果其实是 exa 的（**不是静默**，旧记录写错了）。
- ❌ **不要用 `web_search`** —— 它**忽略 `site:`**，会返回百度百科「知」字条、知网这类完全无关的东西。
- ❌ **不要用 `platform_search("zhihu")`** —— 不支持。可用平台只有：
  `github / v2ex / bilibili / reddit / hn / stackoverflow / wikipedia / npm`。

### 阶段 2 · 统一研读

按候选清单的相关性批量研读，不按搜索引擎出现顺序"找到一个读一个"。每篇只提取：

- 可复用的实现或模板。
- 明确的踩坑、限制和前置条件。
- 与其他来源冲突的结论。
- 需要拿源码、官方文档或实跑继续验证的问题。

**预算控制**：别一次读十几篇。先读**决定骨架的 5–8 篇**（通常是：一份官方一手 + 一份标准/规范 + 一份同类实现 + 一份踩坑笔记），读完再决定要不要扩。

当剩余候选不再产生新线索，或只重复已有结论时，阶段 2 完成。

### 阶段 3 · 自行验证

把阶段 2 得到的线索，拿到**一手来源**里证实。

**知乎、CSDN、GitHub 都是线索，不是结论**；拿到线索必须自己验一遍（本技能红线第 2、3 条）。

**「跑一次」在不同任务里的等价物：**

| 任务类型 | 验证手段（等价于"实跑一次"） |
| --- | --- |
| 代码 / 机制 / 打包热更 | 真跑一次，读**直接结果**（红线 3） |
| 规范 / 文档 / 选型调研 | ① 找**一手原文**（标准正文、官方页、法律文本）；② **链接可达性自验**：批量跑 HTTP 状态码（`Invoke-WebRequest -Method Head` 或降级 GET）；③ **版本核实**：现行版到底是哪一版（例：GB/T 7714 是 2015 还是 2025） |
| 数据 / 结论类 | 自己复算一遍，别信转述 |
| 环境 / 版本差异 | 列出可复现命令 + 时间戳，别只写"我试过了" |

**GitHub 何时进入检索阶段：** 只在「**这件事有没有可能有人做成仓库**」时才补一轮：

| 事情的性质 | 补 GitHub 吗 | 例子 |
| --- | --- | --- |
| 有人可能开源成**仓库 / 插件 / 工具 / 模板 / 脚手架 / Mod / 库 / 示例工程** | **要** | 「有没有现成的分包插件」「有没有现成的下载器」「有没有人写过这个工具的模板」 |
| 基本不会有人开源（引擎内部行为、版本差异、某次打包为什么失败） | **不用** | 「这个开关到底生不生效」「为什么报这个错」 |

## 三个来源

### 一、知乎 —— 有没有人踩过同样的坑

中文实践笔记里的"注意事项"，全是血泪。

**摘要先回填候选清单。** 阶段 1 只负责判断哪几篇值得读；阶段 2 才开始精读，阶段 3 再验证。

摘要里经常直接就有答案（例：某篇的"注意事项1：资产命名不要用中文，否则资源不会进指定 chunk，而是落 chunk0"）。

#### 读全文：四级阶梯（知乎对直抓是全面拒绝的）

先把**死路**列清楚，别再踩：

| 路线 | 实测 |
| --- | --- |
| `https://zhuanlan.zhihu.com/p/<id>` | ❌ **HTTP 403** |
| `https://www.zhihu.com/question/<id>` | ❌ **HTTP 403** |
| `https://www.zhihu.com/api/v4/articles/<id>` | ❌ 403 `{"error":{"message":"请求参数异常，请升级客户端后重试。","code":10003}}` |
| `https://www.zhihu.com/market/pub/...`（盐选） | ❌ **付费墙**，正文拿不到，别浪费时间 |
| `https://r.jina.ai/<知乎链接>` | ❌ `fetch failed` |
| `https://web.archive.org/web/2024/<知乎链接>` | ❌ `fetch failed` |

**但知乎给外部搜索引擎开了一条分发路由 `/tardis/`，它返回完整正文。**

**阶梯 1 —— exa 找 `/tardis/` 链接，直接抓全文（最省事）**

用 `advanced_search(engine="exa", ...)` 检索时，exa 索引的往往就是分发版本，**返回的 URL 直接就是 `/tardis/` 形式** —— 这种 URL 直接 `web_fetch` 就能拿全文：

```
https://www.zhihu.com/tardis/bd/art/<文章id>     ← 实测 700765767 ✅
https://www.zhihu.com/tardis/zm/art/<文章id>     ← 实测 606970716 ✅、669095458 ✅、518011077 ✅
https://www.zhihu.com/tardis/bd/ans/<回答id>     ← 实测 532061138 ✅ **回答走这条**（问题页 403 时尤其要试）
```

拿到的是干净的完整正文：Markdown 标题、代码块、图片链接、作者、赞同/收藏数、编辑时间全都有。

**阶梯 2 —— 自己把规范链接改写成 tardis 形式**

拿到 `https://zhuanlan.zhihu.com/p/561855544`，抠出末尾数字，试：

```
web_fetch("https://www.zhihu.com/tardis/bd/art/561855544")
```

⚠️ **只有「确实被分发给外部搜索引擎」的文章才有效**，不通用。实测 `p/700765767` 成功、`p/561855544` 失败。

失败特征很好认 —— HTTP 200，但正文是：

```
你似乎来到了没有知识存在的荒原...
```

（URL 会跳到 `/tardis/error?status=400`）。**失败就是这篇没被分发，别反复重试、别换渠道号硬试**（`/tardis/bd/art/`、`/tardis/zm/art/`、`/tardis/sogou/art/`、`/tardis/bd/ans/` 只在「这篇被分发过」这一点上一致，渠道号换来换去没用）。

> 📊 **实测汇总（多组独立验证）：`art` 路由命中率极低，`ans` 路由相对可靠。**
> - 一组针对性检索：**32 条知乎链接试 `/tardis/`，只有 3 条抓到全文**（≈9%）
> - 另一组：**9 个文章 id × 3 种 `art` 路由 = 18 次请求，全部是 858–1165 字节空壳**（`<title>知乎</title>`，正文零字）
> - 换渠道号（`zm` / `sogou` / `bd`）**9/9 同样是 1165 字节空壳** → **换号确实无用，别再试**
> - 而**答案路由 `/tardis/bd/ans/<答案id>` 被多组独立实测有效**（拿到 19.9 KB / 15.6 KB 真正文）
>
> **→ 结论：优先试 `ans`；`art` 按"大概率失败"预期。** 抓不到就立刻退到 **exa 厚摘要**（阶梯 3）或换非知乎来源（阶梯 4），不要围着它转。
> **两个判据**：① 正文长度 **< 2 KB** 直接判无效；② 顺手看一眼 `<title>` —— 空壳页的 title 就是"知乎"两个字。

**阶梯 3 —— 拿不到全文，就用"厚摘要"**

`advanced_search(engine="exa")` 的摘要经常直接包含正文大段原文（几百字）。**用文章标题当查询词**去命中那一篇，往往就能捞到关键段落 —— 够判断"这篇讲的是什么、值不值得继续追"。

**阶梯 4 —— 换非知乎来源（很多时候比知乎好）**

知乎只是"中文实践笔记"密度较高的地方，不是唯一。同一次检索里经常冒出更专业的独立博客。

**用户信源偏好（2026-10-06 设定）**：主用**知乎**；**CSDN 认作者不认站**（用作者专栏 / 首发链接，别用站内搜索结果——搬运和洗稿号极多）；搜索源用 **Bing**（Edge 的默认搜索引擎，不限单一网站）；⚠️ 但它**忽略 `site:`**，所以站内检索仍必须走 `multi_search` 且显式指定 engines；**baidu 不搜**（广告太多）。

| 领域 | 实测高价值站 |
| --- | --- |
| 虚幻引擎 / 热更新 | `ue5wiki.com`（虚幻社区知识库）、`imzlp.com`（循迹研究室，HotPatcher 作者，还有 PDF 演讲《UE4全平台热更新方案》） |
| 通用中文技术 | **CSDN（认作者）**、博客园、掘金、InfoQ、开源中国、V2EX、indienova |
| 官方一手 | 产品官方 docs、标准发布平台、期刊 author guidelines |

**这些站大多可以 `web_fetch` 直接抓全文**，比死磕知乎划算得多。

> ⚠️ **图片读不了**：当前 DSH profile **没有安装浏览器 / CUA 插件**，
> 知乎正文里的"红框标注"截图**无法读取**。
> 遇到关键信息只在图里的情况，只能靠上下文文字推断，或请用户自己打开看。

### 二、GitHub —— 有没有人已经实现了

先查现成实现，再考虑自己写。**能改别人的就别自己造。**

**第一步：短关键词走原生工具**（查询式别超过 3–4 个词）：

```
platform_search(platform="github", query="unreal chunk pak")
```

⚠️ 实测：`unreal engine` 能正常返回 5 条带 star 的结果；但 `academic writing style guide awesome` 这种**长查询式会直接 `No results found`**（2/2 空手）。**空手别反复重试，直接切 API**；`stackoverflow` 平台本次全空，别指望。

**第二步：走 API**（DSH 的 `pwsh` 可以直接调）：

```powershell
$h=@{'User-Agent'='Mozilla/5.0';'Accept'='application/vnd.github+json'}
$q='unreal chunk pak in:name,description'          # 查询式必带 in:name,description，否则经常 total_count=0
$u='https://api.github.com/search/repositories?q=' + [uri]::EscapeDataString($q) + '&sort=stars&per_page=6'
(Invoke-RestMethod -Uri $u -Headers $h -TimeoutSec 45).items |
  ForEach-Object { '{0}  <{1}>  {2}' -f $_.full_name,$_.stargazers_count,(("" + $_.description).Substring(0,[Math]::Min(120,("" + $_.description).Length))) }

# 看某个作者/组织的全部仓库（找同系列的配套插件、模板、Mod）
Invoke-RestMethod -Uri 'https://api.github.com/users/<user>/repos?per_page=100' -Headers $h |
  ForEach-Object { '{0,-38} {1}' -f $_.name,$_.description }
```

三条实测坑：

- **`per_page` 取 5–6，并截断 `description`** —— 不截断时，某个仓库的超长 description 会把整段输出淹没（实测被 3 万字符的无关 JSON 冲掉一整轮）。
- 查询式用 `[uri]::EscapeDataString($q)` 拼，别手拼 `+`。
- `total_count=0` 的常见原因就是漏了 `in:name,description`。

**重点看**：有没有配套的 **Mod 模板 / 脚手架 / 示例工程**。作者开源的模板，往往比自己从零搭省一个量级。

### 三、非知乎中文博客 —— 别死磕

见上面「阶梯 4」。**检索阶段就顺手看一眼有没有更专业的独立博客**，
有的话它优先级高于知乎：排版干净、能直抓、作者通常就是插件作者本人。

## 产出：结论必须带出处

查完的结论**写进当期设计文档**，并且**带上来源链接**。格式：

```
> 出处：<标题>（<URL>）
> 原文："……"
> 我们的验证：<用自己的数据验了什么、结论是什么>
```

**只写"查到了什么"不够，要写"用我们自己的数据验证后成立/不成立"。**

**落地约定**：

| 产物 | 命名 / 位置 |
| --- | --- |
| 阶段 1 的搜集清单 | `<专题目录>\00_资料搜集清单.md`（如 `E:\DeepseekWork\<专题>\`），含检索角度记录、候选清单、空白项 |
| 阶段 2/3 的结论 | 当期设计文档，逐条带 `出处 / 原文 / 我们的验证` |
| 引擎与站点状态 | 回写本技能的表（矩阵、访问性黑名单），下次不用重测 |

## 红线

1. **查得到就别自己造。** 尤其是别人开源了模板/Mod 的情况。
2. **摘要不等于结论。** 别人说的必须用自己的数据验一遍。
3. **不要拿间接证据当结论。** "字段写对了""别人调了这个 API"都不等于"结果正确"——必须跑一次拿到直接结果。
4. **结论要能复现。** 写清命令行、文件路径、时间戳，别只写"我试过了"。
5. **验证的顺序**：写 → 跑 → 读结果，三步在同一条时间线上；**不要拿历史产物跟新改动做交叉比对**（这是最容易得出反向结论的陷阱）。
6. **信源要分账。** SEO 农场、工具推广页、无署名转载**不是证据**；官方页/标准原文/法律文本才算。链接"能打开"也不等于内容已读。

## 反面教材（真实发生过的）

1. 看到"写入标签的代码字段都正确" + "某个成熟插件调用了同一个引擎 API"，就断言"机制可用"——
   结果跑一次真实打包，**什么都没发生**。间接证据 ≠ 结论。
2. 拿一份**改动之前**生成的 csv，去比对**改动之后**的标签，得出"标签不生效"——
   **时间线错位**。后来才发现两份产物根本不在同一个时间线上。
3. 把 4 天前写的引擎状态表当现状用 —— 那张表上 firecrawl 还是"✅ 主力"，实际早已 403；
   反过来 keenable 从"❌ 不可用"变成了可用。**状态表是基线，不是事实。**

如果一开始就按这个流程查，这三次都能省掉。

---

## 实战补充（逐条都是真事）

### 检索

| 坑 | 事实 | 正确做法 |
| --- | --- | --- |
| `web_search` 查站内 | 它**忽略 `site:`**，返回的全是无关结果 | 站内检索用 `multi_search`，**显式写 engines** |
| 默认引擎污染站内检索 | `multi_search` 默认引擎由 smart route 挑，会混进不认 `site:` 的 keenable / bing | 站内检索一律显式 `engines=[...]` |
| 拿旧状态表当现状 | firecrawl 4 天内 ✅→❌，keenable ❌→✅ | 先 `free_search_test` 复测，再看表 |
| `free_search_test` 传虚拟模式 | 传 `multi` / `auto` 会触发 schema 报错整条崩掉 | 不传 `engines`，走默认全量 |
| GitHub 查询式太长 | 4 个词以上经常 `No results found`（`unreal engine` 却正常） | 短关键词；空手立刻切 API |
| GitHub 搜不到 | 不带限定词经常 `total_count=0` | 查询式带 **`in:name,description`** |
| GitHub API 输出被淹没 | 超长 description 会把整段输出冲掉 | `per_page` 5–6 + 截断 description |
| **GitHub API 未认证限流（行为不稳定）** | **两次实测互相矛盾**：一组约 10 次后 403，且 `Sleep 3 / 6 / 7 / 8` 秒**全无效**、要等分钟级才恢复；另一组 **12 次（Sleep 2–3s）完全没 403** | 它是**不稳定限流，不能按固定次数预期** → 保守做法：**每轮 ≤4 条、间隔 10s+**，并做好"403 后等分钟级"的准备；`raw.githubusercontent.com` 比 `github.com` 网页稳（网页会 429） |
| **GitHub 搜不到某领域的现成件** | 实测 `reverse outline` / `information mapping` / `topic based authoring` **无一相关**（命中二进制逆向、网络测绘、LDA 主题模型）；`game config table` / `lore management` 4/4 成功但**全是噪声** —— **成体系的 skill 常常不以领域词命名** | 换路线：① 搜相邻大词（`writing`、`claude`）→ 逐个读 **`SKILL.md` 内容**确认；② 直接搜 **skill 生态站**（`skillsmp`、`lobehub`、`agent-skills.md`）。本次最有价值的几个同类技能都是这么挖出来的 |
| **搜索结果给的链接是错的** | 实测某篇文章搜到的 **4 个 URL 全是错误 slug（全 404）**，而它确实存在 | **拉站点的 `sitemap.xml`，用正则筛标题关键词** → 拿正确路径。这个方法可复用，别在错的 slug 上反复试 |
| **决定命中率的不是引擎，是查询里有没有"机制专名"** | 带专名（`Luban`、`Cargo`、`Semantic MediaWiki`、`stat block`、`data dictionary`、`Single Source of Truth`）**一击即中**；抽象词（`consistency`、`continuity`）**基本无效** | 先问"这件事在**实现层**叫什么"，用那个词去搜；搜不到再退回抽象词 |
| GitHub 查询式缺限定词 | 不带 `in:name,description` 时会返回 **10 万+ 噪声** | 查询式**必带** `in:name,description` |
| **"200 但无效"（两种形态）** | ① **参数被忽略**：字节数与首页完全相同（`wga.org?page=WGA_Script_Format_Guide` 与首页都是 **99603** 字节 → 该页不存在）；② **固定空壳**：知乎 `/tardis/` 对**未分发**内容返回 **HTTP 200**，正文恒为 **858–1165 字节**的"荒原"页 —— 只看状态码会把 **9 篇全误标成"可抓"** | **链接自验必须"状态码 + 正文长度"双看**：跟首页或已知空壳页**比长度**，短到不合理（<2KB）直接判无效 —— 否则要等研读时才发现全是空壳 |
| **HEAD 会大面积假死** | `gamedeveloper.com` 全站 HEAD **500**、`indienova.com` HEAD **405**、`docs.yarnspinner.dev` HEAD **500**，而 **GET 全部 200**（含 499–521 KB 全文）→ **只跑 HEAD 会把 12 条可用链接误判成死链** | **默认用 GET**；HEAD 失败**必须降级 GET 后**才允许判死。别把 HEAD 的 500/405 当结论 |
| `platform_search(github)` 长查询跑偏 | 查 `"art of readme"` 返回的是 **ASCII art** 仓库与个人主页 README | 只用**专名短查询**（`standard readme`、`fountain screenplay`）；命中不对立刻切 API |
| 只用一家引擎 | tavily 会偶发 abort，**还有每日额度**（429 `daily_cap_reached` 后当天不可用）；deepseek-official 没有摘要 | 至少三个引擎一起发（`multi_search` 就是干这个的）；额度耗尽时改走 exa / deepseek-official |
| **英文查询不指定引擎** | 默认路由会落到 **bing**，跑偏到荒唐：`Fountain screenplay format specification` → **剑桥词典「fountain=喷泉」**（8/8 全错）；`TV spec script act breaks` → **央视网/芒果TV 首页**（8/8 全错）；另有查询返回**网盘垃圾结果**。⚠️ **而且不打印任何提示，看不出错**；长英文句在 `multi_search` 里还会被**按单词拆开**查（8 条结果 0 条有用） | **英文查询必须显式写 `engine=`**（exa / tavily / deepseek-official）；bing 只当"已知会犯错的默认落点" |
| GitHub 查询式一词多义 | `consistency` / `continuity` 这类词基本搜不到目标仓库 | 换成**专有名词**（技术名、标准名、项目名） |
| pwsh 执行 `.ps1` 脚本 | 被执行策略拒绝；且 **`powershell -File` 会把中文路径按 ANSI 毁掉**（`学术写作技能` → `瀛︽湳鍐欎綔鎶€鑳絓`） | 脚本**内联**执行，别落盘再 `-File`；必须带中文路径时直接在当前 shell 跑 |
| **pwsh 把 native 命令的 stderr 当 error** | 实测 `git clone` 报 `[exit code: 1]`，**但其实克隆成功了** | 判断 native 命令成败要**看产物 / 真实退出码**，别只看 pwsh 的报错 |
| **用 PowerShell 做文本手术会毁 UTF-8** | 实测 `Get-Content -Raw` + `-replace` + 写回，**按 GBK 编解码把中文文件写坏**（第二次踩到同一类坑） | **文本手术（读→改→写）一律用 Python**；PowerShell 只用来抓网页 / 查状态 |
| **pwsh 5.1：`if` 不能当内联表达式** | `-f $x,(if($a){'y'}else{'n'})` → `无法将"if"项识别为 cmdlet`（**同一类错犯过三次**） | 用 **`$( )`** 子表达式：`-f $x,$(if($a){'y'}else{'n'})`。**别再用 `( )` 包 `if`** |
| 以为配了就是能用 | baidu / kimi / doubao / aliyun / perplexity / you / serpbase / serply **全都没配 key** | 拿不准就先 `free_search_test` 体检 |
| 以为 baidu 会静默 fallback | 其实**会打印** `baidu unavailable or failed ... using exa` | 看到提示就知道结果来自 exa；baidu 本身不搜 |

### 信源与访问性（持续累积，遇到就回写）

| 站点 / 路径 | 现象 | 处理 |
| --- | --- | --- |
| `zhuanlan.zhihu.com/p/<id>`、`/question/<id>` | 403 | 走 `/tardis/` 阶梯 |
| `zhihu.com/market/pub/...`（盐选） | 付费墙 | 放弃，找同主题免费文章 |
| `science.org` 作者信息页 | 403（拒脚本） | 只能人工打开 |
| `gb-gbt.cn` | 连接直接失败 | 换 `openstd.samr.gov.cn` 查标准 |
| 国标正文（GB/T 15835、GB 3100 等） | 需购买 | 找高校 / 期刊网站的标准 PDF 转述版 |
| CSDN | 站内搜索混大量搬运、洗稿 | **认作者不认站**：走作者专栏 / 首发链接 |
| 降重、代写、AI 检测类工具页 | SEO 农场，内容不可信 | 只当线索，不进结论 |
| **2025–2026 涌现的"新规范站"** | 内容看着对，但**无署名、无从业背景、无版本历史**，疑似 AI 批量生成（实测一批写剧本格式的新站，域名互不相干、措辞雷同） | **只能当线索，不得作结论**；可结论源限定为：官方 spec / 行业组织 / 政府机构 / 厂商官方文档 / 有署名的从业者专栏 |
| **`en.wikipedia.org` / `zh.wikipedia.org`** | `web_fetch` **一律 `fetch failed`**（实测 2/2；`Invoke-WebRequest` 同一 URL 却是 200） | **改走 pwsh**（配方见下）；要干净正文用 `?action=raw` |
| **`developers.google.com`** | `web_fetch` **3/3 `fetch failed`** | 同上，pwsh 3/3 HTTP 200 |
| `authors.ietf.org`、`developers.openai.com` | `web_fetch` 返 200 但**正文为空**／403 | 同上；**OpenAI 官方页 URL 末尾加 `.md` 可直取 Markdown 正文**（19KB，HTTP 200） |
| 官方 PDF（GOV.UK 等） | 本机**无** `pdftotext` / `mutool` / `ghostscript` | `python -m pip install pypdf` 后抽文本；这些官方 PDF 有文字层，不是扫描件 |
| 标准的**现行/废止状态** | 买正文才能确认？不必 | 用 openstd 检索接口查状态（配方见下）——实测拿到「GB/T 7714-2025 现行 / 2015 废止」 |
| `community.openai.com` | 是**用户论坛**，不是官方 | 搜索极易命中并误当官方文档；官方口径只在 `developers.openai.com` / `help.openai.com` |
| **`www.nature.com`** | `web_fetch` 被 `idp.nature.com` **跨域重定向拦截**（3/3 失败） | 走 pwsh，实测 3/3 HTTP 200 |
| **PDF 直链** | `web_fetch` **拒收 `application/pdf`** | 必须 `Invoke-WebRequest -OutFile` 落盘再解析 |
| `web.archive.org` | 被判「非公网 IP」不可用 | **存档回溯这条路已断**，别再当兜底 |
| `support.jmir.org` | 403（Cloudflare `Just a moment...`），pwsh + UA **也 403** | 真缺口，只能人工浏览器打开或换同主题来源 |
| `worldanvil.com` | **7/7 全 403**（Cloudflare），pwsh 同样失败 | **主动拒爬**；只能靠 exa 厚摘要或人工打开 |
| `*.fandom.com`、`community.fandom.com` | **8/8 403**（`web_fetch` 报 `fetch failed`，pwsh 明确 403） | **主动拒爬，不是通道问题**；换 `wiki.gg` 镜像站或人工 |
| `zh.moegirl.org.cn` | 403 | 同上，走人工或镜像 |
| `gwb.tencent.com` | **TLS 握手失败**（显式 TLS 1.2 仍失败） | 同一内容改走 **`gameinstitute.qq.com`**（实测 200） |
| `oscars.org`（含其 PDF） | **整站 403** | 只能人工打开；该站的关键数值不要用二手互相矛盾的数字代替 |
| `screencraft.org` | **整域连接失败**（2/2） | 换同类来源覆盖，别反复试 |
| 豆瓣 `note/` 页面、火山引擎 docs | **JS/SPA 空壳**（只回导航壳） | 用其检索摘要当线索，或找同内容的静态页 |
| **`docs.unrealengine.com`** | **403**（同文已迁站） | 引虚幻引擎一律用 **`dev.epicgames.com/documentation/unreal-engine/`**（实测 200） |
| `dl.acm.org`、`acm.org`、`wiley.com` | **全站 403** | 论文类优先找 **arXiv 免费版**或作者主页的 PDF |
| CSDN 文章页 | 偶发 **521** | **重试即 200**，别判死 |
| `youxiputao.com/index.php/article/...` | 连接被重置 | **去掉路径里的 `/index.php`** → 200（100 KB）。多余的路径段会触发重置 |
| `ifwiki.org` | **五种写法全 403**（HEAD / GET / `?action=raw` / 去 `www` / 走 http） | **真封锁**，别再试；GDC 那条线也只能拿摘要 + indienova 中译 |
| `alexanderfreed.com` 的 Part 1/3 永久链接 | **404**（补斜杠也 404） | 改引 **`gamedeveloper.com` 镜像**（Part 1/2/3 实测全 200 且是全文） |
| **`wiki.gg` 系 + `lexicanum` + `liquipedia` + `gbf.wiki`** | **全部 403**，与 Fandom 同级的**拒爬站点群** | 换镜像站 / 官方 wiki / 人工打开，别反复试 |
| `d20statblock.thyle.net` | **https 证书链不被信任** | **必须用 `http://`** |
| `classicwowforever.com` 深页 | 不带尾部 `/` 会 **308 且不跟随** | **URL 末尾补 `/`** |
| `allthingsalbion.com` | **深链 404 但站点根 200**（疑 SPA 路由） | 从站点根进或站内搜；别直接引搜索结果里的深链 |

> ⚠️ **核心判据：`web_fetch` 失败 ≠ 页面不存在。** 本次实测它**按域名分化**失败（维基系、Google 开发者文档全挂），换 pwsh 就通。
> **遇失败先换通道，再决定是否记为"抓取失败"**，否则会误判整批来源不可用。

**统一绕行配方（pwsh）**：

```powershell
$r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 60 `
     -Headers @{'User-Agent'='Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
$r.StatusCode; $r.Content.Length
# 维基最干净的形态是源码：https://zh.wikipedia.org/w/index.php?title=Wikipedia:中立的观点&action=raw
# 标准现行状态：
$u='https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p1=0&p.p90=circulation_date&p.p91=desc&p.p2='+[uri]::EscapeDataString('GB/T 7714')
(($r=Invoke-WebRequest -Uri $u -UseBasicParsing -Headers @{'User-Agent'='Mozilla/5.0'}).Content -replace '<[^>]+>',"`n") -split "`n" |
  %{ $_.Trim() } | ?{ $_ -match '7714|现行|废止' }
```

> ⚠️ **上面那条标准状态配方只管国家标准（GB / GB-T）。** **行业标准（CY/T、GY/T 等）的查询入口本次没找到** —— `std.samr.gov.cn/hb/search/stdHBList`、`stdHBQueryPage`、`hbba.sacinfo.org.cn/stdList` 三个 URL **全 404**。别再照搬 gb 的参数硬试；行业标准的状态暂时只能引用转载页，并标注"未经官方复核"。

> ⚠️ 本机 `npm.ps1` 被 PowerShell 执行策略拦住（`禁止运行脚本`）——在 pwsh 里跑 npm 要用 **`npm.cmd`**。

### 情报判读

- **不同作者可能给出相反结论**（例：Priority 到底生不生效，HotPatcher 作者说"失效"，另一位知乎作者说"生效"）。
  遇到矛盾**不要选边站**——那说明这件事只能自己验，两边都只能当线索。
- **文章里的"注意事项"往往就是答案**（例："配置后需重启编辑器或在 Asset Manager 执行 Scan Changes 才能生效"）。
  优先读每篇的「注意事项 / 常见问题 / 踩坑」小节，比读正文快。
- **`/tardis/` 能不能抓到全文，本身就是一条信号** —— 能被知乎分发给外部的文章，通常质量确实偏高。
- **二手转载里的"官方说法"必须回官方核**（例：某模型厂商的"禁用词清单"只有自媒体转载，得回官方文档确认是否真有其事）。
- **被多个引擎同时命中的那一条**（`[seen in: a, b]`）优先读 —— 但它只是"覆盖面广"，不等于"结论正确"。

### 已废弃的旧路线（Codex 时代，DSH 里不要再试）

这份技能原本是给 Codex 写的，下面这些在本机**已经不可用**，看到就跳过：

| 旧做法 | 为什么废了 |
| --- | --- |
| PowerShell `Invoke-WebRequest https://duckduckgo.com/html/?q=site:zhihu.com+...` | DSH 的 ddg / ddg-lite 引擎 `connection error`，整条路断了 |
| `cua.createBrowserTab` / `tab.playwright.evaluate` / `nodeRepl.write` 开浏览器抓正文 | 当前 profile **没有浏览器 / CUA 插件**，这些 API 根本不存在 |
| `markHandoff()` / `listTabs` / `getAXState` / `emitImage` | 同上，插件都没有 |
| `waitForTimeout(2000~3000)` 等单页应用渲染 | 无浏览器，用不上；`web_fetch` 拿到的就是静态 HTML |
| 登录态存在浏览器 profile 里 | 无浏览器，没有 profile |

**替代方案**：正文用 `/tardis/` 阶梯，检索用 `multi_search`，图片放弃（或让用户自己看）。

> ⚠️ 这一段是 **profile 相关**的：哪天装了浏览器/CUA 插件、或某个引擎被重新配置，**要重测并回写**，别一直当真理用。
