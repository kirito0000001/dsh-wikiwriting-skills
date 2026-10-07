#!/usr/bin/env node
// =============================================================================
// wiki-collect 通用检查器 · v0.4（2026-10-07）
//
// 这个文件就是 `完成判据.md` §3.6 里说的那个「已有的 check.mjs」——
// 在 v0.3 里它是一句悬空引用（技能包里根本没有这个文件），v0.4 补上。
//
// 归属规则（**会 report 出来的**，即真正实现成检查项的那些）：⛔ **见下面的 `IMPLEMENTS`，别在这里抄**
// ⛔ **这份清单原来在 4 个文件里各有一份副本**（本文件头、`规则契约.md`、`完成判据.md`、`SKILL.md`）
//    —— 加了 `COL-S17` 之后**四处一处都没改**；而且它**混了三个不同的概念**。
//    → 真值只在 `IMPLEMENTS` 一处；**自检拿它和源码里真正 `report` 出来的集合对撞**
//      （任一侧多出或缺少都报 `SELFTEST_FAIL`；已做注入测试 **2/2 抓到**）。
//    → 别处要列清单，跑 `node tools/check.mjs --implemented`，**不许手抄**。
const IMPLEMENTS = [
  'COL-S01', 'COL-S02', 'COL-S03', 'COL-S04', 'COL-S06', 'COL-S07', 'COL-S09',
  'COL-S10', 'COL-S11', 'COL-S12', 'COL-S14', 'COL-S17',
  'COL-R01', 'COL-R04', 'COL-R12',
];
// 遵守但**不 report** 的纪律（不是检查项，别列进 `IMPLEMENTS`）：
//   COL-S08（被跳过的引用必须计数打印）· COL-S15（夹具先行）· COL-S16（定位四形态）· COL-R17（该查而没查要打出）
// 不由脚本判（语义判断）：COL-R05 · COL-R07 · COL-R08
// ⚠️ `COL-R01` 曾经被列在"不负责"里，而脚本其实在报它（`断言过短，疑似评价而非断言`）—— 自相矛盾，已纠正。
// 不负责（永远不由脚本判）：COL-R05 R07 R08 —— 那是语义判断，见 `完成判据.md` §3.5。
//   ⚠️ `COL-R01` **不在**此列 —— 它原来在这里，而脚本其实在报它（`断言过短，疑似评价而非断言`）。已纠正。
//
// 用法：
//   node check.mjs --topic <专题目录> [--docs <目录>[,<目录>...]]
//                  [--base <被采仓库的根>] [--expect-entries N] [--no-selftest] [--quiet]
//
// v0.5（2026-10-07）新增六项 —— 每一条都来自一轮真实使用（99 条条目的账本）：
//   ① `定位` 字段**真被解析**（COL-S16）：先切尾注释再剥反引号，认四形态；解析不了的**计数打印**
//      —— v0.4 的 `scanLedger` 只读 `引用路径`，`定位` 连读都没读，格式不对的定位被**静默跳过**。
//      这是检查器违反自己执行的规则（COL-S08「被跳过的引用必须计数打印」／COL-R17「该查而没查要显式打出」）。
//   ② `矛盾：X` 指向的条目必须在账本里存在（COL-S06）—— 实测 `矛盾：A-96` 指向一个不存在的条目，
//      而检查器报 major=0（插入失败没落地）。
//   ③ 源表登记的「实际位置」必须解析到真实文件（COL-S02，只在传 --base 时）
//   ④ 条目 `定位` 的 `文件:行` 必须存在、行号不越界（COL-R12，只在传 --base 时）
//   ⑤ `引用路径` 的主键必须在源表文件里**字面命中**（COL-S02，只在传 --base 时）
//      —— 实测唯一一条被机检抓出来的实质错误就是这个（主键在它声称的源表文件里根本不存在）。
//   ⑥ 计数行加 `topic:` 段；不传 --base 时明示 `(no --base)`（完成判据 §3.8），不许静默。
//   ⑦ ⛔ **第三查终于有执行者了**：`COL-S09` 数值不变量（INV-RANGE／INV-UNIT／
//      INV-LADDER／INV-SCALE）。v0.4 里 `完成判据.md` §3.1 把「三查」并列写成一张表，
//      而第三查**没有执行者** —— 实际只有两查。这和 v0.3 那条「已有的 check.mjs」是同一类病。
//      计数行加 `invariants:` 段，四类**分开计数**。
//
// ⚠️ ③④⑤ 的档位是写死的，不许自行升降：文件不存在 → advisory（未入库的工作区文件是**合法**的）；
//    行号越界 → major（越界一定是错的）；源表文件读不到 → 跳过并计数，**不许**报 major（误报防线）。
//
// 退出码：有 major → 1，否则 0。
// ⛔ 自检（COL-S15）失败时：报 major `SELFTEST_FAIL`，退出码 1，且**本次结果一律作废** ——
//    一个连自己的负样本都报不出来的检查器，它的「全绿」没有任何信息量。
//
// ⚠️ 本文件**不要读，要跑**（SKILL.md §11.1 的加载预算）。它现在比 v0.4 大三倍，
//    而"大"本身就是不读它的理由：跑一次看输出，比读它便宜两个数量级。
//
// 零依赖，只用 node 内置模块。
// =============================================================================
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── 闭集 ─────────────────────────────────────────────────────────────────────
// ⚠️ 这些闭集的**唯一定义处是 `规则契约.md`**（COL-S04/S05 等）。这里是执行副本；
//    改闭集必须回改规则契约，两处不一致以规则契约为准。
const STATUS_VALUES = ['一手已核', '自测', '二手线索', '待复审', '已推翻'];
const ID_RE = /^[ABC]-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// COL-R04 · `钉死` 的取值闭集（v0.4 新增）。
// v0.3 只写「commit／tag／版本号」—— 材料是**未提交的工作区**时没有合法取值，
// 实测后果：37 条 A 级一条都填不出来，作者只好自定口径并记成缺口。
const PIN_RE = new RegExp(
  '^(?:' +
    'commit:[0-9a-f]{7,40}' + '|' +
    'tag:\\S+' + '|' +
    '版本:\\d+\\.\\d+(?:\\.\\d+)?(?:[-+][\\w.]+)?' + '|' +
    '工作区@\\d{4}-\\d{2}-\\d{2}(?:\\+未提交)?' + '|' +
    // ⛔ v0.5 新增（实测撞出来的）：材料**完全不在任何 VCS 里**时（散文件、导出稿、`.docx`、
    //    没有 `.git` 的目录快照）前面四种**一个都填不出来**。
    //    实测一轮虚构材料：作者只能临时写 `版本:1.0` 顶，并注明"这是权宜"。
    '快照:\\d{4}-\\d{2}-\\d{2}' +
  ')$'
);
const PIN_SAME = '同上';
// 全篇声明允许「值后面跟一句人话说明」，所以另有一个**非锚定**的 token 版。
// 实测写法：`全篇统一钉死为 **`工作区@2026-10-07（HEAD 69c2947 + 未提交改动）`** —— …`
const PIN_TOKEN_RE = /(?:commit:[0-9a-f]{7,40}|tag:[^\s，。；、）)]+|版本:\d+\.\d+(?:\.\d+)?|工作区@\d{4}-\d{2}-\d{2}(?:\+未提交)?|快照:\d{4}-\d{2}-\d{2})/;

// COL-S11 · 专题目录里允许出现的名字（v0.4 接口 §1）
const ALLOWED_TOP = new Set([
  '00_选题卡.md', '01_素材账本.md', '02_设定表.md', '03_变更与缺口.md',
  '04_草稿.md', '05_复述测试.md', '06_发布版.md',
  '04_发布版.md', // v0.3 的旧名，保留兼容；新专题请用 06_
  'check.mjs',
]);

// 字段行里允许出现的字段名（v0.4 接口 §4.2）
const FIELD_NAMES = new Set([
  '编号', '状态', '断言', '定位', '引用路径', '证据', '拿到', '核对',
  '复审周期', '时效', '失效条件', '检查方式', '钉死', '矛盾', '取代', '被取代', '影响',
]);
// ⚠️ 这份名单是**从真实账本里数出来的**，不是照接口抄的 —— 抄的那版漏了 `时效`
//    （`COL-R03` 要求内部断言填 `时效：none`），于是 `拿到：2026-10-07｜时效：none`
//    这一行被当成「一个字段」，日期连带后面半行一起判错。

// COL-S08 · 示例区小节的标题特征（跳过其中的引用扫描）
const EXAMPLE_SECTION_RE = /示例|反例|模板|写法|样例|占位/;

// ── 引用路径的正式语法（COL-S02，v0.4 定义）──────────────────────────────────
//   引用路径 := 路径项 ( "；" 路径项 )*
//   路径项   := 源表名 "[" 主键 "]" 尾段? 尾注释?
//   尾段     := ( "." 段名 | "[" 下标 "]" )+
//   尾注释   := "（" 任意非「）」字符 "）"
//   反引号包裹可选。
//   ⚠️ **尾段可省**：`launcher[ScriptFileName]` 是合法引用 —— 主键本身就是被引的那一项。
//   ⚠️ `[]`（空方括号）**不是合法下标** —— 它是「角标隐藏误伤正文」的哨兵。
function parseRefItem(raw) {
  const s = raw.trim().replace(/^`+|`+$/g, '').trim();
  if (s === '') return { ok: false, reason: '空路径' };
  if (/\[\s*\]/.test(s)) return { ok: false, reason: '出现空方括号 []，不是合法下标' };
  const head = /^([A-Za-z_][\w-]*)\s*\[([^\]]+)\]/.exec(s);
  if (!head) return { ok: false, reason: '缺少「源表[主键]」头部' };
  const table = head[1];
  const rest = s.slice(head[0].length);
  if (rest !== '') {
    const tail = /^(?:(?:\.[A-Za-z_][\w-]*(?:\[[^\]]+\])*)|(?:\[[^\]]+\]))+$/.exec(rest);
    if (!tail) return { ok: false, reason: `尾巴不合法：${rest}` };
  }
  return { ok: true, table, key: head[2], path: s };
}

function parseRefValue(value) {
  const items = String(value)
    .split('；')
    .map(part => part.replace(/（[^）]*）\s*$/, '').trim())
    .filter(Boolean);
  if (items.length === 0) return { ok: false, items: [], errors: ['引用路径为空'] };
  const errors = [];
  const parsed = items.map(item => {
    const one = parseRefItem(item);
    if (!one.ok) errors.push(`${item} —— ${one.reason}`);
    return one;
  });
  return { ok: errors.length === 0, items: parsed.filter(p => p.ok), errors };
}

// ── `定位` 的正式语法（COL-S16，v0.5 落地）────────────────────────────────────
//   定位值 := 定位项 ( "；" 定位项 )*
//   定位项 := 主体 尾注释?
//   主体   := 文件 ":" 行            单行（**Src/Config.h:42**，路径按仓库根解析，**必须带目录**）
//           | 文件 ":" 起 "-" 止     行区间，**半角连字符**（Push-ServerBranch.ps1:266-272）
//           | URL（http(s)://… 或 …#anchor）
//           | 符号名（函数／类／常量名）
//   尾注释 := "（" 任意非「）」字符 "）"
//   ⛔ 不许自造前缀（实测有人写过 `:266-L272`，`L` 是自创的）。
//
// ⚠️ **顺序纪律：先切尾注释、再剥反引号 —— 顺序不能反**（COL-S16 原文，实测踩过）：
//    `` `updates\某草案.md:1`（工作区文件，被 .gitignore 排除） `` 这个形状（反引号包裹 + 尾随
//    中文注释）先剥反引号时，字符串末尾是「）」不是反引号，`^`+|`+$` 一个都剥不掉，剩下的整串
//    带着注释文本，四种形态全都不认 —— 实测因此产生过 **2 条误报**。
// 检查器纪律：解析不了的定位**必须计数打印**，不许静默跳过（COL-S08／COL-R17）。
function stripLocatorComment(raw) {
  let s = String(raw).trim();
  for (;;) {
    const next = s.replace(/（[^）]*）\s*$/, '').trim();
    if (next === s) return s;
    s = next;
  }
}

function cleanLocator(raw) {
  const noComment = stripLocatorComment(String(raw).trim());          // ① 先切尾注释
  const noTicks = noComment.replace(/^`+/, '').replace(/`+$/, '');    // ② 再剥反引号
  return stripLocatorComment(noTicks).trim();                         // ③ 注释写在反引号里面时再切一次
}

// 顶层切分：括号里的 `；` 不算分隔符（尾注释里可能带分号）
function splitTopLevel(value, sep) {
  const out = [];
  let buf = '';
  let depth = 0;
  for (const ch of String(value)) {
    if (ch === '（') depth += 1;
    else if (ch === '）') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

const LOCATOR_URL_RE = /^(?:https?|ftp):\/\//i;
const looksLikeUrl = s => LOCATOR_URL_RE.test(s) || s.includes('#');
// ⛔ 自造前缀（COL-S16 明令禁止）：`:589`（省略文件名）、`:266-L272`（自造 L）、`L272`
const LOCATOR_BARE_LINE_RE = /^:\s*\d/;
const LOCATOR_FAKE_PREFIX_RE = /:\s*\d+\s*[-–—~]\s*[A-Za-z]\d+\s*$/;
const LOCATOR_LONELY_L_RE = /^[LlＬ]\s*\d+$/;
const LOCATOR_EMPTY_RE = /^[（()）\s；;，,、。：:]+$/;
// ⛔ `文件:行` 里的「文件」必须**像个路径**：不许残留反引号／全角括号／顿号／分号。
//   实测（`_dryrun/dsh-free-search-readme` 的账本）：一行多条定位却用 `、`（或 ` vs `）分隔
//   —— COL-S10 违规 —— 整串会连成**一个**定位项。不加这道闸，④ 就会拿
//   「README.md:54-81`（中文表）、`README.md」这种拼接串去查文件，报出 **9 条**
//   「README.md 解析不到文件」的假 advisory（文件明明就在）。
//   这类项**不是** COL-S16 的四种形态 → 计入 `locator-skipped`（COL-S10 另有 advisory 指路），
//   而不是编一个不存在的文件名出来。
const LOCATOR_BAD_PATH_RE = /[`（）()；;、]/;

// 返回 { kind: 'line'|'range'|'url'|'symbol'|'none', path, from, to }
//   · 'none' = 解析不了（自造前缀／空白／只剩标点）→ 必须计数（locator-skipped），不许静默
//   · 'symbol'／'url' 是**合法**形态，但不是 `文件:行`，文件存在性检查对它们无从下手 → 计入 unchecked
function classifyLocator(clean) {
  const s = String(clean).trim();
  if (s === '' || LOCATOR_EMPTY_RE.test(s)) return { kind: 'none' };
  if (looksLikeUrl(s)) return { kind: 'url' };
  const range = /^(.+?):(\d+)-(\d+)$/.exec(s);
  if (range) {
    const path = range[1].trim();
    if (LOCATOR_BAD_PATH_RE.test(path)) return { kind: 'none' };
    return { kind: 'range', path, from: Number(range[2]), to: Number(range[3]) };
  }
  const line = /^(.+?):(\d+)$/.exec(s);
  if (line) {
    const path = line[1].trim();
    if (LOCATOR_BAD_PATH_RE.test(path)) return { kind: 'none' };
    return { kind: 'line', path, from: Number(line[2]), to: Number(line[2]) };
  }
  if (LOCATOR_BARE_LINE_RE.test(s) || LOCATOR_FAKE_PREFIX_RE.test(s) || LOCATOR_LONELY_L_RE.test(s)) {
    return { kind: 'none' };
  }
  return { kind: 'symbol' };
}

// ── 「实际位置」与文件探测（v0.5 新增；只在传了 --base 时用）──────────────────
// 口径来源：`完成判据.md` §3.8「`--base` 传被采仓库的根。不传则源表位置／条目定位的文件校验
// **全部跳过**」；`规则契约.md` COL-S02「`源表` 必须在账本的「源表登记」里**唯一解析到真实位置**」。
const MAX_READ_BYTES = 4 * 1024 * 1024;
// ⚠️「未入库的工作区文件」是**合法**的（COL-S02 原文：实测有专题把两份被 .gitignore 排除的草案
//    登记为源表，这是合法的）—— 所以「文件不存在」只能是 advisory；作者已经注明
//    「工作区文件，未入库」时连 advisory 都不报，因为规则要的那件事已经做了。
const UNCOMMITTED_RE = /工作区文件|未入库|未提交|未纳入版本|gitignore/i;

// ⚠️ ⑤ 的误报防线②：范围／列表写法的主键（`validator[1..7]`）**不是字面可核的形态**。
//    `..`／`…`／`~`／`、`／`,`／`*` 意味着「一串值」，逐字命中这件事无从谈起。
//    实测（本轮 --base 实跑靶子账本 A-37）：`validator[1..7]` 在 `UpdatePackageValidator.cs` 里
//    当然找不到 `1..7`，可那 7 条检查确实都在（文件里是 `// 1)` … `// 7)`）—— 报 major 就是误报。
//    按 COL-R17：查不了就**计数**（`key-skipped`），不要编一个假判决出来。
const KEY_NOT_LITERAL_RE = /\.\.|…|~|、|,|，|\*/;

// glob／模板／占位符 —— **不是具体路径**，③④ 一律跳过并计数。
//   实测误报：某账本登记 `D:\…\Artifacts\CrossingVoidZDTool\v*`（`v*` 是"版本目录"的通配写法），
//   第一版把它当具体路径去 probe，报了一条 advisory。**模式不是位置。**
const PATH_PATTERN_RE = /[*?{}<>…]|\.\.\./;

function looksLikePath(s) {
  if (looksLikeUrl(s)) return false;
  if (PATH_PATTERN_RE.test(s)) return false;
  return s.includes('\\') || s.includes('/');
}

// ③ 用：`路径:行`、`路径:起-止`、或**只有路径**。
//   ⚠️ 行号**可省** —— v1 只认带行号的形态，结果 winui 账本的 14 行源表登记**全都不带行号**，
//      于是 14 行全落进 `table-unchecked`，**③ 在真实语料上一行都没查**（自报"0/14 tables checked"）。
//      实测两种形态都真实存在：`素材账本字段.md` 的例子带行号（`lib/index.js:86`），
//      而那份 37 条账本的登记列全是裸路径（`Services/Update/UpdateRequestBudget.cs`）。
//   ⚠️ 这里**要求路径含 `\` 或 `/`** —— 用来把 `learn.microsoft.com`、`本地 git 仓库`
//      这类「纯 URL／纯符号名／纯描述」排除掉（跳过并计数）。
function splitPathLine(loc) {
  const raw = String(loc).trim().replace(/^`+|`+$/g, '').trim();
  const m = /^(.+?):(\d+)(?:-(\d+))?$/.exec(raw);
  if (m) {
    const path = m[1].trim();
    if (!looksLikePath(path)) return null;
    const from = Number(m[2]);
    return { path, from, to: m[3] ? Number(m[3]) : from };
  }
  if (!looksLikePath(raw)) return null;
  return { path: raw, from: null, to: null };   // 无行号：只核文件存不存在，不核行号
}

// ⑤ 用：源表登记 → 文件路径（行号可有可无）。⚠️ 这里**不要求**目录分隔符 —— 源表本来就常登记成
//   裸文件名（实测 `CrossingVoidZDTool.csproj`、`package.json` 都是这种）。要求带 `/` 会让⑤
//   整个漏掉这些源表，而本轮唯一一条被机检抓出来的实质错误**正出在裸文件名源表上**。
//   读得到／读不到由 probe 判：读不到 → 跳过并计数（**不许**报 major）。
function registryFileOf(loc) {
  const s = String(loc).trim();
  if (s === '' || looksLikeUrl(s)) return null;
  const m = /^(.+?):\d+(?:-\d+)?$/.exec(s);
  return (m ? m[1].trim() : s) || null;
}

// 文件探测：不存在／目录／二进制（含 NUL）／过大 → ok:false（**跳过并计数，不报 major**）；
// 成功则带回 text（给⑤逐字命中用）与行数（给③④行号越界用）。同一个路径只读一次。
//
// ⛔ v0.5：**先认 BOM，再判二进制。** UTF-16 带 BOM 的**文本**文件里，每个 ASCII 字符都含 NUL
//    （`a` 在 UTF-16LE 里是 `61 00`），所以 `buf.includes(0)` 会把它们一律判成二进制。
//    实测：一个仓库的 `artifacts/*.log` 与 `.scratch/*.out|err` 全是 UTF-16LE + BOM，
//    指着它们的 4 条定位**全部**报 advisory（`COL-R12`），而作者已经按 §2.1 在登记表里
//    注明过「工作区文件，未入库」—— 注了也照报，因为判据根本没走到那一步。
function detectBom(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'utf16le';
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'utf16be';
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'utf8bom';
  return null;
}
function decodeWithBom(buf, enc) {
  if (enc === 'utf16le') return buf.subarray(2).toString('utf16le');
  if (enc === 'utf16be') {
    const b = Buffer.from(buf.subarray(2)); // 复制，不改原 buffer
    for (let i = 0; i + 1 < b.length; i += 2) { const t = b[i]; b[i] = b[i + 1]; b[i + 1] = t; }
    return b.toString('utf16le');
  }
  return buf.subarray(3).toString('utf8'); // utf8bom：剥掉 BOM 三字节
}
function makeFileProbe(base, extraRoots = []) {
  const cache = new Map();
  // `extraRoots`：**专题侧**的源表（例如口述记录 `_src/作者口述.md`）不在 `--base` 之下，
  // 只按 base 解析必然「读不到」—— 实测因此吃过 1 条假 advisory。改成**两个根都试**，
  // 命中任一即算解析得到；缓存键用**实际读到的那个绝对路径**。
  return function probe(p) {
    const candidates = isAbsolute(p) ? [p] : [resolve(base, p), ...extraRoots.map(r => resolve(r, p))];
    const hitPath = candidates.find(c => cache.has(c)) ?? candidates.find(c => existsSync(c)) ?? candidates[0];
    if (!cache.has(hitPath)) {
      const abs = hitPath;
      let r;
      try {
        const st = statSync(abs);
        if (!st.isFile()) r = { ok: false, why: '不是普通文件' };
        else if (st.size > MAX_READ_BYTES) r = { ok: false, why: `文件过大（${st.size} 字节 > ${MAX_READ_BYTES}）` };
        else {
          const buf = readFileSync(abs);
          const enc = detectBom(buf);
          if (enc) {
            const text = decodeWithBom(buf, enc);
            r = { ok: true, text, lines: text.split(/\r?\n/).length };
          } else if (buf.includes(0)) r = { ok: false, why: '二进制文件（含 NUL 字节）' };
          else {
            const text = buf.toString('utf8');
            r = { ok: true, text, lines: text.split(/\r?\n/).length };
          }
        }
      } catch { r = { ok: false, why: '读不到（不存在／是无权读取的路径）' }; }
      cache.set(abs, r);
    }
    return cache.get(hitPath);
  };
}

// ⑤ 的逐字命中：主键必须在源表文件里**字面出现**。
// 唯一的放宽：小节号型主键（`req[§13]`）—— 文件里通常只写标题号 `## 13. …`，没有 `§`。
// 实测：`热更新-发布侧需求.md` 里 `§13` 逐字不存在，但 `## 13. …` 有两处（那正是本轮的
// COL-S14 真缺陷）。没有这条放宽，用户一传 --base 就会看到一片假 major。
function literalHit(text, key) {
  if (text.includes(key)) return true;
  const sec = /^§\s*(\d+(?:\.\d+)*)$/.exec(String(key).trim());
  if (!sec) return false;
  const num = sec[1].replace(/\./g, '\\.');
  return new RegExp(`^#{1,6}\\s*${num}(?:\\.\\d+)*[.、\\s]`, 'm').test(text);
}

// 源表登记表行的解析（与 v0.4 的识别口径一致：首格是一个 ASCII 标识符）
function parseRegistryRow(line) {
  if (!/^\|\s*`?[A-Za-z_][\w-]*`?\s*\|/.test(line)) return null;
  if (/^\|\s*源表名/.test(line) || /^\|[\s:|-]+\|?\s*$/.test(line)) return null;
  const cells = line.replace(/^\|/, '').replace(/\|+\s*$/, '').split('|').map(c => c.trim());
  return { table: cells[0].replace(/`/g, '').trim(), location: cells[1] ?? '' };
}

// ── 字段行的切分（v0.4 定义）─────────────────────────────────────────────────
// ⚠️ **一行可以放多个字段，用 `｜` 分隔**（接口 §4.1 的模板就是这么写的）：
//      - 拿到：2026-10-07 ｜核对：2026-10-07 ｜钉死：`a1b2c3d`
//    不先按 `｜` 切开、只认「行首那个字段名」，后面的日期会被当成第一个字段的值
//    —— 实测：一份 37 条的账本因此报出 40 条假日期错。这是本检查器自己踩过的坑。
function splitFieldLine(content) {
  const out = [];
  for (const seg of content.split('｜')) {
    const m = /^\s*([^：:]{1,12})\s*[：:]\s*([\s\S]*)$/.exec(seg);
    const name = m ? m[1].replace(/[*`\s]/g, '').replace(/口径$/, '') : null;
    if (m && FIELD_NAMES.has(name)) out.push({ name, value: m[2].trim() });
    else if (out.length > 0) out[out.length - 1].value += '｜' + seg.trim();
    // 两边都不是：这一行不是字段行，忽略
  }
  return out;
}

// ── finding 收集 ─────────────────────────────────────────────────────────────
function makeSink() {
  return { findings: [], sev: { major: 0, advisory: 0, info: 0 } };
}
function report(sink, severity, code, file, line, message, evidence) {
  sink.findings.push({ severity, code, file, line, message, evidence: evidence ?? '' });
  sink.sev[severity] += 1;
}

// ── 全篇 `钉死` 声明（COL-R04 v0.4）─────────────────────────────────────────
// 顶格一行 `钉死口径：…`；值可以写在同行，也可以写在**其后 3 行内**（实测就是写下一行的）。
function findGlobalPin(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^(?:\*\*)?\s*`?钉死`?\s*(?:口径)?\s*(?:\*\*)?\s*[：:]/.test(lines[i])) continue;
    const window = lines.slice(i, i + 4).join(' ');
    const token = PIN_TOKEN_RE.exec(window);
    return { line: i + 1, token: token ? token[0] : null };
  }
  return null;
}

// ── 账本检查 ─────────────────────────────────────────────────────────────────
function scanLedger(lines, file, opts = {}) {
  const sink = makeSink();
  const counters = {
    entries: 0, refs: 0, dates: 0, enums: 0, skipped: 0,
    // ⑥ 计数行的 `topic:` 段（v0.5）
    tables: 0, locators: 0, 'locator-skipped': 0,
    'locator-checked': 0, 'locator-unchecked': 0,
    'table-checked': 0, 'table-unchecked': 0,
    'key-checked': 0, 'key-skipped': 0, 'key-not-literal': 0, 'file-unreadable': 0,
  };

  // --base：被采仓库的根。不传 → ③④⑤ 的文件校验全部跳过（完成判据 §3.8；计数行必须明示，不许静默）
  const base = opts.base && existsSync(opts.base) ? opts.base : null;
  if (opts.base && !base) {
    report(sink, 'advisory', 'COL-S02', file, 1,
      `--base 指向的目录不存在：${opts.base}`,
      '源表位置／条目定位的文件校验全部跳过（否则会刷一屏假 advisory，把真问题埋掉）');
  }
  const probe = base ? makeFileProbe(base, opts.extraRoots ?? []) : null;
  const registry = new Map();      // 源表名 → { table, location, line }
  // ⛔ v0.5：账本**可以拆成多份**（`素材账本字段.md` §3「装不下就拆专题，不许扩位数」），
  //    而**「源表登记」是共用的** —— 三份文件是**一个逻辑账本**。
  //    实测：`gmm` 登记在 `01_` 却用在 `02_`，逐文件独立解析把它判成「未登记」（2 条**假 major**）。
  //    → 调用方先把所有账本的登记行合并成 `opts.sharedRegistry`，这里**先播种**。
  if (opts.sharedRegistry) for (const [k, v] of opts.sharedRegistry) registry.set(k, v);
  const refItems = [];             // 引用路径 的「表[主键]」，⑤ 用

  const globalPin = findGlobalPin(lines);
  // ⛔ **两个集合，别搞混**（实测踩过）：
  //   · `registry`（Map）—— 「实际位置」等元信息，⑤ 的字面命中用它
  //   · `registeredTables`（Set）—— **`引用路径` 的「源表是否登记」那条检查用它**（下面 L535）
  //   账本拆成多份时**「源表登记」是共用的**（三份是一个逻辑账本），所以两个都要播种。
  //   实测：只播了 `registry` → `gmm`（登记在 `01_`、用在 `02_`）照样吃 2 条**假 major**。
  const registeredTables = new Set();
  const localTables = new Set();   // 只数**本文件**登记的那几张，供计数行用
  if (opts.sharedRegistry) for (const k of opts.sharedRegistry.keys()) registeredTables.add(k);
  const ids = new Map();
  const pendingSection = [];
  const contradictions = [];
  let pinnedEntries = 0;

  let inPending = false;
  let fence = null;
  let inExampleSection = false;
  let currentEntry = null;

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    // COL-S08：围栏代码块整块跳过并计数
    if (/^\s*(?:```|~~~)/.test(line)) {
      fence = fence ? null : true;
      counters.skipped += 1;
      return;
    }
    if (fence) return;

    // COL-S08：示例／反例／模板小节整节跳过并计数
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      inExampleSection = heading[1].length >= 2 && EXAMPLE_SECTION_RE.test(heading[2]);
    }
    if (inExampleSection) { counters.skipped += 1; return; }

    // `#### 未决` 小节的开合
    if (/^#{3,6}\s*未决/.test(line)) { inPending = true; return; }
    if (/^#{1,3}\s/.test(line) && !/^#{3,6}\s*未决/.test(line)) inPending = false;

    // 源表登记（`## 0. 源表登记` 下的表格行）—— v0.5：连同「实际位置」一起收下来（③⑤ 要用）
    const tableRow = parseRegistryRow(line);
    if (tableRow) {
      registeredTables.add(tableRow.table);
      localTables.add(tableRow.table);
      if (!registry.has(tableRow.table)) registry.set(tableRow.table, { ...tableRow, line: lineNo });
      counters.tables = localTables.size;   // 计数行的 `N tables` = **本文件**登记的源表数
    }

    // 条目标题：`- **A-01**｜状态：一手已核｜断言：…`
    // ⛔ 先做**宽松**识别：只要形如 `- **X-nn**` 就算「像条目」。
    //    ⚠️ 严格正则 `[ABC]-\d{2}` 匹配不上 `A-100`（三位数），整行会被**静默跳过**。
    //    实测：一份 324 条的合并稿只解析到 98 条，**226 条无声消失**，而且报 `major=0`、退出码 0
    //    —— 这正是 `COL-S12` 禁止的「识别失败即静默放过」。**编号只许两位，超了必须报出来。**
    const loose = /^-\s+\*\*([ABC]-\d+)\*\*/.exec(line);
    const bullet = /^-\s+\*\*([ABC]-\d{2})\*\*\s*(.*)$/.exec(line);
    if (loose && !bullet) {
      counters.skipped += 1;
      report(sink, 'major', 'COL-S01', file, lineNo,
        `条目编号无法解析：${loose[1]} —— 编号只许两位（A-00…A-99）`,
        '三位及以上不在 ID 语法内，会被静默跳过（实测过：324 条只解析到 98 条）。请**拆成多个专题**，每个 ≤99 条，不要扩位数');
      return;
    }
    if (bullet) {
      const id = bullet[1];
      counters.entries += 1;
      if (!ID_RE.test(id)) {
        report(sink, 'major', 'COL-S01', file, lineNo, `编号不合规：${id}`, '期望 A-nn／B-nn／C-nn');
      }
      if (ids.has(id)) {
        report(sink, 'major', 'COL-S01', file, lineNo, `编号重复（另见第 ${ids.get(id)} 行）：${id}`, id);
      } else {
        ids.set(id, lineNo);
      }
      const fields = splitFieldLine(bullet[2]);
      const statusField = fields.find(f => f.name === '状态');
      const claimField = fields.find(f => f.name === '断言');
      if (!statusField || !claimField) {
        report(sink, 'major', 'COL-S12', file, lineNo,
          `条目标题缺「状态：」或「断言：」，本行无法解析：${id}`,
          '结构识别失败必须报错，不许静默放过');
      } else {
        counters.enums += 1;
        if (!STATUS_VALUES.includes(statusField.value)) {
          report(sink, 'major', 'COL-S04', file, lineNo,
            `状态不在五值闭集里：${statusField.value}`, `允许：${STATUS_VALUES.join('／')}`);
        }
        if (claimField.value.length < 6) {
          report(sink, 'advisory', 'COL-R01', file, lineNo, '断言过短，疑似评价而非断言', claimField.value);
        }
      }
      currentEntry = { id, line: lineNo, hasPin: false };
      return;
    }

    // 字段行：`  - 定位：… ｜核对：…`
    const fieldLine = /^\s+-\s+(.+)$/.exec(line);
    if (fieldLine) {
      for (const { name, value } of splitFieldLine(fieldLine[1])) {
        if (name === '引用路径') {
          const parsed = parseRefValue(value);
          counters.refs += parsed.items.length;
          for (const err of parsed.errors) {
            report(sink, 'major', 'COL-S02', file, lineNo,
              `引用路径不合法：${err}`, '期望 源表[主键]（尾段 .字段 可省、可多值、可尾注释）');
          }
          for (const item of parsed.items) {
            if (!registeredTables.has(item.table)) {
              report(sink, 'major', 'COL-S02', file, lineNo,
                `源表未在「源表登记」里登记：${item.table}`,
                '源表名必须唯一解析到真实位置');
            }
            // ⑤ 的素材：等源表登记全部读到之后再核（表可能登记在条目后面）
            refItems.push({ file, line: lineNo, table: item.table, key: item.key });
          }
        }

        if (name === '钉死') {
          const raw = value.replace(/^`+|`+$/g, '').trim();
          if (currentEntry) currentEntry.hasPin = true;
          pinnedEntries += 1;
          if (raw === PIN_SAME) {
            if (!globalPin || !globalPin.token) {
              report(sink, 'major', 'COL-R04', file, lineNo,
                '钉死写「同上」但全篇没有可解析的 `钉死口径：` 声明', '同上必须能解析到唯一一处声明');
            }
          } else if (!PIN_RE.test(raw)) {
            report(sink, 'major', 'COL-R04', file, lineNo,
              `钉死取值不在闭集里：${raw}`,
              'commit:<sha>／tag:<name>／版本:<semver>／工作区@YYYY-MM-DD[+未提交]／同上');
          }
        }

        if (name === '矛盾') {
          for (const match of value.matchAll(/[ABC]-\d{2}/g)) {
            contradictions.push({ file, line: lineNo, id: match[0] });
          }
        }

        // COL-S03：日期字段（值后面可以跟说明，只取第一个 token 判格式）
        if (name === '拿到' || name === '核对') {
          const token = /^(\S+)/.exec(value.replace(/^`+|`+$/g, '').trim());
          if (token) {
            counters.dates += 1;
            if (!DATE_RE.test(token[1])) {
              report(sink, 'major', 'COL-S03', file, lineNo,
                `${name} 不是 YYYY-MM-DD：${token[1]}`, '日期不加引号');
            }
          }
        }

        // COL-S10：一行多条定位却没用「；」分隔（启发式，**不许阻断**）
        if (name === '定位') {
          const anchors = (value.match(/[A-Za-z0-9_./\\-]+\.(?:cs|ps1|md|xaml|json|js|mjs|ts|py|yml|yaml|txt)\s*:\s*\d+/g) || []).length;
          if (anchors > 1 && !value.includes('；')) {
            report(sink, 'advisory', 'COL-S10', file, lineNo,
              `一行里疑似有 ${anchors} 个定位但没用「；」分隔`, value.slice(0, 60));
          }

          // ① COL-S16／COL-S08／COL-R17：`定位` 必须**真被解析**，解析不了的**计数打印**。
          //   v0.4 这里只跑上面那条启发式 —— `定位` 的**值从来没被解析过**：8 条
          //   `` `path:80`（备注） `` 形状被静默跳过，修好解析器后 231 个定位才全部机核。
          //   检查器违反了它自己执行的规则（COL-S08「被跳过的引用必须计数打印」）。
          //   · 顶层 `；` 切分（括号里的分号不算）；尾随／连续分隔符不产生定位项
          const locatorItems = splitTopLevel(value, '；').map(p => p.trim()).filter(Boolean);
          if (locatorItems.length === 0) counters['locator-skipped'] += 1;
          for (const raw of locatorItems) {
            const cls = classifyLocator(cleanLocator(raw));
            if (cls.kind === 'none') { counters['locator-skipped'] += 1; continue; }
            counters.locators += 1;
            // URL／符号名是合法形态，但不是 `文件:行` —— 文件存在性检查对它们无从下手（跳过并计数）
            if (cls.kind === 'url' || cls.kind === 'symbol') { counters['locator-unchecked'] += 1; continue; }
            if (!base) { counters['locator-unchecked'] += 1; continue; }   // 该查而没查 → 计数（计数行明示 (no --base)）
            counters['locator-checked'] += 1;
            if (UNCOMMITTED_RE.test(raw)) continue;   // 已注明是未入库的工作区文件 = 规则允许的那种
            // ④ COL-R12：`文件:行` 必须存在、行号不越界（存在 → advisory；越界 → major）
            const r = probe(cls.path);
            const span = cls.from === cls.to ? `${cls.from}` : `${cls.from}-${cls.to}`;
            if (!r.ok) {
              report(sink, 'advisory', 'COL-R12', file, lineNo,
                `定位解析不到文件：${cls.path}:${span}`,
                `若这是未入库的工作区文件，请在源表登记里注明「工作区文件，未入库」；否则请修定位（${r.why}）`);
              continue;
            }
            if (cls.from < 1 || cls.to > r.lines) {
              report(sink, 'major', 'COL-R12', file, lineNo,
                `定位行号越界：${cls.path}:${span}，该文件只有 ${r.lines} 行`,
                '行号越界一定是错的（不是「未入库」那种合法例外）');
            }
          }
        }
      }
      return;
    }

    // `#### 未决` 小节里提到的编号
    if (inPending) {
      for (const match of line.matchAll(/[ABC]-\d{2}/g)) {
        pendingSection.push({ file, line: lineNo, id: match[0] });
      }
    }
  });

  // COL-S06 双轨对齐
  const contradictionIds = new Set(contradictions.map(c => c.id));
  for (const item of contradictions) {
    if (!pendingSection.some(p => p.id === item.id)) {
      report(sink, 'major', 'COL-S06', item.file, item.line,
        `有「矛盾：${item.id}」但没有可见的 #### 未决 小节条目`,
        '字段供脚本查、小节供人读，不可互替');
    }
  }
  for (const item of pendingSection) {
    if (!contradictionIds.has(item.id) && !ids.has(item.id)) {
      report(sink, 'advisory', 'COL-S06', item.file, item.line,
        `未决小节提到的 ${item.id} 既不是条目标题也没在「矛盾」字段里`, item.id);
    }
  }

  // COL-S06（v0.5 新增）：`矛盾：X` 指向的**必须是一个真条目**。
  //   实测后果：`矛盾：A-96` 指向的条目根本不存在（插入失败没落地），而检查器报 `major=0`
  //   —— 旧版只查「字段有没有对应的小节」，不查「矛盾的对方是不是真条目」。
  for (const item of contradictions) {
    if (!ids.has(item.id)) {
      report(sink, 'major', 'COL-S06', item.file, item.line,
        `「矛盾：${item.id}」指向的条目在本账本里不存在`,
        '矛盾的对方必须是真条目；编号对不上通常是插入失败没落地，留下了一个幽灵编号');
    }
  }

  // COL-S02（v0.5 新增·③）：源表登记的「实际位置」必须解析到真实文件
  //   档位写死：文件不存在 → advisory（未入库的工作区文件合法）；行号越界 → major
  if (base) {
    for (const row of registry.values()) {
      const pl = splitPathLine(cleanLocator(row.location));
      if (!pl) { counters['table-unchecked'] += 1; continue; }   // 纯 URL／纯符号名／纯描述／无行号路径 → 跳过并计数
      counters['table-checked'] += 1;
      if (UNCOMMITTED_RE.test(row.location)) continue;
      const r = probe(pl.path);
      if (!r.ok) {
        report(sink, 'advisory', 'COL-S02', file, row.line,
          `源表 ${row.table} 的「实际位置」解析不到文件：${pl.path}`,
          `若这是未入库的工作区文件，请在登记表里注明「工作区文件，未入库」；否则读者拿不到这份材料，引用不可复核（${r.why}）`);
        continue;
      }
      if (pl.from !== null && (pl.from < 1 || pl.to > r.lines)) {
        report(sink, 'major', 'COL-S02', file, row.line,
          `源表 ${row.table} 的「实际位置」行号越界：${pl.path}:${pl.from === pl.to ? pl.from : `${pl.from}-${pl.to}`}，该文件只有 ${r.lines} 行`,
          '行号越界一定是错的（不是「未入库」那种合法例外）');
      }
    }
  }

  // COL-S02（v0.5 新增·⑤）：`引用路径` 的主键必须在源表文件里**字面命中**。
  //   实测抓到的那条真错就是这个：主键在它声称的源表文件里根本不存在（`includes('防火') === false`）。
  //   ⚠️ 误报防线：源表文件读不到（不存在／二进制／太大）→ **跳过并计数，不报 major**。
  if (base) {
    for (const item of refItems) {
      if (KEY_NOT_LITERAL_RE.test(item.key)) {
        counters['key-not-literal'] += 1; counters['key-skipped'] += 1; continue;
      }
      const row = registry.get(item.table);
      const path = row ? registryFileOf(cleanLocator(row.location)) : null;
      if (!path) { counters['key-skipped'] += 1; continue; }
      const r = probe(path);
      if (!r.ok) { counters['file-unreadable'] += 1; counters['key-skipped'] += 1; continue; }
      counters['key-checked'] += 1;
      if (!literalHit(r.text, item.key)) {
        report(sink, 'major', 'COL-S02', item.file, item.line,
          `引用路径的主键在源表文件里找不到：${item.table}[${item.key}] → ${path}`,
          '主键必须能在该文件里字面命中，否则这条引用是悬空的（实测真错：主键在源表文件里不存在）');
      }
    }
  }

  // COL-R04：钉死必须能解析到 —— 逐条写，**或**全篇声明一次覆盖全篇（v0.4）
  if (counters.entries > 0 && pinnedEntries === 0) {
    if (globalPin && globalPin.token) {
      report(sink, 'info', 'COL-R04', file, globalPin.line,
        `全篇钉死声明覆盖了全部 ${counters.entries} 条条目（未逐条书写）`,
        `声明值：${globalPin.token}`);
    } else if (globalPin) {
      report(sink, 'major', 'COL-R04', file, globalPin.line,
        '有 `钉死口径：` 声明，但其后 3 行内找不到合法的钉死取值',
        'commit:<sha>／tag:<name>／版本:<semver>／工作区@YYYY-MM-DD[+未提交]');
    } else {
      report(sink, 'major', 'COL-R04', file, 1,
        '全篇找不到 `钉死` 声明（读代码得来的断言不可复核）',
        '条目里逐条写，或顶格写一行「钉死口径：<值>」后条目写「同上」');
    }
  }

  // COL-S07 / COL-S12：解析到零 = major，绝不以退出码 0 放行
  const expected = opts.expectEntries ?? 1;
  if (counters.entries < expected) {
    report(sink, 'major', 'COL-S07', file, 1,
      `PARSE_EMPTY：本次只解析到 ${counters.entries} 条条目（期望 ≥ ${expected}）`,
      '结构识别失败时必须报错，不许静默通过');
  }

  return { sink, counters, globalPin };
}

// ── 文档检查 ─────────────────────────────────────────────────────────────────
function scanDocs(lines, file, registeredTables) {
  const sink = makeSink();
  const counters = { files: 1, headings: 0, refs: 0, skipped: 0 };
  const stack = {};              // 标题层级 → 全路径 key
  const seen = new Map();        // key → 首次出现的行号
  let fence = null;
  let inExampleSection = false;

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    // ⛔ COL-S08：围栏代码块**无条件跳过**。漏掉它的后果是**漏报**（不是误报）：
    //    实测过一次 —— 代码块里一行 `# 4) 自检…` 被当成 H1，把标题路径污染成两个不同的
    //    key，于是「两个 ## 13.」这条真缺陷从报告里消失，看起来全绿。
    if (/^\s*(?:```|~~~)/.test(line)) {
      fence = fence ? null : true;
      counters.skipped += 1;
      return;
    }
    if (fence) return;

    const heading = /^(#{1,6})\s+(?:(\d+(?:\.\d+)*)[.、]?\s+)?(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const number = heading[2] || '';
      const title = heading[3].trim();
      counters.headings += 1;
      inExampleSection = level >= 2 && EXAMPLE_SECTION_RE.test(title);

      // COL-S14：作用域是「同一父节点下的同级标题」，**不是全文**。
      //   父节没有编号时不能只拿数字当 key —— 否则不同章节下的 `### 1.` 会互相误报
      //   （实测：一份真实交接文档因此产生 16 条误报，只有 1 条是真的，误报率 94%）。
      const seg = number || title;
      const parentKey = stack[level - 1] ?? '';
      const key = parentKey ? `${parentKey} / ${seg}` : seg;
      stack[level] = key;
      for (let deeper = level + 1; deeper <= 6; deeper += 1) delete stack[deeper];

      if (seen.has(key)) {
        report(sink, 'major', 'COL-S14', file, lineNo,
          `小节号重复：${key}（另见第 ${seen.get(key)} 行）`, line.trim().slice(0, 60));
      } else {
        seen.set(key, lineNo);
      }
      return;
    }

    if (inExampleSection) { counters.skipped += 1; return; }

    // COL-S08：只扫**活区**里的引用。文档里的反引号 token 只有在「源表名已登记」时
    //   才算引用 —— 否则 `delete[]`、`parts[]`、`assets[].sha256` 这类正文代码会被
    //   当成悬空引用（这正是我们实测踩过的误报形态）。
    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      const token = match[1];
      if (!/^[A-Za-z_][\w-]*\[/.test(token)) continue;
      const one = parseRefItem(token);
      if (!one.ok) { counters.skipped += 1; continue; }
      if (!registeredTables.has(one.table)) { counters.skipped += 1; continue; }
      counters.refs += 1;
    }
  });

  return { sink, counters };
}

// ── COL-R28：闭集漂移检查 ────────────────────────────────────────────────────
// 闭集的唯一定义处是 `规则契约.md`；上面那份是**执行副本**。启动时读回原文比对，
// 不一致即 major —— 这样「唯一处」是**可机检的**，不是一句自觉（规则契约 §5.3）。
function checkEnumDrift() {
  let contractPath;
  try { contractPath = new URL('../references/规则契约.md', import.meta.url); } catch { return null; }
  if (!existsSync(contractPath)) return null;
  const line = readFileSync(contractPath, 'utf8').split(/\r?\n/)
    .find(l => l.includes('COL-S04') && l.includes('只许五值'));
  if (!line) return { ok: false, why: '规则契约里找不到 COL-S04 的取值行' };
  const found = [...line.matchAll(/`([^`]+)`/g)].map(m => m[1])
    .filter(v => v !== 'COL-S04' && v !== '状态');
  const same = found.length === STATUS_VALUES.length && found.every((v, i) => v === STATUS_VALUES[i]);
  return same ? { ok: true } : { ok: false, why: `规则契约：${found.join('／')} ≠ 脚本：${STATUS_VALUES.join('／')}` };
}

// ── 数值不变量（COL-S09，v0.5 新增）──────────────────────────────────────────
// ⛔ v0.4 的检查器**没有实现 COL-S09** —— 于是「三查」实际只有两查，而 `完成判据.md` §3.1
//    把三查并列写成一张表。这和 v0.3 那条「和**已有的** check.mjs 同套路」是同一类病：
//    **声明的检查项没有执行者**。
//
// 实测依据：虚构类专题里那位作者**自己写了一个** `_work/check_invariants.py`（因为技能包不给），
// 五条本地可证明的不变量，在 **778 行真实数值表**上跑出 `found 0`。
// 本函数把那五条里**与专题无关**的两条提出来直接机检，另外两条（单调性／基数）补上**声明语法** ——
// 因为不声明就没法机检，而「只给词不给语法」正是 §7.6 那条元规则说的病根。
//
// 四类，**全部 major，禁止降为 advisory**（COL-S09）：
//   INV-RANGE   区间自洽：`值` 写成 `a～b` 时必须 a ≤ b            —— 不需要声明
//   INV-UNIT    单位一致：同一 `(对象,属性)` 的真单位必须唯一       —— 不需要声明
//   INV-LADDER  阶梯单调：`阶梯单调：品质D < 品质C < … < 品质S`    —— 需要声明
//   INV-SCALE   倍数关系：`倍数关系：X｜p = 2 × Y｜q`              —— 需要声明
//
// 档位的三处**故意不对称**（照抄文件头 27–28 行那条既有政策）：
//   · 不变量**被破坏** → major（拦交付）
//   · 声明**语法不对** → advisory（作者的写法问题，不是数据错）
//   · 声明的**操作数在表里取不到** → advisory（可能是拼写差异，误报防线）
//
// ⛔ 每一类都要**打印自己查了几个单元**（COL-S07／COL-R17）：
//    参考脚本报 `found 0`，却没打「区间匹配到几个」—— 一个都没匹配上的话，那个 0 就是假绿灯。
//    本函数把它拆成 inv-range ／ inv-unit-groups ／ inv-ladder-cells ／ inv-scale 四个计数。
//
// ⛔ 结构识别**按表头名定位列**，不按列序、不靠英文关键词（完成判据 §3.2）。
const INV_RANGE_RE = /^(-?\d+(?:\.\d+)?)\s*[～~]\s*(-?\d+(?:\.\d+)?)$/;
const INV_NUM_RE = /^-?\d+(?:\.\d+)?$/;
const INV_UNIT_UNANNOTATED = '源未标注'; // 接口 §5.1 的**哨兵**，不是单位
const INV_DECL_RE = /^\s*[-*]\s*(阶梯单调|倍数关系)\s*[：:]\s*(.+?)\s*$/;
const INV_ROW_RE = /^\|/;
const INV_SEP_RE = /^\|[\s:|-]+\|?\s*$/;
// ⛔ 空态标记。接口**没定义**这个写法，但真实语料里有 **18 处**，而且是 `_work/split_tables.py`
//    自动生成的：「拆子专题后这张表在本子专题里没有」。
//    不认它 → 把「作者明确写了没有」误报成 PARSE_EMPTY。**实测踩到**
//    （`剧情人物-身世/02_设定表.md:26`，整节只有一行 `（本子专题无）`）—— 而参考脚本
//    `check_invariants.py` 有**同一个 bug**，只是它只跑合并稿，从没走到这条路上。
const INV_EMPTY_MARK_RE = /^\s*(?:[（(][^）)]*无[^）)]*[）)]|暂无|无|N\/A|n\/a|—|–)\s*$/;
// ⛔ **占位行的判据**（v0.5 补 —— 实测撞出来的）：`对象`／`属性`／`值` 三格同时是这些值。
//    空串也算 —— 一格空可能是漏填，**三格全空只可能是占位**。
const INV_PLACEHOLDER_RE = /^\s*(?:—|–|―|-|－|\/|N\/A|n\/a|无|暂无|待补|待定|\.\.\.|…)?\s*$/;

function invCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

function scanInvariants(lines, file) {
  const sink = makeSink();
  const counters = {
    'inv-rows': 0, 'inv-range': 0, 'inv-unit-groups': 0, 'inv-decl': 0,
    'inv-ladder-cells': 0, 'inv-ladder-skipped': 0,
    'inv-scale': 0, 'inv-scale-skipped': 0, 'inv-explicit-empty': 0, 'inv-placeholder-rows': 0,
  };

  // ① 找「数值表」小节：标题含「数值表」，范围到下一个**同级或更高级**标题为止。
  //    不写死 `## 5.` —— 编号可能变，名字是接口 §5.1 定的。
  const headIdx = lines.findIndex(l => /^#{2,4}\s/.test(l) && l.includes('数值表'));
  if (headIdx < 0) return { sink, counters, applicable: false };
  const headLevel = (/^(#+)/.exec(lines[headIdx]) ?? ['', '##'])[1].length;
  let end = lines.length;
  for (let i = headIdx + 1; i < lines.length; i += 1) {
    const m = /^(#+)\s/.exec(lines[i]);
    if (m && m[1].length <= headLevel) { end = i; break; }
  }
  const section = lines.slice(headIdx, end);

  // ② 声明（可选）。位置不限 —— 整个小节里都认，所以表格前后写都行。
  const ladderDecl = [];
  const scaleDecl = [];
  for (let i = 0; i < section.length; i += 1) {
    const m = INV_DECL_RE.exec(section[i]);
    if (!m) continue;
    counters['inv-decl'] += 1;
    (m[1] === '阶梯单调' ? ladderDecl : scaleDecl).push({ raw: m[2], line: headIdx + i + 1 });
  }

  // ③ 表头定列
  let headerIdx = -1;
  let col = null;
  for (let i = 0; i < section.length; i += 1) {
    if (!INV_ROW_RE.test(section[i])) continue;
    const cells = invCells(section[i]);
    const at = name => cells.indexOf(name);
    if (at('对象') >= 0 && at('属性') >= 0 && at('值') >= 0) {
      headerIdx = i;
      col = { obj: at('对象'), attr: at('属性'), val: at('值'), unit: at('单位') };
      break;
    }
  }
  if (headerIdx < 0) {
    // ⛔ 先问「作者是不是明确写了没有」，再报 PARSE_EMPTY —— 否则「本子专题无」会变成误报。
    //    这是**真实踩到的**（剧情人物-身世），不是假想。
    const explicit = section.some(l => INV_EMPTY_MARK_RE.test(l));
    if (explicit) {
      counters['inv-explicit-empty'] = 1;
      return { sink, counters, applicable: true };
    }
    report(sink, 'major', 'COL-S07', file, headIdx + 1,
      'PARSE_EMPTY：找到「数值表」小节，但表头里没有 `对象`／`属性`／`值` 三列',
      '结构识别失败必须报错，不许静默通过（完成判据 §3.2）');
    return { sink, counters, applicable: true };
  }

  const rows = [];
  const need = Math.max(col.obj, col.attr, col.val);
  for (let i = headerIdx + 1; i < section.length; i += 1) {
    if (!INV_ROW_RE.test(section[i])) break;
    if (INV_SEP_RE.test(section[i])) continue;
    const cells = invCells(section[i]);
    if (cells.length <= need) continue;
    const row = {
      line: headIdx + i + 1,
      obj: cells[col.obj], attr: cells[col.attr], val: cells[col.val],
      unit: col.unit >= 0 && cells.length > col.unit ? cells[col.unit] : '',
    };
    // ⛔ **占位行不是数据行。** 实测：有人为了"先把表画出来"放了一行
    //    `| — | — | — | — | — | — |`，结果被算成 **1 行数据 + 1 个假单位组** ——
    //    **「无行可查」被伪装成了「有行且通过」**。
    //    这是 `COL-S07`「解析到零」的**变体**：不是零，是**假的非零** —— 更难发现。
    //    判据：`对象`／`属性`／`值` 三格**同时**是占位符或空。真数据行不可能三格全空。
    if (INV_PLACEHOLDER_RE.test(row.obj) && INV_PLACEHOLDER_RE.test(row.attr) && INV_PLACEHOLDER_RE.test(row.val)) {
      counters['inv-placeholder-rows'] += 1;
      continue;
    }
    rows.push(row);
  }
  counters['inv-rows'] = rows.length;
  if (rows.length === 0) {
    if (section.some(l => INV_EMPTY_MARK_RE.test(l))) {
      counters['inv-explicit-empty'] = 1;
      return { sink, counters, applicable: true };
    }
    // ⛔ 只有占位行 —— 这**不是**「解析到零」，是「用占位符冒充了数据行」。
    //    单独报一条，因为「解析到 0 行数据」在明明有行的时候读起来是错的（实测撞出来的）。
    if (counters['inv-placeholder-rows'] > 0) {
      report(sink, 'major', 'COL-S07', file, headIdx + 1,
        `PARSE_EMPTY：数值表只有 ${counters['inv-placeholder-rows']} 行占位符，没有数据行`,
        '占位行不算数据 —— 空态请写「（本子专题无）」；否则计数行会把「无行可查」显示成「有行且通过」（实测踩过）');
      return { sink, counters, applicable: true };
    }
    report(sink, 'major', 'COL-S07', file, headIdx + 1,
      'PARSE_EMPTY：找到「数值表」小节，但解析到 0 行数据',
      '解析到零必须报错，不许静默通过（完成判据 §3.2）');
    return { sink, counters, applicable: true };
  }

  // ── INV-RANGE：区间自洽 ────────────────────────────────────────────────────
  for (const row of rows) {
    const m = INV_RANGE_RE.exec(row.val);
    if (!m) continue;
    counters['inv-range'] += 1;
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (lo > hi) {
      report(sink, 'major', 'COL-S09', file, row.line,
        `INV-RANGE｜区间上下界颠倒：${row.obj}｜${row.attr} = ${row.val}`,
        `下界 ${lo} > 上界 ${hi}（COL-S09，禁止降为 advisory）`);
    }
  }

  // ── INV-UNIT：单位一致 ─────────────────────────────────────────────────────
  // `源未标注` 是接口定义的**哨兵**（源里没写单位），不是单位 —— 它不参与比较，
  // 否则「同一属性一行标了 % 一行标了 源未标注」会被误报成冲突。
  const unitGroups = new Map();
  for (const row of rows) {
    if (!row.unit || row.unit === INV_UNIT_UNANNOTATED) continue;
    const key = `${row.obj}\u0000${row.attr}`;
    if (!unitGroups.has(key)) unitGroups.set(key, { units: new Set(), lines: [] });
    const g = unitGroups.get(key);
    g.units.add(row.unit);
    g.lines.push(row.line);
  }
  counters['inv-unit-groups'] = unitGroups.size;
  for (const [key, g] of unitGroups) {
    if (g.units.size <= 1) continue;
    const [obj, attr] = key.split('\u0000');
    report(sink, 'major', 'COL-S09', file, g.lines[0],
      `INV-UNIT｜同一「对象｜属性」出现多个单位：${obj}｜${attr} → ${[...g.units].sort().join(' / ')}`,
      `涉及行 ${g.lines.join('、')}；单位不一致的数值没法比较（COL-S09）`);
  }

  // ── INV-LADDER：阶梯单调（需声明）──────────────────────────────────────────
  for (const decl of ladderDecl) {
    const ladder = decl.raw.replace(/`/g, '').split('<').map(s => s.trim()).filter(Boolean);
    if (ladder.length < 2) {
      report(sink, 'advisory', 'COL-S09', file, decl.line,
        `INV-LADDER｜阶梯声明解析不出至少两级：${decl.raw}`,
        '语法：`阶梯单调：<对象1> < <对象2> < …`（接口 §5.0）');
      continue;
    }
    const order = new Map(ladder.map((name, i) => [name, i]));
    const used = new Set();
    const byAttr = new Map();
    for (const row of rows) {
      if (!order.has(row.obj)) continue;
      used.add(row.obj);
      if (!byAttr.has(row.attr)) byAttr.set(row.attr, []);
      byAttr.get(row.attr).push(row);
    }
    // ⛔ 这里**故意不是 per-member advisory**：第一版我写成「阶梯上每个没出现的对象报一条
    //    advisory」，负9 夹具（真实语料切片）立刻报 2 条 —— 因为**只覆盖部分等级是合法的**
    //    （表里只有 D/C/S 有数据很常见）。按「误报比漏报更伤」：
    //      · 一个成员都没出现 → advisory（声明与表内容**完全**对不上，基本是写错了表）
    //      · 只出现一部分     → info（透明声明，rc=0）—— 让人看得见，但不拦交付
    const missing = ladder.filter(name => !used.has(name));
    if (missing.length === ladder.length) {
      report(sink, 'advisory', 'COL-S09', file, decl.line,
        `INV-LADDER｜阶梯声明与数值表完全对不上：${ladder.join(' < ')} 一个都没出现`,
        '声明写错表了，或对象名拼写不同 —— 按 advisory，不拦交付');
    } else if (missing.length > 0) {
      report(sink, 'info', 'COL-S09', file, decl.line,
        `INV-LADDER｜阶梯上有 ${missing.length} 级在数值表里没有行：${missing.join('、')}`,
        `已比对 ${ladder.length - missing.length}/${ladder.length} 级 —— 只覆盖部分等级是合法的`);
    }
    for (const [attr, group] of byAttr) {
      const seq = [];
      for (const row of group) {
        if (!INV_NUM_RE.test(row.val)) { counters['inv-ladder-skipped'] += 1; continue; }
        seq.push({ i: order.get(row.obj), v: Number(row.val), line: row.line, obj: row.obj });
      }
      seq.sort((a, b) => a.i - b.i);
      counters['inv-ladder-cells'] += seq.length;
      for (let k = 1; k < seq.length; k += 1) {
        if (seq[k].i === seq[k - 1].i) continue; // 同一级两行，比大小没意义
        if (seq[k].v < seq[k - 1].v) {
          report(sink, 'major', 'COL-S09', file, seq[k].line,
            `INV-LADDER｜阶梯非单调：${attr} 从 ${seq[k - 1].obj} 的 ${seq[k - 1].v} 降到 ${seq[k].obj} 的 ${seq[k].v}`,
            `阶梯 ${ladder.join(' < ')}；上一级在 ${file}:${seq[k - 1].line}（COL-S09，禁止降为 advisory）`);
        }
      }
    }
  }

  // ── INV-SCALE：倍数关系（需声明）───────────────────────────────────────────
  for (const decl of scaleDecl) {
    const raw = decl.raw.replace(/`/g, '');
    const m = /^(.+?)\s*=\s*(-?\d+(?:\.\d+)?)\s*[×xX*]\s*(.+?)$/.exec(raw);
    const side = s => {
      const p = s.split(/[｜|]/);
      return p.length === 2 && p[0].trim() && p[1].trim()
        ? { obj: p[0].trim(), attr: p[1].trim() } : null;
    };
    const lhs = m ? side(m[1]) : null;
    const rhs = m ? side(m[3]) : null;
    if (!lhs || !rhs) {
      report(sink, 'advisory', 'COL-S09', file, decl.line,
        `INV-SCALE｜倍数声明语法不对：${decl.raw}`,
        '语法：`倍数关系：<对象>｜<属性> = <正数> × <对象>｜<属性>`（接口 §5.0）');
      continue;
    }
    const pick = ref => {
      const hit = rows.find(r => r.obj === ref.obj && r.attr === ref.attr && INV_NUM_RE.test(r.val));
      return hit ? { v: Number(hit.val), line: hit.line } : null;
    };
    const L = pick(lhs);
    const R = pick(rhs);
    if (!L || !R) {
      counters['inv-scale-skipped'] += 1;
      const missing = [!L ? `左式 ${lhs.obj}｜${lhs.attr}` : '', !R ? `右式 ${rhs.obj}｜${rhs.attr}` : '']
        .filter(Boolean).join('、');
      report(sink, 'advisory', 'COL-S09', file, decl.line,
        `INV-SCALE｜倍数关系的操作数在数值表里取不到数值：${missing}`,
        `声明 ${decl.raw} —— 按 advisory，不拦交付（可能是拼写差异）`);
      continue;
    }
    counters['inv-scale'] += 1;
    const k = Number(m[2]);
    if (Math.abs(L.v - k * R.v) > 1e-9 * Math.max(1, Math.abs(L.v))) {
      report(sink, 'major', 'COL-S09', file, L.line,
        `INV-SCALE｜倍数关系不成立：${lhs.obj}｜${lhs.attr} = ${L.v}，` +
        `但 ${k} × ${rhs.obj}｜${rhs.attr}(${R.v}) = ${k * R.v}`,
        `声明见 ${file}:${decl.line}（COL-S09，禁止降为 advisory）`);
    }
  }

  return { sink, counters, applicable: true };
}

// ── 计数器合并（防「静默变 NaN」）─────────────────────────────────────────────
// ⛔ 这个函数是**踩出来的**：`scanInvariants` 返回了 `inv-explicit-empty`，而主流程的 `totals`
//    里没登记它 → `undefined + 1 = NaN` → `NaN > 0` 是 false → **那一格永远不显示**，
//    也不报错。和 `COL-R28`（闭集执行副本漂移）是同一个病：**两份名单，漂移无声**。
//    → 扫描器返回未登记的键 = major `ENUM_DRIFT`，绝不让它静默变成 NaN。
function mergeCounters(dest, src, file, sink) {
  for (const key of Object.keys(src)) {
    if (!(key in dest)) {
      report(sink, 'major', 'ENUM_DRIFT', file, 0,
        `计数器未在 totals 里登记：${key}`,
        '新增计数器必须同时加进主流程的 totals —— 否则它会静默变成 NaN，那一格永远不显示');
      dest[key] = 0;
    }
    dest[key] += src[key];
  }
}

// ── 设定表内部引用（`COL-S02` 的延伸，v0.5 新增）─────────────────────────────
// ⛔ **实测缺口**：`check.mjs` 原本只实现了 `COL-S02` 的「`引用路径` 可达性」，
//    **没实现设定表内部的悬空引用** —— 关系表里的 `A`／`B`、时间线的「涉及」，
//    指向的实体名在**实体表**里到底存不存在，**没人查**。
//    实测一轮虚构专题的作者因此改为人核，并在报告里写明「**人核 —— 不能声称脚本已过**」。
//    而 `完成判据.md` §3.1 的「三查」里，**schema 漂移与悬空引用在虚构类上就靠这个**。
//
// ⚠️ **档位：`info`（汇总成一条），不是 major 也不是 advisory。**
//    ⛔ **实测在真实语料上 72/72 全是误报** —— 抽样看到的：
//      · 「属性完整倍率」「完整状态循环」是**概念／机制**，本来就不是实体
//      · 「优纪[ALO]」是实体，但没登记在**本子专题**的实体表里
//    **根因：前提不成立** —— 实测语料的关系表 `A`／`B` **不限于实体表里的东西**。
//    ⚠️ **但这份语料是 v0.5 之前采的**，而「关系表只收结构关系」那条（`COL-S05` / 接口 §5.2.0）
//    是 **v0.5 才加的** —— 所以**不能用它判这条规则错**。
//    → 处置：**降为 `info` 并汇总成一条**（不逐条刷屏、不冒充 finding），
//      **等有 post-§5.2.0 的语料再定档位**。这是本项目对"新检查项"的一贯做法。
function scanSettingRefs(lines, file) {
  const sink = makeSink();
  const counters = { 'ref-entities': 0, 'ref-relations': 0, 'ref-dangling': 0 };

  const sections = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^##\s+(?:\d+\.\s*)?(.+?)\s*$/.exec(lines[i]);
    if (m) sections.push({ name: m[1], start: i, end: lines.length });
  }
  for (let i = 0; i < sections.length - 1; i += 1) sections[i].end = sections[i + 1].start;
  const find = kw => sections.find(s => s.name.includes(kw));

  const rowsOf = (sec) => {
    if (!sec) return { header: null, rows: [] };
    const out = [];
    let header = null;
    for (let i = sec.start; i < sec.end; i += 1) {
      if (!INV_ROW_RE.test(lines[i]) || INV_SEP_RE.test(lines[i])) continue;
      const cells = invCells(lines[i]);
      if (!header) { header = cells; continue; }
      out.push({ line: i + 1, cells });
    }
    return { header, rows: out };
  };

  // ① 实体表 → 名字 + 别名
  const ent = find('实体表');
  const names = new Set();
  const { header: eh, rows: er } = rowsOf(ent);
  if (eh) {
    const ci = Math.max(0, eh.indexOf('名字'));
    const ai = eh.indexOf('别名');
    for (const r of er) {
      const n = (r.cells[ci] ?? '').trim();
      if (n && !INV_PLACEHOLDER_RE.test(n)) names.add(n);
      if (ai >= 0) {
        for (const a of (r.cells[ai] ?? '').split(/[／/、,，]/)) {
          const t = a.trim();
          if (t && !INV_PLACEHOLDER_RE.test(t)) names.add(t);
        }
      }
    }
  }
  counters['ref-entities'] = names.size;
  if (names.size === 0) return { sink, counters, applicable: false };

  // ② 关系表 → A / B 在不在 names 里（**汇总成一条 info**，不逐条刷屏）
  const { header: rh, rows: rr } = rowsOf(find('关系表'));
  const missing = [];
  if (rh) {
    const ai = Math.max(0, rh.indexOf('A'));
    const bi = rh.indexOf('B');
    for (const r of rr) {
      counters['ref-relations'] += 1;
      for (const [label, idx] of [['A', ai], ['B', bi]]) {
        if (idx < 0) continue;
        const v = (r.cells[idx] ?? '').trim();
        if (!v || INV_PLACEHOLDER_RE.test(v) || names.has(v)) continue;
        counters['ref-dangling'] += 1;
        if (missing.length < 8) missing.push(`${label}=「${v}」@${r.line}`);
      }
    }
  }
  if (missing.length > 0) {
    report(sink, 'info', 'COL-S02', file, 1,
      `设定表内部引用：关系表有 ${counters['ref-dangling']} 处 A／B 不在实体表里` +
      `（实体表登记了 ${names.size} 个名字）`,
      `${missing.join('；')}${counters['ref-dangling'] > missing.length ? ' …' : ''}` +
      `　⚠️ **实测这一档 72/72 是误报** —— 关系表的 A／B 不限于实体（概念／机制也算），` +
      `且子专题的实体表可能只列了本子专题的。**先按 info 透明声明，等 post-§5.2.0 的语料再定档位。**`);
  }
  return { sink, counters, applicable: true };
}

// ── 口述来源的条目（COL-S17，v0.5 新增）──────────────────────────────────────
// 条件：条目的 `定位` 指向 `_src/作者口述.md`
// 要求：① `证据` 必须是该文件里的**逐字子串**（拦转述）② `复审周期` 必填（作者是活源，COL-R03）
// ⛔ 为什么可机检：口述是**唯一"原本没有文件"的一手来源**。物化成 `_src/作者口述.md` 之后，
//    「账本里的引文 ↔ 口述记录里的原文」就变成**两份文件之间的字符串包含关系** —— 与 COL-S02 同构。
// ⛔ 它拦的是转述：把「不会公开」转述成「没有」，字符串当场不匹配。
const ORAL_REL = '_src/作者口述.md';
const ORAL_SHORT = 4;   // 短于这个长度的引文判定不了是否逐字（典型：选项式回答只有 `A`）

function scanOralRefs(lines, file, opts = {}) {
  const sink = makeSink();
  const counters = {
    'oral-checked': 0, 'oral-skipped': 0,
    'oral-not-literal': 0, 'oral-no-pin': 0, 'oral-too-short': 0,
  };

  // 口述正文：夹具用 `oralText` 内联，主流程用 `oralPath` 读盘。
  // ⛔ 读不到 = **计数后退出，不报 major** —— 不许把「这一轮没口述」报成作者的缺陷。
  let oralText = opts.oralText ?? null;
  if (oralText == null && opts.oralPath && existsSync(opts.oralPath)) {
    oralText = readFileSync(opts.oralPath, 'utf8');
  }
  if (oralText == null) { counters['oral-skipped'] = 1; return { sink, counters }; }

  // 全篇 `复审周期` 声明（与 COL-R04 的全篇 `钉死` 同构；只在文件头部找）
  const globalPin = /复审周期[\s\S]{0,300}?(?:时效：none|逐条按|统一)/.test(
    lines.slice(0, 40).join('\n'));

  // 切条目：`- **X-nn**｜` 起，到下一条目或 EOF
  const starts = [];
  lines.forEach((l, i) => { if (/^-\s*\*\*[ABC]-\d{2}\*\*/.test(l)) starts.push(i); });

  for (let k = 0; k < starts.length; k++) {
    const from = starts[k];
    const to = (k + 1 < starts.length) ? starts[k + 1] : lines.length;
    const block = lines.slice(from, to);
    const locIdx = block.findIndex(l => /^\s*-\s*定位：/.test(l));
    if (locIdx < 0 || !block[locIdx].includes(ORAL_REL)) continue;   // 不是口述来源 → 本条不管
    counters['oral-checked'] += 1;
    const id = (/^-\s*\*\*([ABC]-\d{2})\*\*/.exec(lines[from]) || [, '?'])[1];

    // ① `证据` 必须是口述文件的逐字子串
    const evLine = block.find(l => /^\s*-\s*证据：/.test(l));
    if (!evLine) {
      report(sink, 'major', 'COL-S17', file, from + 1,
        `${id}：口述来源的条目没有 \`证据\` 字段`,
        `证据必须是 \`${ORAL_REL}\` 里的逐字子串`);
    } else {
      const raw = evLine.replace(/^\s*-\s*证据：/, '').trim();
      const quoted = [...raw.matchAll(/`([^`]+)`/g)].map(m => m[1]);
      // ⛔ **只取第一个反引号段** —— 那才是引文；后面往往跟着说明文字。
      //    实测**假阴性**：`证据：答 \`A\`（…见 \`_src/作者口述.md\` 的「问答对照表」）`
      //    第二段是**文件路径**，而它恰好在口述文件里出现过 → "命中"了 → 一条真该报的短引文被放过。
      //    （`A-22` 与 `A-23` 形态几乎一样，一个漏一个报，差别就在这句里有没有那个路径。）
      const cands = quoted.length ? [quoted[0]] : [raw];
      const longHits = cands.filter(q => q.length >= ORAL_SHORT && oralText.includes(q));
      if (longHits.length === 0) {
        const allShort = cands.every(q => q.length < ORAL_SHORT);
        if (allShort) {
          // 全是短引文（典型：作者只答了 `A`）—— 命中也判定不了什么 → advisory，不是 major
          counters['oral-too-short'] += 1;
          report(sink, 'advisory', 'COL-S17', file, from + 1,
            `${id}：\`证据\` 全是短引文（${cands.map(c => '`' + c + '`').join('／')}）—— 逐字命中判定不了什么`,
            '选项式回答要附「问答对照表」，把选项原文列出，并标明那是**提问方**写的');
        } else {
          counters['oral-not-literal'] += 1;
          report(sink, 'major', 'COL-S17', file, from + 1,
            `${id}：\`证据\` 在 \`${ORAL_REL}\` 里找不到逐字子串 —— 极可能是转述`,
            `引的是：${cands.map(c => '`' + c.slice(0, 40) + '`').join('／').slice(0, 110)}`);
        }
      }
    }

    // ② `复审周期` 必填 —— 作者是活源
    if (!block.some(l => /^\s*-\s*复审周期：/.test(l)) && !globalPin) {
      counters['oral-no-pin'] += 1;
      report(sink, 'major', 'COL-S17', file, from + 1,
        `${id}：口述来源的条目缺 \`复审周期\` —— 作者是活源`,
        'COL-R03：外部活源的 `复审周期` 必填；口述会随作者改主意而失效');
    }
  }
  return { sink, counters };
}

// ── 自检（COL-S15）───────────────────────────────────────────────────────────
// 「没有负样本的 invariant 是装饰」（规则契约 §5）。这段就是让上面那些规则**不是装饰**的东西。
//   · expect  = 必须报出来的（正样本，防漏报）
//   · forbid  = 必须**不**报的（负样本，防误报 —— 误报比漏报更伤，见 完成判据 §3.5）
// 每条 forbid 都是我们**真实踩过的**误报，不是编的。
// 夹具的 `base: 'self'` = 检查器自己所在的 tools/ 目录 —— ③④⑤ 只有指到**真实存在**的文件，
// 才能验「存在／行号越界」两档；指到不存在的文件就只能验 advisory 那一档。
const TOOLS_DIR = fileURLToPath(new URL('.', import.meta.url));
const L = (...ls) => ls;
const FIXTURES = [
  // ── 正样本：必须报 ────────────────────────────────────────────────────────
  { name: '正1 编号重复', kind: 'ledger', expect: [['COL-S01', 'major']],
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '- **A-01**｜状态：一手已核｜断言：第二条断言内容足够长') },
  { name: '正2 引用路径空下标', kind: 'ledger', expect: [['COL-S02', 'major']],
    lines: L('## 0. 源表登记', '| code_index | lib/index.js:86 | 数组长度 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`code_index[].since`') },
  { name: '正3 源表未登记', kind: 'ledger', expect: [['COL-S02', 'major']],
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`never_registered[k]`') },
  { name: '正4 状态不在闭集', kind: 'ledger', expect: [['COL-S04', 'major']],
    lines: L('- **A-01**｜状态：大概对｜断言：第一条断言内容足够长') },
  { name: '正5 日期格式错', kind: 'ledger', expect: [['COL-S03', 'major']],
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 拿到：2026/10/07') },
  { name: '正6 钉死取值不在闭集', kind: 'ledger', expect: [['COL-R04', 'major']],
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 钉死：上次看的那一版') },
  { name: '正7 解析到零', kind: 'ledger', expect: [['COL-S07', 'major']], expectEntries: 1,
    lines: L('# 空账本') },
  { name: '正8 条目标题缺字段', kind: 'ledger', expect: [['COL-S12', 'major']],
    lines: L('- **A-01**｜状态：一手已核') },
  { name: '正9 文档小节号重复（同父同层）', kind: 'docs', expect: [['COL-S14', 'major']],
    lines: L('## 13. 甲', '## 13. 乙') },
  // ⛔ 实测回归：324 条的合并稿只解析到 98 条、226 条无声消失、`major=0`、退出码 0。
  //    根因：严格正则 `[ABC]-\d{2}` 匹配不上 `A-100`，整行被静默跳过（违反 COL-S12）。
  { name: '正17 ⛔ 三位编号必须报出来，不许静默跳过', kind: 'ledger', expect: [['COL-S01', 'major']],
    lines: L('## 0. 源表登记', '| t | a.md:1 | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '- **A-100**｜状态：一手已核｜断言：第一百条断言内容足够长',
             '  - 钉死：commit:a1b2c3d') },
  { name: '正10 代码块里的 # 不参与，但真重复仍要报', kind: 'docs', expect: [['COL-S14', 'major']],
    lines: L('## 1. 甲', '```', '# 4) 自检', '```', '## 1. 乙') },

  // ── 负样本：必须**不**报（这才是防误报的那一半）─────────────────────────────
  // 负1 引用路径的真实写法：尾段可省、多值、尾注释、嵌套下标
  { name: '负1 引用路径四种真实写法', kind: 'ledger', forbid: ['COL-S02', 'COL-R04'],
    lines: L('## 0. 源表登记', '| launcher | Scripts/x.ps1:1 | 键名 |', '| builder | Scripts/y.ps1:1 | 版本号 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`launcher[ScriptFileName]`（入口侧）；`builder[New-ZdManifest].assets[0].parts`',
             '  - 钉死：commit:a1b2c3d') },
  // 负2 一行多个字段（`｜` 分隔）—— 不切开就会把后两个字段当成第一个字段的值
  { name: '负2 一行多字段里的日期', kind: 'ledger', forbid: ['COL-S03'],
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 拿到：2026-10-07 ｜核对：2026-10-07 ｜检查方式：看这两行',
             '  - 钉死：工作区@2026-10-07+未提交') },
  // 负3 全篇声明写在散文里、值在下一行（实测就是这个形态）
  { name: '负3 散文式全篇钉死声明', kind: 'ledger', forbid: ['COL-R04'],
    lines: L('**`钉死` 口径**：靶子仓库工作区未提交，没有可用的 commit/tag。',
             '全篇统一钉死为 **`工作区@2026-10-07（HEAD 69c2947 + 未提交改动）`** —— 逐条不再重复书写。',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长') },
  { name: '负4 不同父节下的同名子节号', kind: 'docs', forbid: ['COL-S14'],
    lines: L('## 3. 甲', '### 1. 子', '## 4. 乙', '### 1. 子') },
  { name: '负5 正文里的代码方括号不是引用', kind: 'docs', forbid: ['COL-S02'],
    lines: L('## 1. 甲', '删除项写进 `delete[]`；分卷在 `parts[]` 里；`assets[].sha256` 是整包语义。') },
  { name: '负6 代码块里的 # 不产生标题', kind: 'docs', expect: [],
    lines: L('## 1. 甲', '```powershell', '# 4) 自检', '```', '正文') },

  // ── v0.5 新增六项的夹具（正／负成对）────────────────────────────────────────
  // 全部来自同一轮真实使用（99 条条目的账本）。`base: 'self'` = 指到检查器自己所在的 tools/。
  // 正11 ①：定位**真被解析**。四形态认得下来，自造前缀（`:589`／`:266-L272`）必须**计数**。
  { name: '正11 定位四形态认下来、自造前缀计入 locator-skipped', kind: 'ledger', base: 'self',
    expectCounters: { locators: 4, 'locator-skipped': 2, 'locator-checked': 2, 'locator-unchecked': 2 },
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 定位：`check.mjs:12`；`check.mjs:1-5`；https://example.com/x#sec；`parseRefItem`；`:589`；`x.ps1:266-L272`',
             '  - 钉死：commit:a1b2c3d') },
  // 正12 ③：行号越界 → major（越界一定是错的，不是「未入库」那种合法例外）
  //   ⚠️ ③ 的规格要求「实际位置」里的路径**带 `\` 或 `/`**，所以夹具写 `./check.mjs`（④ 不要求）
  { name: '正12 源表「实际位置」行号越界（③，必须 major）', kind: 'ledger', base: 'self',
    expect: [['COL-S02', 'major']],
    lines: L('## 0. 源表登记', '| `self` | `./check.mjs:99999` | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 钉死：commit:a1b2c3d') },
  // 正13 ③④：文件不存在 → **只许 advisory**（未入库的工作区文件是合法的），不许 major
  { name: '正13 定位／源表位置指向不存在的文件（③④，只许 advisory）', kind: 'ledger', base: 'self',
    expect: [['COL-S02', 'advisory'], ['COL-R12', 'advisory']],
    lines: L('## 0. 源表登记', '| `draft` | `updates\\某草案.md:1` | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 定位：`updates\\某草案.md:1`',
             '  - 钉死：commit:a1b2c3d') },
  // 正14 ④：条目定位的行号越界 → major COL-R12
  { name: '正14 条目「定位」行号越界（④／COL-R12，必须 major）', kind: 'ledger', base: 'self',
    expect: [['COL-R12', 'major']],
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 定位：`check.mjs:99999`',
             '  - 钉死：commit:a1b2c3d') },
  // 正15 ⑤：实测唯一一条被机检抓出来的实质错误 —— 主键在它声称的源表文件里根本不存在。
  //   靶子刻意**不是** check.mjs 自己：夹具源码就写在 check.mjs 里，写什么主键都会「字面命中」自己。
  { name: '正15 引用主键在源表文件里字面找不到（⑤，必须 major）', kind: 'ledger', base: 'self',
    expect: [['COL-S02', 'major']],
    lines: L('## 0. 源表登记', '| `spec` | `../references/规则契约.md:1` | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`spec[防火墙]`',
             '  - 钉死：commit:a1b2c3d') },
  // 正16 ②：`矛盾：X` 指向一个不存在的条目（插入失败没落地，实测报过 major=0）
  { name: '正16 「矛盾」指向的条目不存在（②／COL-S06，必须 major）', kind: 'ledger',
    expect: [['COL-S06', 'major']],
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 矛盾：A-96',
             '  - 钉死：commit:a1b2c3d',
             '',
             '#### 未决',
             '- `A-96`｜状态：未决｜分歧点：编号对不上｜解除条件：等下一轮复核') },

  // ⛔ 负7 = **实测产生过 2 条误报的那个形状**：反引号包裹的路径 + 尾随中文注释。
  //   解析顺序（先切尾注释、再剥反引号）错了就解不出来；文件不存在也只许 advisory，
  //   而且作者已注明「工作区文件，被 .gitignore 排除」时连 advisory 都不该有（规则要的事已经做了）。
  { name: '负7 ⛔实测误报形状：反引号路径+尾随中文注释（未入库工作区文件）', kind: 'ledger', base: 'self',
    expectCounters: { locators: 1, 'locator-skipped': 0, 'key-skipped': 1 },
    lines: L('## 0. 源表登记', '| `draft` | `updates\\某草案.md:1`（工作区文件，被 .gitignore 排除） | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 定位：`updates\\某草案.md:1`（工作区文件，被 .gitignore 排除）',
             '  - 引用路径：`draft[防火墙]`',
             '  - 钉死：commit:a1b2c3d') },
  // 负8 ④：URL／符号名／无行号路径是合法形态，文件存在性检查无从下手 → 跳过并计数，不报
  { name: '负8 定位是 URL／符号名／无行号路径时不报（跳过并计数）', kind: 'ledger', base: 'self',
    expectCounters: { locators: 3, 'locator-checked': 0, 'locator-unchecked': 3, 'locator-skipped': 0 },
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 定位：https://example.com/a#sec；`parseRefItem`；`Services/Update/UpdateService.cs`（白名单分桶）',
             '  - 钉死：commit:a1b2c3d') },
  // 负9 ⑥：不传 --base 时 ③④⑤ 全部跳过 —— 连行号越界都不许报（完成判据 §3.8：跳过合法，但要明示）
  { name: '负9 不传 --base 时③④⑤全部跳过（行号越界也不许报）', kind: 'ledger',
    lines: L('## 0. 源表登记', '| `self` | `./check.mjs:99999` | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 定位：`check.mjs:99999`',
             '  - 引用路径：`self[防火墙]`',
             '  - 钉死：commit:a1b2c3d') },
  // 负10 ⑤：主键真的字面命中 → 不报
  { name: '负10 引用主键字面命中的不报（⑤负样本）', kind: 'ledger', base: 'self',
    expectCounters: { 'key-checked': 1, 'key-skipped': 0 },
    lines: L('## 0. 源表登记', '| `self` | `check.mjs:1` | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`self[parseRefItem]`',
             '  - 钉死：commit:a1b2c3d') },
  // 负11 ⑤的误报防线：源表文件读不到（不存在／二进制／太大）→ 跳过并计数，**不许**报 major
  { name: '负11 源表文件读不到时⑤跳过并计数、不许 major', kind: 'ledger', base: 'self',
    expectCounters: { 'key-checked': 0, 'key-skipped': 1, 'file-unreadable': 1 },
    // ⚠️ 位置故意用**裸文件名**（无目录分隔符）：这样 ③ 跳过它、只让 ⑤ 去读 —— 本夹具测的是 ⑤。
    //    早先写成 `updates\某草案.md`（带 `\`），③ 补了"无行号也核"之后它会合法地报一条 advisory，
    //    于是这个"应 0 条 finding"的夹具失败。**不是 ③ 错，是夹具的靶子选得不够干净。**
    lines: L('## 0. 源表登记', '| `ghost` | `ghost.md` | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`ghost[防火墙]`',
             '  - 钉死：commit:a1b2c3d') },
  // 正16 ③：源表位置**无行号**也要核到（v1 静默跳过的回归 —— 实测 0/14 tables checked）
  { name: '正16 ③：无行号的源表位置也要核，不许静默跳过', kind: 'ledger', base: 'self',
    expect: [['COL-S02', 'advisory']],
    expectCounters: { 'table-checked': 1, 'table-unchecked': 0 },
    lines: L('## 0. 源表登记', '| `ghost2` | `no/such/file.md` | 键名 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 钉死：commit:a1b2c3d') },
  // 负16 ③：glob／模板／占位符**不是位置**，跳过并计数（实测误报：`…\Artifacts\…\v*`）
  { name: '负16 ③：glob 模式不是路径，只计数不报', kind: 'ledger', base: 'self', expect: [],
    expectCounters: { 'table-checked': 0, 'table-unchecked': 1 },
    lines: L('## 0. 源表登记', '| `artifact` | `D:\\X\\Artifacts\\v*` | 版本目录 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 钉死：commit:a1b2c3d') },
  // 负12 ②：矛盾的两侧都是真条目 → 不报
  { name: '负12 矛盾的两侧都是真条目不报（②负样本）', kind: 'ledger',
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 矛盾：A-02',
             '  - 钉死：commit:a1b2c3d',
             '- **A-02**｜状态：一手已核｜断言：第二条断言内容足够长',
             '  - 钉死：commit:a1b2c3d',
             '',
             '#### 未决',
             '- `A-02`｜状态：未决｜分歧点：与 A-01 口径不一致｜解除条件：回原文核') },
  // 负13 ⑤：范围／列表写法的主键不是「字面可核」的形态 → 跳过并计数，不许报 major。
  //   这条来自本轮 --base 实测：靶子账本 A-37 写 `validator[1..7]`（那 7 条检查确实都在），
  //   逐字找 `1..7` 必然找不到 —— 报 major 就是误报。
  { name: '负13 范围型主键（validator[1..7]）跳过并计数、不许 major', kind: 'ledger', base: 'self',
    expectCounters: { 'key-checked': 0, 'key-skipped': 1, 'key-not-literal': 1 },
    lines: L('## 0. 源表登记', '| `validator` | `./check.mjs:1` | 检查序号（文件内 `// n)` 注释） |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`validator[1..7]`',
             '  - 钉死：commit:a1b2c3d') },
  // 负14 ④：一行多条定位却用 `、` 分隔（COL-S10 违规）→ 整串连成**一个**定位项。
  //   实测：`_dryrun/dsh-free-search-readme` 的账本因此吃到 **9 条**假 COL-R12
  //   （「README.md 解析不到文件」——文件明明就在）。这类项不是 COL-S16 的四种形态，
  //   只许计入 `locator-skipped`，不许编一个不存在的文件名去报 advisory。
  { name: '负14 顿号拼接的定位：只计数、不许编出假 advisory', kind: 'ledger', base: 'self',
    expect: [['COL-S10', 'advisory']],   // 「没用 `；` 分隔」这条本来该报，是**指路**，不是误报
    forbidAny: ['COL-R12', 'COL-S02'],
    expectCounters: { locators: 0, 'locator-skipped': 1, 'locator-checked': 0 },
    lines: L('- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 定位：`check.mjs:1-5`（甲表）、`check.mjs:12`（乙表）',
             '  - 钉死：commit:a1b2c3d') },
  // 负15 ⑤的小节号放宽：`req[§13]` 这种主键，文件里通常只写标题号 `## 13. …`，没有 `§`。
  //   实测：`热更新-发布侧需求.md` 里 `§13` 逐字**不存在**，而 `## 13. …` 有两处
  //   （那正是本轮的 COL-S14 真缺陷）——没有这条放宽，一传 --base 就是一片假 major。
  { name: '负15 小节号型主键（§N ↔ 标题号）不许报假 major', kind: 'ledger', base: 'self',
    expectCounters: { 'key-checked': 1, 'key-skipped': 0 },
    lines: L('## 0. 源表登记', '| `spec` | `../references/规则契约.md:1` | 小节号 |',
             '- **A-01**｜状态：一手已核｜断言：第一条断言内容足够长',
             '  - 引用路径：`spec[§2]`',
             '  - 钉死：commit:a1b2c3d') },

  // ── 数值不变量（COL-S09，v0.5 新增）─────────────────────────────────────────
  // 这些夹具的表格行**逐字抄自真实语料** `_实战/_归档-游戏设计文档采集/02_设定表.md`
  // （778 行数值表，2026-10-07），不是编出来的形状 —— 因为这一查最容易死在
  // 「真实写法五花八门，正则只认自己想象的形态」上。
  { name: '正18 INV-RANGE 区间上下界颠倒', kind: 'invariants', expect: [['COL-S09', 'major']],
    expectCounters: { 'inv-range': 1 },
    lines: L('## 5. 数值表', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 以群体伤害为主的护援技 | 5级完整倍率区间（快速入口） | 4.8～3.2 | `num_spec_2d[五级完整倍率快速选择表][群体输出快速入口]` | 倍率 | num_spec_2d:群体输出快速入口 |') },
  { name: '正19 INV-UNIT 同一对象属性两个单位', kind: 'invariants', expect: [['COL-S09', 'major']],
    expectCounters: { 'inv-unit-groups': 1 },
    lines: L('## 5. 数值表', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 优纪[ALO] | 单独上场时速度 | 800 | `yuuki_alo[单独上场]` | 点 | yuuki_alo:单独上场 |',
             '| 优纪[ALO] | 单独上场时速度 | 800 | `yuuki_alo[单独上场]` | 速度 | yuuki_alo:单独上场 |') },
  { name: '正20 INV-LADDER 阶梯非单调', kind: 'invariants', expect: [['COL-S09', 'major']],
    expectCounters: { 'inv-ladder-cells': 3 },
    lines: L('## 5. 数值表', '',
             '- 阶梯单调：品质D < 品质C < 品质B < 品质A < 品质S', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 品质D | 初始攻击力 | 50 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质C | 初始攻击力 | 60 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质B | 初始攻击力 | 55 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |') },
  { name: '正21 INV-SCALE 倍数关系不成立', kind: 'invariants', expect: [['COL-S09', 'major']],
    expectCounters: { 'inv-scale': 1 },
    lines: L('## 5. 数值表', '',
             '- 倍数关系：Main+Sub｜次级属性双人计算上限 = 2 × 单角色｜次级属性原始值', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 单角色 | 次级属性原始值 | 9100 | `num_ref[上限]` | 源未标注 | `num_ref:上限` |',
             '| Main+Sub | 次级属性双人计算上限 | 18000 | `num_ref[上限]` | 源未标注 | `num_ref:上限` |') },
  // ⛔ 「解析到零」在数值表这一侧同样必须拦：参考脚本 `next(...)` 找不到区段时直接
  //    `print` 一句就 `sys.exit(1)`，而**表头认不出来**那条路它是静默 `continue` 的。
  { name: '正22 数值表解析到零', kind: 'invariants', expect: [['COL-S07', 'major']],
    expectCounters: { 'inv-rows': 0 },
    lines: L('## 5. 数值表', '', '（这张表还没填）') },
  { name: '正23 数值表表头认不出', kind: 'invariants', expect: [['COL-S07', 'major']],
    lines: L('## 5. 数值表', '', '| Object | Field | Amount |', '| --- | --- | --- |', '| a | b | 1 |') },

  // ── 负样本：必须**不**报 ────────────────────────────────────────────────────
  // 负9 是这一组里最要紧的一个：它**逐字抄自 778 行真实数值表**里最难缠的那批形状 ——
  //     `源未标注` 哨兵、`闪避（5）`、`约960%`、`无限`、`动态存在`、
  //     `20%／40%／90%／110%／150%`（斜杠并列，**不是**区间）、合规区间 `3.2～4.8`、
  //     以及一个**五级齐全**的真单调阶梯。任何一条被报出来都是误报。
  { name: '负9 真实数值表切片（哨兵单位／非数字值／斜杠并列）', kind: 'invariants',
    forbidAny: ['COL-S09', 'COL-S07'],
    expectCounters: { 'inv-rows': 12, 'inv-range': 1, 'inv-unit-groups': 2, 'inv-ladder-cells': 5 },
    lines: L('## 5. 数值表', '',
             '- 阶梯单调：品质D < 品质C < 品质B < 品质A < 品质S', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 以群体伤害为主的护援技 | 5级完整倍率区间（快速入口） | 3.2～4.8 | `num_spec_2d[五级完整倍率快速选择表][群体输出快速入口]` | 倍率 | num_spec_2d:群体输出快速入口 |',
             '| 优纪[ALO] | 极端配置物理增伤 | 约960% | `yuuki_alo[单独上场]` | 源未标注 | yuuki_alo:单独上场 |',
             '| 优纪[ALO]：圣母圣咏 | 守备 | 闪避（5） | `yuuki_alo[终结技：圣母圣咏][守备]` | 源未标注 | yuuki_alo:守备 |',
             '| SAN | 持续时间 | 无限 | `sinclair[SAN][持续时间]` | 源未标注 | sinclair:持续时间 |',
             '| 专注决斗 | 持续时间 | 动态存在 | `yuuki_alo[特殊效果][持续时间]` | 源未标注 | yuuki_alo:持续时间 |',
             '| 一技能：拼凑的断音 | 界面倍率（技能等级1–5） | 20%／40%／90%／110%／150% | `miku_nt[一技能：拼凑的断音][界面倍率]` | 源未标注 | miku_nt:界面倍率 |',
             '| 品质D | 初始攻击力 | 50 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质C | 初始攻击力 | 60 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质B | 初始攻击力 | 75 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质A | 初始攻击力 | 85 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质S | 初始攻击力 | 100 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| Main+Sub | 双人上限对应实际暴击率 | 58% | `num_ref[Main与Sub双人上限][上限对应实际比例]` | % | `num_ref:Main与Sub双人上限` |') },
  // 负12：阶梯**只覆盖一部分等级**是合法的（表里只有 D/C/S 有数据）→ 不许升级成 major。
  //      第一版我把「阶梯上每个没出现的对象」都报成 advisory，负9 立刻报 2 条 —— 是**我错了**，
  //      不是夹具错了。按「误报比漏报更伤」改成：完全对不上 → advisory；只缺几级 → info（rc=0）。
  { name: '负12 阶梯只覆盖部分等级不算错', kind: 'invariants', forbid: ['COL-S09'],
    expectCounters: { 'inv-ladder-cells': 3 },
    lines: L('## 5. 数值表', '',
             '- 阶梯单调：品质D < 品质C < 品质B < 品质A < 品质S', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 品质D | 初始攻击力 | 50 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质C | 初始攻击力 | 60 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |',
             '| 品质S | 初始攻击力 | 100 | `num_ref[原始数值][攻击力]` | 源未标注 | `num_ref:原始数值` |') },
  // 负13：阶梯声明与表**完全**对不上 → advisory（不是 major）。拼写差异不值得拦交付。
  { name: '负13 阶梯完全对不上只报 advisory', kind: 'invariants', forbid: ['COL-S09'],
    expect: [['COL-S09', 'advisory']],
    lines: L('## 5. 数值表', '',
             '- 阶梯单调：品质D < 品质C < 品质B', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 品质d | 初始攻击力 | 50 | `num_ref[a]` | 源未标注 | `num_ref:a` |',
             '| 品质c | 初始攻击力 | 60 | `num_ref[a]` | 源未标注 | `num_ref:a` |') },
  // 负10：`源未标注` 与真单位混在同一个「对象｜属性」下 —— **不算冲突**。
  //      真实语料里这种组恰好是 0 个（776 组里 281 组全哨兵），所以这条是**照接口定义造的
  //      防线**，不是踩过的误报 —— 如实标注，别混进「真实误报」那一类。
  { name: '负10 哨兵单位与真单位混用不算冲突', kind: 'invariants',
    forbidAny: ['COL-S09'], expectCounters: { 'inv-unit-groups': 1 },
    lines: L('## 5. 数值表', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| Main+Sub | 双人上限对应实际暴击率 | 58% | `num_ref[a]` | % | `num_ref:a` |',
             '| Main+Sub | 双人上限对应实际暴击率 | 58% | `num_ref[b]` | 源未标注 | `num_ref:b` |') },
  // 负11：技术专题**没有** `02_设定表.md` → 这一查不适用，不许报「解析到零」。
  //      实测：11 个子专题里只有虚构类的有 `02_设定表.md`；技术专题走的是外部源文件（接口 §4.0）。
  { name: '负11 没有数值表小节时不适用', kind: 'invariants', forbidAny: ['COL-S09', 'COL-S07'],
    expectCounters: { 'inv-rows': 0 },
    lines: L('# 02 设定表', '', '## 1. 实体表', '| 名字 | 别名 |', '| --- | --- |', '| 甲 | 乙 |') },
  // ⛔ 负14 是**真实踩到的误报**，不是编的：拆子专题后「本子专题没有这张表」写成一行
  //    `（本子专题无）`，我的第一版报 PARSE_EMPTY/major。真实语料里这个写法有 **18 处**，
  //    而且是 `_work/split_tables.py` 自动生成的 —— 不认它就会把每个拆出来的子专题全报红。
  //    参考脚本 `check_invariants.py` 有**同一个 bug**，只是它只跑合并稿，从没走到这条路上。
  { name: '负14 明确的空态标记不算解析到零', kind: 'invariants', forbidAny: ['COL-S09', 'COL-S07'],
    expectCounters: { 'inv-rows': 0, 'inv-explicit-empty': 1 },
    lines: L('## 5. 数值表', '', '（本子专题无）') },
  // ⛔ **实测撞到的真缺陷**（story-crossingvoid 采集那一轮）：作者为了"先把表画出来"放了一行
  //    `| — | — | — | — | — | — |`，结果被算成 **1 行数据 + 1 个假单位组** ——
  //    **「无行可查」被伪装成「有行且通过」**。这是 `COL-S07`「解析到零」的变体：
  //    **不是零，是假的非零** —— 更难发现，因为计数行看起来"查过了"。
  { name: '负15 ⛔ 全占位行不算数据行（实测真缺陷）', kind: 'invariants',
    expect: [['COL-S07', 'major']],   // ← 占位行不算数据，且没写空态标记 → 必须报
    expectCounters: { 'inv-rows': 0, 'inv-placeholder-rows': 1, 'inv-unit-groups': 0 },
    lines: L('## 5. 数值表', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| — | — | — | — | — | — |') },
  // 负16：**只有三格全空才算占位** —— 一格空可能是漏填，不许当占位吞掉（防误报）
  { name: '负16 只有一格空的仍是数据行（防误报）', kind: 'invariants', forbidAny: ['COL-S09', 'COL-S07'],
    expectCounters: { 'inv-rows': 1, 'inv-placeholder-rows': 0 },
    lines: L('## 5. 数值表', '',
             '| 对象 | 属性 | 值 | 引用路径 | 单位 | 来源（表:字段） |',
             '| --- | --- | --- | --- | --- | --- |',
             '| 优纪[ALO] | 单独上场时速度 | 800 | `yuuki_alo[单独上场]` | — | yuuki_alo:单独上场 |') },

  // ── COL-S17 口述来源的条目（v0.5 新增）──────────────────────────────────────
  // 口述是**唯一"原本没有文件"的一手来源**。物化成 `_src/作者口述.md` 之后，
  // 「账本引文 ↔ 口述原文」变成两份文件之间的字符串包含关系 —— 与 COL-S02 同构，可机检。
  { name: '正24 口述证据是转述（原文里找不到逐字子串）', kind: 'oral',
    expect: [['COL-S17', 'major']],
    oralText: '## 2026-10-07\n\n**作者原话：**\n> server 是由用户在服务器上架设的 exe 路径选定的，不会公开\n',
    lines: L('- **A-01**｜状态：一手已核｜断言：这个 exe 不随仓库提供，由使用者自己架设',
             '  - 定位：`_src/作者口述.md:4`',
             '  - 证据：`这个 exe 由使用者自己架设，不会随仓库提供`',
             '  - 复审周期：180d') },
  { name: '正25 口述条目缺 `复审周期`（作者是活源）', kind: 'oral',
    expect: [['COL-S17', 'major']],
    oralText: '## 2026-10-07\n\n> 半成品，我之前测试用的，测试完了才会删除。\n',
    lines: L('- **A-01**｜状态：一手已核｜断言：这些句子是测试用半成品，测完会删',
             '  - 定位：`_src/作者口述.md:3`',
             '  - 证据：`半成品，我之前测试用的，测试完了才会删除。`',
             '  - 检查方式：问作者') },
  { name: '正26 口述条目缺 `证据` 字段', kind: 'oral',
    expect: [['COL-S17', 'major']],
    oralText: '## 2026-10-07\n\n> 不会公开\n',
    lines: L('- **A-01**｜状态：一手已核｜断言：某条口述断言',
             '  - 定位：`_src/作者口述.md:3`',
             '  - 复审周期：90d') },

  // ⛔ 正27 是**真实数据逼出来的假阴性**：`证据` 里除了引文 `A`，还跟着一个**文件路径**
  //    （`_src/作者口述.md`）—— 而那个路径恰好在口述文件里出现过，于是"命中"了，
  //    把一条真该报的短引文放过去。判据：**只认第一个反引号段**。
  { name: '正27 ⛔ 短引文后面跟着一个「在口述文件里出现过的路径」（实测假阴性）', kind: 'oral',
    forbid: [], expect: [['COL-S17', 'advisory']],
    oralText: '## 2026-10-07\n\n> 账本引用时，`定位` 写 `_src/作者口述.md:<行>`。\n\n> A\n',
    lines: L('- **A-01**｜状态：一手已核｜断言：这个插件在 5.8.2 下用着没问题',
             '  - 定位：`_src/作者口述.md:6`',
             '  - 证据：答 `A`（= 用着，没出过问题；选项原文由提问方所写，见 `_src/作者口述.md` 的「问答对照表」）',
             '  - 复审周期：90d') },

  { name: '负17 口述证据逐字命中且填了 `复审周期`（防误报）', kind: 'oral',
    forbidAny: ['COL-S17'],
    oralText: '## 2026-10-07\n\n> 确实是攻击范围，但是还没实装逻辑。\n',
    lines: L('- **A-01**｜状态：一手已核｜断言：AttackCapacity 是攻击范围但未实装',
             '  - 定位：`_src/作者口述.md:3`',
             '  - 证据：`确实是攻击范围，但是还没实装逻辑。`',
             '  - 复审周期：60d') },
  // ⛔ 负18 是**实测形态**：作者只答了一个字母 `A` —— 短引文"命中"了也判定不了什么。
  //    第一版把它当"找不到逐字子串"报 major；正解是 **advisory**（提醒附问答对照表）。
  { name: '负18 ⛔ 选项式回答只有 `A`（实测形态：只许 advisory，不许 major）', kind: 'oral',
    forbid: ['COL-S17'],
    oralText: '## 2026-10-07\n\n> A\n',
    lines: L('- **A-01**｜状态：一手已核｜断言：这个插件在 5.8.2 下用着没问题',
             '  - 定位：`_src/作者口述.md:3`',
             '  - 证据：答 `A`（= 用着，没出过问题）',
             '  - 复审周期：90d') },
  { name: '负19 不是口述来源的条目（定位指向别处，本条不管）', kind: 'oral',
    forbidAny: ['COL-S17'],
    oralText: '> A\n',
    lines: L('- **A-01**｜状态：一手已核｜断言：某个普通的代码断言',
             '  - 定位：`Source/Foo.h:42`',
             '  - 证据：`bEnableX 默认 false`') },
  // ⛔ 负20：「这一轮没有口述」是**合法**的 —— 读不到口述文件只计数，**不许报 major**。
  //    这是 ③④⑤ 那三档「档位写死、不许自行升降」的同一条纪律：不许把「没提供」报成作者的缺陷。
  { name: '负20 ⛔ 没有口述文件时不许报（没口述是合法的）', kind: 'oral',
    forbidAny: ['COL-S17'],
    oralText: undefined,
    lines: L('- **A-01**｜状态：一手已核｜断言：某条来源是口述的断言',
             '  - 定位：`_src/作者口述.md:3`',
             '  - 证据：`随便什么`',
             '  - 复审周期：90d') },
];

function runFixture(fixture) {
  // `base: 'self'` = 检查器自己所在的 tools/ 目录。③④⑤ 要指到**真实存在**的文件，才能验
  // 「存在／行号越界」两档；不传 base 的夹具同时也在验「(no --base) 时全部跳过」。
  const base = fixture.base === 'self' ? TOOLS_DIR : null;
  if (fixture.kind === 'ledger') {
    const { sink, counters } = scanLedger(fixture.lines, '<fixture>', { expectEntries: fixture.expectEntries ?? 0, base });
    return { findings: sink.findings, counters };
  }
  if (fixture.kind === 'invariants') {
    const { sink, counters } = scanInvariants(fixture.lines, '<fixture>');
    return { findings: sink.findings, counters };
  }
  if (fixture.kind === 'oral') {
    // 口述正文**内联**（`oralText`），不落临时文件 —— 夹具要能独立跑。
    // ⛔ 不传 `oralText` = 「这一轮没口述」，必须走「只计数、不报 major」那条路（见负20）。
    const { sink, counters } = scanOralRefs(fixture.lines, '<fixture>',
      { oralText: fixture.oralText });
    return { findings: sink.findings, counters };
  }
  const { sink } = scanDocs(fixture.lines, '<fixture>', new Set(['builder', 'code_index']));
  return { findings: sink.findings, counters: {} };
}

function selftest() {
  const failures = [];
  let checks = 0;

  // ── 直接断言（不走夹具）：计数器漂移必须报 major，不许静默变 NaN ──────────────
  // 这一条是**踩出来的**：`inv-explicit-empty` 加进了扫描器却没加进 `totals`，
  // `undefined + 1 = NaN`，而 `NaN > 0` 是 false → 那一格**永远不显示**，也不报错。
  // 用夹具测不出来（夹具断言的是扫描器自己的 counters），所以单列一条直接断言。
  {
    const sink = makeSink();
    const dest = { known: 0 };
    mergeCounters(dest, { known: 2, surprise: 1 }, '<selftest>', sink);
    checks += 1;
    if (!sink.findings.some(f => f.code === 'ENUM_DRIFT' && f.severity === 'major')) {
      failures.push({ fixture: '直接断言·计数器漂移', why: '未登记的计数器没报 ENUM_DRIFT/major（会静默变 NaN）' });
    }
    checks += 1;
    if (!Number.isFinite(dest.surprise)) {
      failures.push({ fixture: '直接断言·计数器漂移', why: `未登记的计数器合并后不是有限数：${dest.surprise}` });
    }
    checks += 1;
    if (dest.known !== 2) {
      failures.push({ fixture: '直接断言·计数器漂移', why: `已登记的计数器合并错了：应为 2，实际 ${dest.known}` });
    }
  }

  // ── 直接断言：UTF-16 带 BOM 的**文本**不得被判成二进制 ────────────────────────
  // 踩出来的：`buf.includes(0)` 对 UTF-16 恒真（每个 ASCII 字符都含 NUL），于是
  // 仓库里 UTF-16LE 的日志被一律判「二进制」，指着它们的定位全报 advisory。
  {
    const body = 'PASS 甲\nFAIL 乙\n';
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(body, 'utf16le')]);
    const beBody = Buffer.from(body, 'utf16le');
    for (let i = 0; i + 1 < beBody.length; i += 2) { const t = beBody[i]; beBody[i] = beBody[i + 1]; beBody[i + 1] = t; }
    const be = Buffer.concat([Buffer.from([0xfe, 0xff]), beBody]);
    const u8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(body, 'utf8')]);
    const realBin = Buffer.from([0x00, 0x01, 0x02, 0x00]); // 无 BOM 的真二进制

    for (const [name, buf, wantEnc, wantText] of [
      ['UTF-16LE', le, 'utf16le', body],
      ['UTF-16BE', be, 'utf16be', body],
      ['UTF-8 BOM', u8, 'utf8bom', body],
    ]) {
      checks += 1;
      if (detectBom(buf) !== wantEnc) {
        failures.push({ fixture: `直接断言·${name} BOM 识别`, why: `detectBom 应为 ${wantEnc}，实际 ${detectBom(buf)}` });
      }
      checks += 1;
      const got = decodeWithBom(buf, wantEnc);
      if (got !== wantText) {
        failures.push({ fixture: `直接断言·${name} 解码`, why: `解出来是 ${JSON.stringify(got.slice(0, 24))}，应为 ${JSON.stringify(wantText)}` });
      }
    }
    // 负样本：**没有 BOM 的真二进制仍必须判二进制** —— 修 BOM 不许把这条防线拆了
    checks += 1;
    if (detectBom(realBin) !== null) {
      failures.push({ fixture: '直接断言·真二进制', why: '无 BOM 的二进制被当成了带 BOM 的文本（误报防线被拆）' });
    }
  }

  // ── 直接断言：`IMPLEMENTS` 与源码里**真正 report 出来**的集合必须一致（v0.5）─────────
  // 为什么加：这份清单曾在 **4 个文件**里各有一份副本，全都漂了；加了 `COL-S17` 一处没改。
  // 而且它混了三个概念，还出现过「声明 `COL-R01` 不负责、脚本却在报它」的自相矛盾。
  // → 真值只留 `IMPLEMENTS` 一处，这里拿**源码自己**对撞：任一侧多出或缺少都算失败。
  {
    checks += 1;
    const srcText = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const reported = new Set();
    const re = /report\(/g;
    let m;
    while ((m = re.exec(srcText))) {
      // `report(` 之后 90 字符内第一个 `'COL-xxx'` 就是这一句的 ID（第三实参）
      const idm = /'(COL-[SRCT]\d+)'/.exec(srcText.slice(m.index, m.index + 90));
      if (idm) reported.add(idm[1]);
    }
    const declared = new Set(IMPLEMENTS);
    const notDeclared = [...reported].filter(x => !declared.has(x));   // 报了但没声明
    const notReported = [...declared].filter(x => !reported.has(x));   // 声明了但没报
    if (notDeclared.length || notReported.length) {
      failures.push({ fixture: '直接断言·实现清单漂移',
        why: `IMPLEMENTS 与源码不一致｜报了但没声明：${notDeclared.join(' ') || '（无）'}` +
             `｜声明了但没报：${notReported.join(' ') || '（无）'}` });
    }
  }

  for (const fixture of FIXTURES) {
    let findings;
    let counters = {};
    try {
      const result = runFixture(fixture);
      findings = result.findings;
      counters = result.counters;
    } catch (error) {
      failures.push({ fixture: fixture.name, why: `抛异常：${error.message}` });
      continue;
    }
    for (const [code, severity] of fixture.expect ?? []) {
      checks += 1;
      if (!findings.some(f => f.code === code && f.severity === severity)) {
        failures.push({ fixture: fixture.name, why: `应报 ${code}/${severity} 但没报（漏报）` });
      }
    }
    // forbid 只禁 **major** —— advisory／info 不拦交付，而且「透明声明」本来就是
    // 期望行为（例如全篇钉死声明会主动报一条 info）。禁掉它们会把正确行为判成误报。
    for (const code of fixture.forbid ?? []) {
      checks += 1;
      const hit = findings.filter(f => f.code === code && f.severity === 'major');
      if (hit.length > 0) {
        const detail = hit.map(f => `${f.severity}:${f.message}`).join(' ; ');
        failures.push({ fixture: fixture.name, why: `不该报 ${code}/major 却报了 ${hit.length} 条（误报）：${detail}` });
      }
    }
    // forbidAny = 该码**任何档位**都不该出现。`forbid` 只拦 major（advisory／info 不拦交付），
    // 但有一类误报正好长成 advisory：「定位解析不到文件」——文件明明就在，只是那一行没按
    // COL-S10 用 `；` 分隔。这种假 advisory 必须也拦得住，否则它会把真问题淹掉。
    for (const code of fixture.forbidAny ?? []) {
      checks += 1;
      const hit = findings.filter(f => f.code === code);
      if (hit.length > 0) {
        const detail = hit.map(f => `${f.severity}:${f.message}`).join(' ; ');
        failures.push({ fixture: fixture.name, why: `不该报 ${code} 却报了 ${hit.length} 条（误报）：${detail}` });
      }
    }
    // ①③④⑤ 有一半的「报」是**计数**而不是 finding（COL-S08／COL-R17 要的就是「计数打印」），
    // 所以夹具必须能断言计数器 —— 否则「定位解析器整个失效」这类事故在自检里照样是绿的。
    for (const [key, expected] of Object.entries(fixture.expectCounters ?? {})) {
      checks += 1;
      if (!(key in counters)) {
        failures.push({ fixture: fixture.name, why: `断言了不存在的计数器：${key}` });
      } else if (counters[key] !== expected) {
        failures.push({ fixture: fixture.name, why: `计数器 ${key} 应为 ${expected}，实际 ${counters[key]}` });
      }
    }
    const wantsZero = (fixture.expect ?? []).length === 0 && (fixture.forbid ?? []).length === 0;
    if (wantsZero) {
      checks += 1;
      if (findings.length > 0) {
        const detail = findings.map(f => `${f.code}/${f.severity}:${f.message}`).join(' ; ');
        failures.push({ fixture: fixture.name, why: `应 0 条 finding 却报了 ${findings.length} 条（误报）：${detail}` });
      }
    }
  }
  return { checks, failures };
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argOf(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}
const quiet = argv.includes('--quiet');
const topicDir = argOf('--topic') ?? '.';
const docsDirs = (argOf('--docs') ?? '').split(/[,;]/).map(v => v.trim()).filter(Boolean);
const expectEntries = Number(argOf('--expect-entries') ?? 1);
// --base：被采仓库的根。不传 → 源表位置／条目定位的文件校验全部跳过（完成判据 §3.8）
const baseDir = argOf('--base') ? resolve(argOf('--base')) : null;

const all = makeSink();
const totals = {
  entries: 0, refs: 0, dates: 0, enums: 0, skipped: 0, docFiles: 0, docHeadings: 0,
  tables: 0, locators: 0, 'locator-skipped': 0,
  'locator-checked': 0, 'locator-unchecked': 0,
  'table-checked': 0, 'table-unchecked': 0,
  'key-checked': 0, 'key-skipped': 0, 'key-not-literal': 0, 'file-unreadable': 0,
  'inv-rows': 0, 'inv-range': 0, 'inv-unit-groups': 0, 'inv-decl': 0,
  'inv-ladder-cells': 0, 'inv-ladder-skipped': 0, 'inv-scale': 0, 'inv-scale-skipped': 0,
  'inv-explicit-empty': 0, 'inv-placeholder-rows': 0,
  'ref-entities': 0, 'ref-relations': 0, 'ref-dangling': 0,
  'oral-checked': 0, 'oral-skipped': 0,
  'oral-not-literal': 0, 'oral-no-pin': 0, 'oral-too-short': 0,
};

// ── 0. 闭集漂移（COL-R28）────────────────────────────────────────────────────
const drift = checkEnumDrift();
if (drift && !drift.ok) {
  report(all, 'major', 'ENUM_DRIFT', 'check.mjs', 0,
    `闭集执行副本与 规则契约.md 不一致：${drift.why}`,
    '闭集的唯一定义处是 规则契约.md（COL-R28）');
}

// ── 0.5 `--implemented`：自报实现清单（v0.5 新增）────────────────────────────
// ⛔ 存在的理由：这份清单原来在 **4 个文件**里各手抄一份，**四份全漂了**。
//    → 别处（`规则契约.md`／`完成判据.md`／`SKILL.md`）**一律不许再手抄**，要列就跑这个。
if (argv.includes('--implemented')) {
  console.log(`implemented: ${IMPLEMENTS.length} 条`);
  console.log(IMPLEMENTS.join(' '));
  process.exit(0);
}

// ── 1. 自检先行（COL-S15）────────────────────────────────────────────────────
let selfFailed = false;
if (!argv.includes('--no-selftest')) {
  const { checks, failures } = selftest();
  if (failures.length > 0) {
    selfFailed = true;
    for (const failure of failures) {
      report(all, 'major', 'SELFTEST_FAIL', 'check.mjs', 0,
        `自检未过：${failure.fixture} —— ${failure.why}`, '检查器自己失效，本次结果一律作废');
    }
  } else if (!quiet) {
    console.log(`selftest: OK（${checks} 项断言，${FIXTURES.length} 个夹具）`);
  }
}

// ── 2. 账本 ──────────────────────────────────────────────────────────────────
// ⛔ v0.5：**账本可以是多份**。`素材账本字段.md` §3 写明「**装不下就拆专题，不要扩位数**」
//    （编号只许两位、每级 99 条）—— 那是**规范允许**的做法。
//    而 v0.5 之前这里只读 `01_素材账本.md`，于是**拆出来的份整片不被检查**
//    （实测一轮拆成三份：`01_` / `01b_` / `02_素材账本-Q5Q6.md`，`01b_` 的 25 条一条都没进过检查器）。
//    → 命名形态：`01[a-z]?_…素材账本….md` 与 `02[a-z]?_…素材账本….md`
//      （`02_` 在虚构类是「设定表」位，所以**必须同时含「素材账本」四个字**才认）。
const ledgerFiles = readdirSync(topicDir)
  .filter(n => /^0[12][a-z]?_.*素材账本.*\.md$/.test(n))
  .sort();
const ledgerPath = join(topicDir, '01_素材账本.md');
const registered = new Set();
// ⛔ v0.5：**「源表登记」跨三份账本共用** —— 三份文件是**一个逻辑账本**。
//    实测 `gmm` 登记在 `01_` 却用在 `02_`，逐文件独立解析会把它判成「未登记」（2 条**假 major**）。
//    → 先扫一遍所有账本的登记行，合成一张共用表，再传给每一份。
const sharedRegistry = new Map();
for (const ledgerName of ledgerFiles) {
  const lines = readFileSync(join(topicDir, ledgerName), 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const row = parseRegistryRow(line);
    if (row && !sharedRegistry.has(row.table)) sharedRegistry.set(row.table, { ...row, line: i + 1 });
  });
}
if (ledgerFiles.length === 0) {
  report(all, 'major', 'COL-S07', ledgerPath, 0, '找不到 01_素材账本.md', '专题目录里必须有账本');
}
for (const ledgerName of ledgerFiles) {
  const path = join(topicDir, ledgerName);
  const isMain = ledgerName === '01_素材账本.md';
  const ledgerLines = readFileSync(path, 'utf8').split(/\r?\n/);
  // `--expect-entries` 只对主账本生效（拆出来的份没有"期望值"这个概念）
  const { sink, counters } = scanLedger(ledgerLines, path, {
    expectEntries: isMain ? expectEntries : 0, base: baseDir,
    sharedRegistry, extraRoots: [topicDir],
  });
  all.findings.push(...sink.findings);
  for (const key of Object.keys(sink.sev)) all.sev[key] += sink.sev[key];
  mergeCounters(totals, counters, path, all);
  // ── 2b. 口述来源的条目（COL-S17）─────────────────────────────────────────────
  // 口述正文在 `_src/作者口述.md`；读不到只计数、不报 major（这一轮没口述是合法的）
  const oral = scanOralRefs(ledgerLines, path, { oralPath: join(topicDir, '_src', '作者口述.md') });
  all.findings.push(...oral.sink.findings);
  for (const key of Object.keys(oral.sink.sev)) all.sev[key] += oral.sink.sev[key];
  mergeCounters(totals, oral.counters, path, all);
  // ── 2c. 号位占用（`COL-S01` v0.5 再补）──────────────────────────────────────
  // ⛔ 拆册的触发判据**不是"活条目到 99 条"，是"号位用尽"** —— 因为**作废的号仍占位**
  //    （`COL-S01` 开头：编号不得回收）。
  //    实测：一轮作废 16 个号后剩 **92 条**活条目，而 **99 个号位已全部占满** —— 再加一条都加不进。
  //    ⭐ 号是**顺序发、不许回收**的，所以 **`max(号)` 就等于号位占用数**。
  const slotWarn = 95;   // 到这个号就该准备拆册（留 4 格余量）
  for (const lv of ['A', 'B', 'C']) {
    let maxN = 0;
    for (const line of ledgerLines) {
      const m = new RegExp(`^-\\s*\\*\\*${lv}-(\\d{2})\\*\\*`).exec(line);
      if (m) maxN = Math.max(maxN, Number(m[1]));
    }
    if (maxN >= slotWarn) {
      report(all, 'advisory', 'COL-S01', path, 1,
        `${lv} 级号位已用到 ${lv}-${String(maxN).padStart(2, '0')} —— 只剩 ${99 - maxN} 格，该准备拆册了`,
        '⛔ 触发判据是**号位用尽**，不是"活条目到 99 条"：作废的号仍占位（不得回收），' +
        '所以「活条目数 + 作废号数 = 99」时就已经加不进任何新条目了。拆成多册的语法见 `COL-S01`');
    }
  }

  // 源表名要带进文档侧，否则文档里的引用没有「已登记」这个概念可用
  for (const line of ledgerLines) {
    const row = /^\|\s*`?([A-Za-z_][\w-]*)`?\s*\|/.exec(line);
    if (row && !/^\|\s*源表名/.test(line) && !/^\|[\s:|-]+\|?\s*$/.test(line)) registered.add(row[1]);
  }
}

// ── 3. 文档（悬空引用 + 小节号）──────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (!/^\.|^node_modules$|^_work$/.test(name)) walk(full, out); }
    else if (extname(name).toLowerCase() === '.md') out.push(full);
  }
  return out;
}
for (const dir of docsDirs) {
  for (const file of walk(dir)) {
    const { sink, counters } = scanDocs(readFileSync(file, 'utf8').split(/\r?\n/), file, registered);
    all.findings.push(...sink.findings);
    for (const key of Object.keys(sink.sev)) all.sev[key] += sink.sev[key];
    totals.docFiles += counters.files;
    totals.docHeadings += counters.headings;
    totals.refs += counters.refs;
    totals.skipped += counters.skipped;
  }
}

// ── 3. 数值不变量（COL-S09）──────────────────────────────────────────────────
// 只有虚构类有 `02_设定表.md`（技术专题的 L3 是外部源文件，接口 §4.0）→ 没有就是**不适用**，
// 不是「解析到零」。这两种情况在退出码与消息上必须能分开（完成判据 §3.2）。
const settingPath = join(topicDir, '02_设定表.md');
let invApplicable = false;
if (existsSync(settingPath)) {
  const { sink, counters, applicable } = scanInvariants(
    readFileSync(settingPath, 'utf8').split(/\r?\n/), settingPath);
  invApplicable = applicable;
  all.findings.push(...sink.findings);
  for (const key of Object.keys(sink.sev)) all.sev[key] += sink.sev[key];
  mergeCounters(totals, counters, settingPath, all);

  // ── 3.5 设定表内部引用（COL-S02 的延伸）──────────────────────────────────
  const refs = scanSettingRefs(readFileSync(settingPath, 'utf8').split(/\r?\n/), settingPath);
  all.findings.push(...refs.sink.findings);
  for (const key of Object.keys(refs.sink.sev)) all.sev[key] += refs.sink.sev[key];
  mergeCounters(totals, refs.counters, settingPath, all);
}

// ── 4. COL-S11：不得新建进度／生命周期文件 ───────────────────────────────────
if (existsSync(topicDir)) {
  for (const name of readdirSync(topicDir)) {
    if (ALLOWED_TOP.has(name) || name.startsWith('_')) continue;
    report(all, 'advisory', 'COL-S11', join(topicDir, name), 1,
      `专题目录里多了非约定的文件：${name}`, '保留字：00_–09_ 前缀、_ 开头；新名字要先回改接口 §1');
  }
}

// ── 5. 输出（完成判据 §3.4 的消息格式）──────────────────────────────────────
const rank = { major: 0, advisory: 1, info: 2 };
// ⑥ `topic:` 段（v0.5）：源表数 ／ 定位项数 ／ **解析不了的定位项数**。
//    v0.4 的 `定位` 从来没被解析过，所以这一整格是空的 —— 而 COL-S08 明写「被跳过的引用必须
//    计数打印」、COL-R17 明写「任何该查而没查都要显式打出并计入已检查单元数」：
//    不打这个数，读的人会以为全查过了。
//    不传 --base 时 ③④⑤ 全部跳过，但**必须明示** `(no --base)`，不许静默（完成判据 §3.8）。
const tablesTotal = totals['table-checked'] + totals['table-unchecked'];
const keysTotal = totals['key-checked'] + totals['key-skipped'];
const skipNotes = [];
if (totals['key-not-literal'] > 0) skipNotes.push(`${totals['key-not-literal']} key-not-literal`);
if (totals['file-unreadable'] > 0) skipNotes.push(`${totals['file-unreadable']} file-unreadable`);
const baseSeg = baseDir
  ? `; base: ${totals['table-checked']}/${tablesTotal} tables checked, ` +
    `${totals['locator-checked']}/${totals.locators} locators checked, ` +
    `${totals['key-checked']}/${keysTotal} keys checked` +
    (skipNotes.length > 0 ? `, skipped: ${skipNotes.join(' / ')}` : '')
  : ' (no --base)';
console.log(`checked: ${totals.entries} entries, ${totals.refs} refs, ${totals.dates} dates, ` +
            `${totals.enums} enums, ${totals.skipped} skipped; docs: ${totals.docFiles} files, ` +
            `${totals.docHeadings} headings; topic: ${totals.tables} tables, ${totals.locators} locators, ` +
            `${totals['locator-skipped']} locator-skipped${baseSeg}`);
// ⑦ `invariants:` 段（v0.5）：第三查**自己查了几个单元**。
//    参考脚本在 778 行上报 `found 0`，却没打「区间匹配到几个」—— 一个都没匹配上的话，
//    那个 0 就是假绿灯。这里把四类分开计数，缺一类都看得见（COL-S07／COL-R17）。
const invSeg = invApplicable
  ? `; invariants: ${totals['inv-rows']} rows` +
    (totals['inv-explicit-empty'] > 0 ? ' (explicit 本子专题无)' : '') +
    (totals['inv-placeholder-rows'] > 0 ? ` (skipped ${totals['inv-placeholder-rows']} placeholder rows)` : '') +
    `, range ${totals['inv-range']}, ` +
    `units ${totals['inv-unit-groups']}, decl ${totals['inv-decl']}, ` +
    `ladder ${totals['inv-ladder-cells']}` +
    (totals['inv-ladder-skipped'] > 0 ? `(+${totals['inv-ladder-skipped']} non-numeric skipped)` : '') +
    `, scale ${totals['inv-scale']}` +
    (totals['inv-scale-skipped'] > 0 ? `(+${totals['inv-scale-skipped']} unresolved)` : '')
  : '; invariants: n/a (no 02_设定表.md)';
console.log(`found ${all.findings.length} (major=${all.sev.major} advisory=${all.sev.advisory} info=${all.sev.info})${invSeg}`);
for (const item of [...all.findings].sort((a, b) => rank[a.severity] - rank[b.severity])) {
  const where = item.line > 0 ? `${item.file}:${item.line}` : item.file;
  console.log(`  [${item.severity}] ${item.code} @ ${where}`);
  console.log(`      ${item.message}`);
  if (item.evidence) console.log(`      证据：${item.evidence}`);
}
if (all.findings.length === 0) console.log('  （无问题）');

// ⛔ 自检失败时，即使 major 计数为 0 也必须以 1 退出 —— 见文件头。
process.exit(all.sev.major > 0 || selfFailed ? 1 : 0);
