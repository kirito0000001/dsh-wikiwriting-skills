#!/usr/bin/env node
// `wiki-write` 成稿级检查器 —— 只实现「判据齐备、零语义」的那几条 `structural_invariant`。
//
// ── 为什么存在 ────────────────────────────────────────────────────────────────
// `09_诊断_wiki-write第一级规则可机检性.md` 的结论：87 条 `structural_invariant` 里
// **只有约 21 条（24%）现在就能写成不误报的检查器**，其余是五类缺口（B 语法缺失 /
// C 级别定错 / D 引用悬空 / E 判据在别的产物层）。本文件**只做 A 类**，且**只做其中零歧义的**。
//
// ── 三条纪律（照诊断 §7 与 `wiki-collect` §12.2）─────────────────────────────
// ① **`n/a` 必须和 `passed` 长得不一样** —— 不适用就计数打印，不许静默跳过。
//    （静默跳过 = `COL-S09` 那种"空查"假绿灯。）
// ② **退出码语义要分开** —— `0`=无 major；`1`=有 major（作者缺陷）；`2`=用法错；`3`=**工具故障**。
//    不许把"文件读不到"混进 `1` 里报成作者的缺陷。
// ③ **不许把 `craft_default` 叫「第三级」以外的名字** —— `验收.md` §0 的「第三类」是**判据性质**，
//    与四级的第三级 `craft_default` **撞名**。本文件一律用「级别」与「判据性质」两个词。
//
// ── 零依赖 ────────────────────────────────────────────────────────────────────
// 用法：
//   node tools/check.mjs --file <成稿.md> --genre <readme|wiki>   # 查一份成稿
//   node tools/check.mjs --topic <专题目录>                        # 查专题级（WVR-01）
//   node tools/check.mjs --selftest                                # 只跑自检
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// ── 规则实现 ─────────────────────────────────────────────────────────────────
// 每条返回 findings 数组：{ sev, id, line, why, ev }

/** `WRT-RM-S11`：有层级标题时，只用 `##` 与 `###`，不得出现 `####` 及更深。
 *  例外：无。 ⚠️ 代码块里的 `#` 不是标题 —— 必须整块跳过（这是实测误报的常见来源）。 */
export function rmS11(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return; }
    if (fenced) return;
    const m = /^(#{4,})\s+\S/.exec(l);
    if (m) out.push({ sev: 'major', id: 'WRT-RM-S11', line: i + 1,
      why: `标题层级到 ${m[1].length} 级 —— 规则只许 \`##\` 与 \`###\``,
      ev: l.trim().slice(0, 60) });
  });
  return out;
}

/** `WRT-RM-S12`：正文含图片时，每张图都必须有 alt 文本。例外：无。
 *  ⚠️ alt 为空才算违规；`![](x.png)` 是空 alt，`![图](x.png)` 不是。 */
export function rmS12(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return; }
    if (fenced) return;
    for (const m of l.matchAll(/!\[([^\]]*)\]\(/g)) {
      if (m[1].trim() === '') out.push({ sev: 'major', id: 'WRT-RM-S12', line: i + 1,
        why: '图片没有 alt 文本', ev: l.trim().slice(0, 60) });
    }
  });
  return out;
}

/** `WRT-RM-S13`：维护者段／致谢段的段名取自闭集。
 *  ⛔ **本条不是纯 A 类** —— 规则允许"非英文稿翻译段名"，而**翻译后的对应表没有给**（属 B 类语法缺口）。
 *  所以判据分三档，**判在"段名"这一层，不判在"文档"这一层**：
 *    · 段名**正好在闭集里** → 过
 *    · 段名**像该闭集的中文译法** → **advisory**（规则允许，但对应表没给，人工核）
 *    · 其余（含**中文稿里的英文自创段名**）→ **major** —— 「不得自创第五种叫法」
 *  ⛔ **第一版判错了**：用"全文有没有中文"当开关，于是中文稿里注入 `## Maintainer Info` 只报 advisory。
 *      **是注入测试抓出来的**（5/6 → 修完 6/6）。**判据的粒度错了，不是判据错了。** */
export function rmS13(text) {
  const out = [];
  const CLOSED = ['Maintainer', 'Maintainers', 'Thanks', 'Credits', 'Acknowledgements'];
  const ZH_OK = /^(维护者|维护人员|维护团队|致谢|鸣谢|感谢|贡献者|贡献|作者|制作人员)/;
  const looksLike = /^(maintainer|thanks|credits|acknowledg|维护|致谢|鸣谢|感谢|贡献|作者|制作)/i;
  const lines = text.split(/\r?\n/);
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return; }
    if (fenced) return;
    const m = /^##\s+(.+?)\s*$/.exec(l);
    if (!m) return;
    const name = m[1].trim();
    if (CLOSED.includes(name)) return;              // 闭集内
    if (!looksLike.test(name)) return;              // 不像维护者/致谢段 → 本条不管
    if (ZH_OK.test(name)) {
      out.push({ sev: 'advisory', id: 'WRT-RM-S13', line: i + 1,
        why: `段名「${name}」像是闭集的中文译法 —— 规则允许翻译，但**对应表没给**，请人工核`,
        ev: l.trim().slice(0, 60) });
    } else {
      out.push({ sev: 'major', id: 'WRT-RM-S13', line: i + 1,
        why: `段名「${name}」既不在闭集里（${CLOSED.join(' / ')}），也不像它的中文译法 —— 自创第五种叫法`,
        ev: l.trim().slice(0, 60) });
    }
  });
  return out;
}

/** `WWK-S02`：`type` 只许六值闭集。
 *  ⛔ **闭集不许硬编码在本文件里** —— 规则原文写着「闭集只写在本处，脚本不许硬编码（接 `COL-R28`）」。
 *  所以本函数**从规则正文里把闭集解析出来**；解析不到 → 报工具故障，不报作者缺陷。 */
export function readTypeClosedSet(ruleText) {
  const m = /只许六值闭集\s*`([^`]+)`/.exec(ruleText);
  if (!m) return null;
  return m[1].split(/[｜|]/).map(s => s.trim()).filter(Boolean);
}
export function wwkS02(text, closedSet) {
  const out = [];
  const m = /^-\s*type[：:]\s*(.+?)\s*$/m.exec(text);
  if (!m) return out;                      // 条件不成立（没有 type 字段）→ 由调用方记 n/a
  const v = m[1].trim();
  if (!closedSet.includes(v)) {
    const line = text.slice(0, m.index).split(/\r?\n/).length;
    out.push({ sev: 'major', id: 'WWK-S02', line,
      why: `\`type\` 的值「${v}」不在闭集里（只许 ${closedSet.join('｜')}）`, ev: m[0].trim() });
  }
  return out;
}

/** `WWK-S06`：每个条目末尾 `## 不是` 与 `## 未知` 两节必须存在。例外：无。 */
export function wwkS06(text) {
  const out = [];
  for (const sec of ['不是', '未知']) {
    if (!new RegExp(`^##\\s+${sec}\\s*$`, 'm').test(text)) {
      out.push({ sev: 'major', id: 'WWK-S06', line: 1,
        why: `缺 \`## ${sec}\` 节 —— 空也要写 \`—\``, ev: `（全文无 \`## ${sec}\`）` });
    }
  }
  return out;
}

/** `WWK-S08`：废案／已推翻的条目，`status` 要标，且该词要出现在**第一行标题**里。 */
export function wwkS08(text) {
  const out = [];
  const fm = FM.exec(text);
  const head = fm ? fm[1] : '';
  const body = fm ? text.slice(fm[0].length) : text;
  const st = /^status\s*:\s*(.+?)\s*$/m.exec(head);
  const isRetired = st && /废案|已推翻/.test(st[1]);
  const titleLine = (body.split(/\r?\n/).find(l => /^#\s+\S/.test(l)) || '');
  const titleMarked = /废案|已推翻/.test(titleLine);
  if (isRetired && !titleMarked) {
    out.push({ sev: 'major', id: 'WWK-S08', line: 1,
      why: `\`status\` 是「${st[1].trim()}」，但标题里没有这两个词 —— 零上下文验收方会把废案当真设定`,
      ev: titleLine.trim().slice(0, 60) || '（没有一级标题）' });
  }
  if (!isRetired && titleMarked) {
    out.push({ sev: 'advisory', id: 'WWK-S08', line: 1,
      why: '标题里有「废案／已推翻」，但 `status` 没标 —— 两处对不上', ev: titleLine.trim().slice(0, 60) });
  }
  return out;
}

// ── 技术文章（`WRT-TA-*`）────────────────────────────────────────────────────

/** `WRT-TA-S10`：二级标题不得取自空词闭集（`背景`/`架构`/`结果`/`结论` 及其逐字对应）。
 *  ⛔ **闭集不许硬编码**（`COL-R28`）—— 从规则正文解析。
 *  ⚠️ 规则明写：「**判断依据是标题本身是否为空词，不是"标题好不好"**」→ 只做**逐字相等**。 */
export function readEmptyHeadingSet(ruleText) {
  // ⚠️ 正文里是 `**不得取自空词闭集**（…）` —— `**` 夹在词与括号之间，
  //    第一版写成 `不得取自空词闭集（` 直接匹配不到（自检当场抓到，返回 null）。
  const m = /空词闭集\**（([^）]+)）/.exec(ruleText);
  if (!m) return null;
  return [...m[1].matchAll(/`([^`]+)`/g)].map(x => x[1]);
}
export function taS10(text, closedSet) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return; }
    if (fenced) return;
    const m = /^##\s+(.+?)\s*$/.exec(l);
    if (!m) return;
    const title = m[1].trim();
    // 「逐字对应」= 标题**整体**等于闭集里的词（前后允许有编号／标点）
    const bare = title.replace(/^[\d.、．)）\s]+/, '').replace(/[：:。．\s]+$/, '').trim();
    if (closedSet.includes(bare)) {
      out.push({ sev: 'major', id: 'WRT-TA-S10', line: i + 1,
        why: `二级标题「${title}」是空词 —— 它不提供任何信息，任何一篇文章都能用它`,
        ev: l.trim().slice(0, 60) });
    }
  });
  return out;
}

/** `WRT-TA-S01`（中文侧）：从 `词表-中文.md` **§2** 解析强红旗触发串，命中报 **advisory**。
 *  ⛔⛔ **只许读 §2** —— 该文件 §3／§4 明写「**永不机检**：任何脚本都不得读这一节」。
 *  解析不到 §2 或 §3 的边界 → 返回 `null`，调用方按**工具故障**处理，不许静默当"零命中"。
 *  ⚠️ 中文侧**先按 advisory 跑，不阻断** —— 中文表是我们自己汇编的，没有来源明文声明"自动红旗"。 */
export function readStrongRedFlags(wordlistText) {
  const start = wordlistText.indexOf('## 2. 强红旗');
  const end = wordlistText.indexOf('## 3. 弱信号');
  if (start < 0 || end < 0 || end <= start) return null;
  const seg = wordlistText.slice(start, end);
  const out = [];
  for (const line of seg.split(/\r?\n/)) {
    // 只要「第一列是词条、第二列以反引号开头」的表行 —— 表头与分隔行自动落选
    if (!/^\|\s*[^|\s][^|]*\|\s*`/.test(line)) continue;
    const cells = line.split('|').map(c => c.trim());
    const triggers = [...(cells[2] ?? '').matchAll(/`([^`]+)`/g)].map(x => x[1]);
    if (triggers.length) out.push({ name: cells[1], triggers, caveat: cells[8] ?? '' });
  }
  return out;
}
// 触发串 → 正则：`……` 是通配（表里 `在……的大好形势下` 这种）
function triggerToRegex(t) {
  const pat = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/…+/g, '[\\s\\S]{0,20}?');
  return new RegExp(pat, 'g');
}
export function taS01(text, flags) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return; }
    if (fenced) return;                                   // ⛔ 代码块豁免
    if (/^\s*>/.test(l)) return;                          // ⛔ 引用块整块豁免
    for (const f of flags) {
      for (const t of f.triggers) {
        const re = triggerToRegex(t);
        let m;
        while ((m = re.exec(l))) {
          // ⛔ 引文豁免：命中处若在引号内（`「」`／`“”`／`""`），不报
          const before = l.slice(0, m.index);
          const openQ = (before.match(/[「“"]/g) ?? []).length;
          const closeQ = (before.match(/[」”"]/g) ?? []).length;
          if (openQ > closeQ) continue;
          out.push({ sev: 'advisory', id: 'WRT-TA-S01', line: i + 1,
            why: `命中中文强红旗「${f.name}」：\`${t}\``,
            ev: `${l.trim().slice(0, 70)}${f.caveat ? `　｜反例（什么情况不该报）：${f.caveat.slice(0, 60)}` : ''}` });
          break;                                          // 一行一条，别刷屏
        }
      }
    }
  });
  return out;
}

/** `WRT-TA-S07`：文章结尾至少含一个具体可行动链接（文档／源码／试用入口／反馈渠道）。
 *  ⚠️ 「**具体可行动**」是语义 —— 机器只判「**有没有链接**」，所以只报 **advisory**。 */
export function taS07(text) {
  const lines = text.split(/\r?\n/);
  const isLink = l => /\[[^\]]+\]\([^)]+\)/.test(l) || /https?:\/\/\S+/.test(l);
  if (lines.some(isLink)) return [];
  return [{ sev: 'advisory', id: 'WRT-TA-S07', line: lines.length,
    why: '全文没找到任何链接 —— 规则要求结尾至少有一个具体可行动链接',
    ev: '「具体可行动」是语义判断，脚本只判"有没有链接"；有链接但不可行动时请人工核' }];
}

/** `WRT-TA-S11`：文体分型必须显式声明在 **`routing_summary` 的值里**（闭集 5 值）。
 *  ⭐ **v0.5 裁决后的形态** —— 本条原来写「文首元数据显式声明」，**与 `SKILL.md` §8.2 的
 *     「frontmatter 恰好 5 键」字面对撞**（曾是 `00` §7.4 第 9 条待裁决项）。
 *     实测一轮的作者**自己解了**：把分型写进 `routing_summary` 的**值**里 ——
 *     **不加第 6 个键，也没漏声明**。⛔ 因此本函数**只看那一个键的值**，不数键数。 */
export function readGenreSet(ruleText) {
  // ⛔⛔ **必须先锚到 `WRT-TA-S11` 那一行，不能只找「闭集：」**（自检当场抓到的错）：
  //    同一文件里 **`WRT-TA-S08` 也有一个「闭集：」**（`试用号召 + 套餐说明式收尾`，**且没有反引号**）。
  //    第一版 `/闭集：([^\n]+?)）/` 匹配到了 S08 那个 → 解析出**空数组** → 自检报"闭集解析失败"。
  //    ⭐ **同一份文档里"同一个词出现两次、含义不同"** —— 锚点必须唯一。
  const row = ruleText.split(/\r?\n/).find(l => /^\|\s*`WRT-TA-S11`/.test(l));
  if (!row) return null;
  const m = /闭集：([^）]+)）/.exec(row);
  if (!m) return null;
  return [...m[1].matchAll(/`([^`]+)`/g)].map(x => x[1]);
}
export function taS11(text, genreSet) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) return [];                                   // 没有 frontmatter 是 `publish.mjs` 的错，不在这条报
  const line = /^routing_summary\s*[:：]\s*(.+)$/m.exec(fm[1]);
  if (!line) {
    return [{ sev: 'major', id: 'WRT-TA-S11', line: 1,
      why: 'frontmatter 里没有 `routing_summary`，文体分型无处声明',
      ev: '`S03`／`S06`／`R17` 都以分型为条件 —— 不声明则那三条无法自动判定' }];
  }
  const val = line[1].trim();
  const hit = genreSet.filter(g => val.includes(g));
  if (hit.length === 0) {
    return [{ sev: 'major', id: 'WRT-TA-S11', line: 1,
      why: `\`routing_summary\` 的值里没有文体分型（闭集：${genreSet.join(' / ')}）`,
      ev: `现值：${val.slice(0, 70)}　→　把分型写进**值**里，⛔ 不要加第 6 个键` }];
  }
  return [];
}

// ── 专题级（`05_复述测试.md` / `07_交付说明.md`）──────────────────────────────
// ⭐ 这一批查的是**本技能自己的产物** —— 它们规定"必须产出"，却从来没有执行者。

/** `WVR-01`：`05_复述测试.md` 里三级时间盒与实测耗时**四个字段齐全**。
 *  ⚠️ **v0.5 定的读法（用户确认）**：「齐全」= **字段在、且不空**；机器实例下值写 `N/A` **即算齐全**。
 *  ⛔ **两句要分开，别搅在一起**（我第一版就写反了）：
 *    · **AI 测时的「时间盒」这一项 → 废弃**（记 `N/A`）—— 这就是 `WVR-18`，本来如此。
 *    · **「AI 测试」这条路本身 → 不废弃** —— 它**干扰项最少**，是**唯一可行**的复述测试路径。
 *    · **人测 → 不是"备选"，是做不到**（数据无法测量）。
 *  → 所以「必须有真实耗时数字」**不是"更严格"，是要求一条走不通的路**：机器实例没有"读一份文档花了多久"
 *    这回事（§2.1 原话：机器实例的耗时反映的是**工具速度**，**等于用秒表量体温**）。 */
export function wvr01(text) {
  const out = [];
  const missing = [];
  for (const lv of ['L1', 'L2', 'L3']) {
    // 每级都要有一处「时间盒」标注（形态自由：小节标题、表格列、行内都认）
    if (!new RegExp(`${lv}[^\\n]{0,40}时间盒|时间盒[^\\n]{0,40}${lv}`, 'i').test(text)) {
      missing.push(`${lv} 时间盒`);
    }
  }
  if (missing.length) {
    out.push({ sev: 'major', id: 'WVR-01', line: 1,
      why: `复述测试记录缺这些字段：${missing.join('／')}`,
      ev: '三级时间盒缺一即未通过；机器实例下值写 `N/A` 即可（WVR-18），但**字段必须在**' });
  }
  // 实测耗时：⛔ **三种合法词面形态都要认** —— 第一版只认前两种，
  // 于是 6/6 个真实专题全部误报。而 `验收.md` §8 的**记录模板**用的正是第三种：
  //   §2 原话：`实测耗时` ／ `首次看懂用了 __ 秒` ／ `首次跑通用 __ 分钟（或"没做到"）`
  //   §8 模板：`时间盒 30s，读者自报 __ 秒 ｜ 主试墙钟 __ 分`
  // ⭐ **模板才是作者会照抄的那个** —— 判据必须认它，否则规则与模板对不上。
  const m = /(实测耗时|首次看懂用了|首次跑通用|读者自报|主试墙钟)\s*[:：]?\s*([^\s\n|｜]{1,24})?/.exec(text);
  if (!m) {
    out.push({ sev: 'major', id: 'WVR-01', line: 1,
      why: '复述测试记录缺「实测耗时」字段',
      ev: '三种合法词面：`实测耗时` ／ `首次看懂用了 __ 秒`·`首次跑通用 __ 分钟（或"没做到"）` ／ **模板形态** `读者自报 __ 秒 ｜ 主试墙钟 __ 分`；机器实例写 `N/A`' });
  } else if (!m[2] || /^[_＿—\-]+$/.test(m[2])) {
    out.push({ sev: 'major', id: 'WVR-01', line: 1,
      why: '「实测耗时」字段还在占位符状态（有字段名、没值）',
      ev: `${m[0].trim().slice(0, 50)}　→　机器实例写 \`N/A\`，人写秒数或「没做到」，⛔ 不能空着` });
  }
  return out;
}

/** `WVR-02`：每条判据必须带定位与读者**原话**；只写"读者表示理解"这类转述即未通过。
 *  ⛔⛔ **定位那一列只判"有没有内容"，不判形态**（v0.5 修正 —— 实测误报 **37 条 / 5 个专题**）：
 *     第一版只认 `§` / `` `文件:行` `` / `第 N 行` —— 而规则的原文是「`文件:**小节**` 定位」，
 *     真实形态远多于那三种：`` `06_发布版.md` 标题 ``、`` `:取舍：我们没选什么` ``、`首段`、
 *     `八个二级小节，逐个点`、`front matter；\`NapCat Shell v4.18.28\`` ……
 *     **5/5 个专题全中，连"唯一干净的端到端"都过不了** —— 这是判据过窄的典型信号（`§8.3`：误报比漏报更伤）。
 *     → 改成：**定位列非空、且不是 `—` 之类的占位**即可；形态由 reviewer 判。 */
export function wvr02(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (!/^\|/.test(l)) return;
    const raw = l.split('|').map(c => c.trim());
    const cells = raw.filter(Boolean);
    if (cells.length < 3) return;
    if (!cells.some(c => /^(PASS|FAIL|PARTIAL)$/i.test(c))) return;
    const hasQuote = /[「『“"][^」』”"]{4,}[」』”"]/.test(l);
    // 定位 = 表格的**最后一列**（去掉首尾空段后的最后一格）
    const locCell = (raw.length && raw[raw.length - 1] === '') ? raw[raw.length - 2] : raw[raw.length - 1];
    const hasLoc = !!locCell && !/^[—\-–－\s]+$/.test(locCell) && locCell.length >= 2;
    if (!hasQuote || !hasLoc) {
      out.push({ sev: 'major', id: 'WVR-02', line: i + 1,
        why: `${!hasQuote ? '缺读者原话' : '缺定位'} —— 只写"读者表示理解"这类转述即视为未通过`,
        ev: l.trim().slice(0, 70) });
    }
  });
  return out;
}

/** `WVR-06`：第三类项必须落在「仅记录，不构成验收」一节；出现在 PASS/FAIL 表里即未通过。 */
export function wvr06(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let inRecordOnly = false;
  lines.forEach((l, i) => {
    if (/^#{1,6}\s/.test(l)) inRecordOnly = /仅记录|不构成验收/.test(l);
    if (inRecordOnly) return;
    // 「第三类」出现在记录区之外 —— 尤其别出现在 PASS/FAIL 行里
    if (/第三类/.test(l) && /^\|/.test(l) && /(PASS|FAIL|PARTIAL)/i.test(l)) {
      out.push({ sev: 'major', id: 'WVR-06', line: i + 1,
        why: '「第三类」项出现在 PASS/FAIL 表里 —— 它只能落在「仅记录，不构成验收」一节',
        ev: l.trim().slice(0, 70) });
    }
  });
  return out;
}

/** `WVR-20`：`07_交付说明.md` 必须有「落地」一节，且**三样**都在。
 *  ⚠️ 例外：目标位置不存在（那时不要求三样）—— 记录里明写「目标位置不存在」即放过。 */
export function wvr20(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i]) && /落地/.test(lines[i])) { start = i; break; }
  }
  if (start < 0) {
    out.push({ sev: 'major', id: 'WVR-20', line: 1,
      why: '`07_交付说明.md` 里没有「落地」一节',
      ev: '成稿要落进既有位置时，必须写明 ① 目标文件路径 ② 目标位置的既有约定 ③ 本稿与既有页的关系' });
    return out;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start, end).join('\n');
  if (/目标位置不存在|没有既有位置|不落进/.test(body)) return out;   // 例外
  const items = [
    ['① 目标文件路径', /路径|文件[名夹]|\.md|\.html|slug|URL/i],
    ['② 目标位置的既有约定', /frontmatter|front matter|status|键集|闭集|既有约定/i],
    ['③ 本稿与既有页的关系', /新增|替换|并存|覆盖|新建/i],
  ];
  const lack = items.filter(([, re]) => !re.test(body)).map(([n]) => n);
  if (lack.length) {
    out.push({ sev: 'major', id: 'WVR-20', line: start + 1,
      why: `「落地」一节缺 ${lack.join('／')}`,
      ev: '三样必须齐全，且取自**实际读过的目标文件**，不是从文体骨架推断的' });
  }
  return out;
}

/** `WRC-16`：交叉引用只指章节号或 ID，**不指措辞**；跨文件引用必须写出文件名。
 *  ⚠️ 只抓**明确指向措辞**的形态（`见下"某某"`／`参见上文那段`），不抓普通的「见下文」——
 *     中文里"见下文"常常本身就指章节，一律抓会大面积误报。 */
export function wrc16(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return; }
    if (fenced) return;
    const m = /(见|参见|详见)\s*(下面|上面|下文|上文|前面|后面)?\s*[「『“"][^」』”"]{2,}[」』”"]/.exec(l);
    if (m) {
      out.push({ sev: 'major', id: 'WRC-16', line: i + 1,
        why: `交叉引用指向了**措辞**（${m[0].slice(0, 20)}…）—— 措辞会改，章节号与 ID 不会`,
        ev: `改成 \`见 <文件名> §N\` 或 \`见 <ID>\`；原文：${l.trim().slice(0, 55)}` });
    }
  });
  return out;
}

/** `WVR-19`（**跨文件**）：复述测试里标了「**材料缺**」的 P0 ⇒ `07_交付说明.md` 必须留白。
 *  ⛔ 实测撞出来的：一轮技术文档的两条 P0 里，**有一条根因在材料**（材料里根本没有那个信息），
 *     **改稿解决不了** —— 编一段就是凭印象补事实。而 `WVR-19` 当时只写「P0 必须修完」，
 *     **没给这种情形出口**；作者按「超过必须上报」处理是对的，但规则没答"该判 PASS 还是 PARTIAL"。
 *  ⭐ 判据：**「材料缺」这个标记出现在复述测试里 ⇒ 交付说明必须有对应的留白**。 */
export function wvr19Topic(recText, deliverText) {
  const out = [];
  const marked = [...recText.matchAll(/材料缺/g)].length;
  if (marked === 0) return out;                       // 没标 → 本条不适用（n/a，由调用方打印）
  if (deliverText == null) {
    return [{ sev: 'major', id: 'WVR-19', line: 1,
      why: `复述测试里标了 ${marked} 处「材料缺」，但没有 \`07_交付说明.md\` —— 材料缺口必须显式留白`,
      ev: '「材料缺 P0」不阻断交付，但**必须在交付说明里留白**' }];
  }
  if (!/已知局限|留白|材料里没有|材料里没有答案|材料缺/.test(deliverText)) {
    out.push({ sev: 'major', id: 'WVR-19', line: 1,
      why: `复述测试里标了 ${marked} 处「材料缺」，而 \`07_交付说明.md\` 里没有对应的「已知局限／留白」`,
      ev: '⛔ 不许把「材料缺 P0」改写成「已修」—— 那等于把"我们不知道"伪装成"我们查过了"' });
  }
  return out;
}

// ── 自检（`COL-S15`：夹具先行，自检不过则结果一律作废）──────────────────────
// ⚠️ 负样本**照真实语料造**，不编。每条都注明它来自哪一次实测。
const FIXTURES = [
  // WRT-RM-S11
  { rule: 'WRT-RM-S11', name: '正1 四级标题', text: '## a\n\n#### b\n', want: ['major'] },
  { rule: 'WRT-RM-S11', name: '负1 三级标题合法', text: '## a\n\n### b\n', want: [] },
  // ⛔ 负2 来自实测：代码块里的 `#` 不是标题（`wiki-collect` 的 `sanity()` 栽过同类）
  { rule: 'WRT-RM-S11', name: '负2 ⛔ 围栏代码块里的 `####`（实测同类误报）',
    text: '## a\n\n```\n#### 这不是标题\n```\n', want: [] },
  { rule: 'WRT-RM-S11', name: '负3 行内反引号里的 `####`',
    text: '## a\n\n见 `#### 四级` 那个写法。\n', want: [] },

  // WRT-RM-S12
  { rule: 'WRT-RM-S12', name: '正1 空 alt', text: '## a\n\n![](x.png)\n', want: ['major'] },
  { rule: 'WRT-RM-S12', name: '正2 只有空格也算空 alt', text: '![   ](x.png)\n', want: ['major'] },
  { rule: 'WRT-RM-S12', name: '负1 有 alt', text: '![截图](x.png)\n', want: [] },
  { rule: 'WRT-RM-S12', name: '负2 普通链接不是图片', text: '[接口](https://e.com/a)\n', want: [] },

  // WRT-RM-S13
  { rule: 'WRT-RM-S13', name: '正1 英文稿自创段名', text: '# T\n\n## The Team\n', want: [] }, // 不像维护者段 → 不管
  { rule: 'WRT-RM-S13', name: '正2 英文稿 Maintainer 合法', text: '# T\n\n## Maintainers\n', want: [] },
  { rule: 'WRT-RM-S13', name: '正3 英文稿自创 "Maintainer Info"',
    text: '# T\n\n## Maintainer Info\n', want: ['major'] },
  // ⛔ 正4 是**注入测试抓出来的真 bug 的回归夹具**：中文稿里的**英文自创段名**，
  //    第一版用"全文有没有中文"当开关，只报了 advisory（5/6 → 修完 6/6）。
  { rule: 'WRT-RM-S13', name: '正4 ⛔ 中文稿里注入英文自创段名（注入测试抓到的 bug）',
    text: '# 标题\n\n正文。\n\n## Maintainer Info\n\n注入。\n', want: ['major'] },
  // ⛔ 负1 来自实测：中文稿的「维护者」是规则**明确允许的翻译**，不许报 major
  { rule: 'WRT-RM-S13', name: '负1 ⛔ 中文稿「维护者」（规则允许翻译，只许 advisory）',
    text: '# 标题\n\n## 维护者\n', want: ['advisory'] },

  // WWK-S02
  { rule: 'WWK-S02', name: '正1 越界值', text: '- type：monster\n', want: ['major'], set: ['character', 'location', 'faction', 'timeline', 'term', 'value'] },
  { rule: 'WWK-S02', name: '负1 闭集内', text: '- type：character\n', want: [], set: ['character', 'location', 'faction', 'timeline', 'term', 'value'] },
  { rule: 'WWK-S02', name: '负2 ⛔ 没有 type 字段（条件不成立，不许报）', text: '正文\n', want: [], set: ['character'] },

  // WWK-S06
  { rule: 'WWK-S06', name: '正1 两节都缺', text: '# T\n\n正文\n', want: ['major', 'major'] },
  { rule: 'WWK-S06', name: '负1 两节都在', text: '# T\n\n## 未知\n\n—\n\n## 不是\n\n—\n', want: [] },
  // ⛔ 负2 来自实测：`## 未知` 出现在**行内代码**里时不算节（`wiki-collect` 的 `sanity()` 栽过）
  { rule: 'WWK-S06', name: '负2 ⛔ 行内代码里的 `## 未知`（实测同类误报）',
    text: '# T\n\n## 未知\n\n—\n\n## 不是\n\n见 `## 未知` 一节。\n', want: [] },

  // WWK-S08
  { rule: 'WWK-S08', name: '正1 废案没进标题',
    text: '---\nstatus: 废案\n---\n\n# 老王\n', want: ['major'] },
  { rule: 'WWK-S08', name: '负1 废案进了标题',
    text: '---\nstatus: 废案\n---\n\n# 老王（废案）\n', want: [] },
  { rule: 'WWK-S08', name: '负2 active 且标题没标（正常）',
    text: '---\nstatus: active\n---\n\n# 老王\n', want: [] },

  // ── 技术文章（v0.5 新增）────────────────────────────────────────────────────
  { rule: 'WRT-TA-S10', name: '正1 二级标题就是空词', text: '## 背景\n', want: ['major'], set: ['背景', '架构', '结果', '结论'] },
  { rule: 'WRT-TA-S10', name: '正2 带编号的空词标题', text: '## 3. 结论\n', want: ['major'], set: ['背景', '架构', '结果', '结论'] },
  { rule: 'WRT-TA-S10', name: '负1 具体标题（防误报）', text: '## 它怎么把素材同步进工程\n', want: [], set: ['背景', '架构', '结果', '结论'] },
  { rule: 'WRT-TA-S10', name: '负2 ⛔ 三级标题不管（本条条件就是二级）', text: '### 背景\n', want: [], set: ['背景', '架构', '结果', '结论'] },
  { rule: 'WRT-TA-S10', name: '负3 ⛔ 围栏代码块里的 `## 背景`', text: '```\n## 背景\n```\n', want: [], set: ['背景', '架构', '结果', '结论'] },
  { rule: 'WRT-TA-S10', name: '负4 ⛔ 标题里含「背景」但不等于它', text: '## 这个项目的背景与目标\n', want: [], set: ['背景', '架构', '结果', '结论'] },

  { rule: 'WRT-TA-S01', name: '正3 命中宣布式开场', text: '在当今快速发展的时代，我们做了这个工具。\n',
    want: ['advisory'], flags: [{ name: '宣布式开场', triggers: ['在当今快速发展的'], caveat: '' }] },
  { rule: 'WRT-TA-S01', name: '正4 通配触发串（`……`）', text: '在改革的大好形势下，我们开工了。\n',
    want: ['advisory'], flags: [{ name: '形势铺垫', triggers: ['在……的大好形势下'], caveat: '' }] },
  { rule: 'WRT-TA-S01', name: '负5 ⛔ 引号内豁免（引文）', text: '他说「在当今快速发展的时代」，这话很空。\n',
    want: [], flags: [{ name: '宣布式开场', triggers: ['在当今快速发展的'], caveat: '' }] },
  { rule: 'WRT-TA-S01', name: '负6 ⛔ 引用块整块豁免', text: '> 在当今快速发展的时代\n',
    want: [], flags: [{ name: '宣布式开场', triggers: ['在当今快速发展的'], caveat: '' }] },
  { rule: 'WRT-TA-S01', name: '负7 ⛔ 围栏代码块豁免', text: '```\n在当今快速发展的\n```\n',
    want: [], flags: [{ name: '宣布式开场', triggers: ['在当今快速发展的'], caveat: '' }] },

  { rule: 'WRT-TA-S07', name: '正5 全文无链接', text: '# T\n\n正文，没有链接。\n', want: ['advisory'] },
  { rule: 'WRT-TA-S07', name: '负8 有 Markdown 链接', text: '见 [文档](https://e.com/a)。\n', want: [] },
  { rule: 'WRT-TA-S07', name: '负9 有裸 URL', text: '见 https://e.com/a 这一页。\n', want: [] },
  // ── WRT-TA-S11（v0.5 裁决后的形态：分型写进 `routing_summary` 的**值**里）──────
  { rule: 'WRT-TA-S11', name: '负10 ⭐ 分型写在值里（实战作者的解法，必须算合规）',
    text: '---\nschema_version: 3\nstatus: draft\nrouting_summary: 讲图集工具怎么用（工程深潜，非 SEO 型）—— 给要出图集的 TA\nlast_reviewed: 2026-10-07\nreview_cycle: 30d\n---\n\n# 标题\n',
    want: [], set: ['深潜', '发布', '复盘', '数据', '教程'] },
  { rule: 'WRT-TA-S11', name: '正6 值里没有分型词',
    text: '---\nrouting_summary: 讲图集工具怎么用\n---\n\n# 标题\n',
    want: ['major'], set: ['深潜', '发布', '复盘', '数据', '教程'] },
  { rule: 'WRT-TA-S11', name: '正7 连 routing_summary 都没有',
    text: '---\nstatus: draft\n---\n\n# 标题\n',
    want: ['major'], set: ['深潜', '发布', '复盘', '数据', '教程'] },

  // ── 专题级（v0.5 新增 —— 查本技能自己的产物）────────────────────────────────
  { rule: 'WVR-01', name: '正1 缺 L3 时间盒',
    text: '# 记录\n\n## L1 第一眼（时间盒 N/A）\n\n## L2 看懂（时间盒 N/A）\n\n实测耗时：N/A\n', want: ['major'] },
  { rule: 'WVR-01', name: '正2 实测耗时还在占位符状态',
    text: '## L1 第一眼（时间盒 N/A）\n## L2 看懂（时间盒 N/A）\n## L3 能动手（时间盒 N/A）\n实测耗时：__\n', want: ['major'] },
  { rule: 'WVR-01', name: '正3 完全没有实测耗时字段',
    text: '## L1 第一眼（时间盒 N/A）\n## L2 看懂（时间盒 N/A）\n## L3 能动手（时间盒 N/A）\n', want: ['major'] },
  // ⛔ 负4 是**逐字照抄 `验收.md` §8 的记录模板**（机器实例填 `N/A`）——
  //    第一版判据不认模板那套词（`读者自报`／`主试墙钟`），于是 **6/6 个真实专题全部误报**。
  //    ⭐ **模板才是作者会照抄的那个** —— 这条夹具把「规则 ↔ 模板 ↔ 检查器」钉在一起。
  { rule: 'WVR-01', name: '负4 ⭐ 逐字照抄 §8 模板（机器实例填 N/A）—— 规则与模板必须对得上',
    text: '# 复述测试 · 甲 · 第 1 轮\n\n## L1 第一眼（时间盒 N/A，读者自报 N/A ｜ 主试墙钟 N/A）\n\n'
        + '## L2 看懂（时间盒 N/A，读者自报 N/A ｜ 主试墙钟 N/A）\n\n'
        + '## L3 能动手（时间盒 N/A，读者自报 N/A ｜ 主试墙钟 N/A）\n', want: [] },
  // ⭐ 负1 是**实测形态**：机器实例四格全 N/A —— 按 v0.5 的读法**必须算齐全**
  { rule: 'WVR-01', name: '负1 ⭐ 机器实例四格全 N/A（实测形态，必须算齐全）',
    text: '> 时间盒口径：机器实例记 N/A\n\n## L1 第一眼（时间盒 N/A）\n## L2 看懂（时间盒 N/A）\n## L3 能动手（时间盒 N/A）\n实测耗时：N/A\n', want: [] },
  { rule: 'WVR-01', name: '负2 人测的真实数字',
    text: '## L1 第一眼（时间盒 30 秒）\n## L2 看懂（时间盒 2 分钟）\n## L3 能动手（时间盒 5 分钟）\n首次跑通用 8 分钟\n', want: [] },
  { rule: 'WVR-01', name: '负3 「没做到」也是合法值',
    text: '## L1 第一眼（时间盒 30 秒）\n## L2 看懂（时间盒 2 分钟）\n## L3 能动手（时间盒 5 分钟）\n首次跑通用 没做到\n', want: [] },

  { rule: 'WVR-02', name: '正4 判据只写转述、没原话',
    text: '| 是什么 | PASS | 读者表示理解了 | §开头 |\n', want: ['major'] },
  { rule: 'WVR-02', name: '正5 判据有原话没定位',
    text: '| 是什么 | PASS | 「一个卡牌工程」 | — |\n', want: ['major'] },
  { rule: 'WVR-02', name: '负4 原话 + 小节定位（实测形态）',
    text: '| 是什么 | PASS | 「一个卡牌工程，给接手的人用」 | §开头两段 |\n', want: [] },
  { rule: 'WVR-02', name: '负5 ⛔ 表头与分隔行不查',
    text: '| 检查项 | 判 | 读者原话 | 定位 |\n| --- | --- | --- | --- |\n', want: [] },

  { rule: 'WVR-06', name: '正6 第三类混进 PASS 表里',
    text: '| 第三类：读者没提 | PASS |\n', want: ['major'] },
  { rule: 'WVR-06', name: '负6 第三类在「仅记录」节里',
    text: '## 仅记录，不构成验收\n\n| 第三类：读者没提 | — |\n', want: [] },

  { rule: 'WVR-20', name: '正7 没有「落地」一节', text: '# 交付说明\n\n正文\n', want: ['major'] },
  // ⛔ 正8 是**注入测试暴露的缺口**：原来只有「整节都没有」的夹具，
  //    没有「节在、但三样不齐」的 —— 而后者才是真实语料里更可能出现的形态。
  { rule: 'WVR-20', name: '正8 ⛔ 有「落地」一节但三样不齐（注入测试暴露的缺口）',
    text: '# 交付说明\n\n## 落地\n\n就是把稿子放进仓库。\n', want: ['major'] },
  { rule: 'WVR-20', name: '正9 三样缺一（只有路径与关系，没有既有约定）',
    text: '# 交付说明\n\n## 落地\n\n目标文件 `README.md`；本稿**替换**原有内容。\n', want: ['major'] },
  { rule: 'WVR-20', name: '负7 三样齐全',
    text: '# 交付说明\n\n## 落地\n\n目标文件 `README.md`；目标位置只用 `title`/`status` 两个 frontmatter 键；本稿**替换**原有内容。\n', want: [] },
  { rule: 'WVR-20', name: '负8 ⛔ 目标位置不存在（规则明写的例外）',
    text: '# 交付说明\n\n## 落地\n\n目标位置不存在。\n', want: [] },

  { rule: 'WRC-16', name: '正8 引用指向措辞',
    text: '详见下面「它是怎么工作的」那一节。\n', want: ['major'] },
  { rule: 'WRC-16', name: '负9 指向章节号',
    text: '见 `06_发布版.md` §3。\n', want: [] },
  { rule: 'WRC-16', name: '负10 ⛔ 普通的「见下文」不报（防误报）',
    text: '见下文说明。\n', want: [] },

  // ── WVR-19（跨文件：复述测试 ↔ 交付说明）──────────────────────────────────
  { rule: 'WVR-19', name: '正9 ⛔ 标了「材料缺」但交付说明没留白（实测形态）',
    text: '## 处置\n\n- [x] P0-1 工具箱怎么装（材料缺）\n',
    set: ['# 交付说明\n\n## 落地\n\n目标文件 `README.md`。\n'], want: ['major'] },
  { rule: 'WVR-19', name: '正10 标了「材料缺」而根本没有交付说明',
    text: '## 处置\n\n- [x] P0-2 grid 的虚幻侧步骤（材料缺）\n',
    set: [null], want: ['major'] },
  { rule: 'WVR-19', name: '负11 ⭐ 标了「材料缺」且交付说明有留白（实测形态，必须算合规）',
    text: '## 处置\n\n- [x] P0-1 工具箱怎么装（材料缺）\n',
    set: ['# 交付说明\n\n## 已知局限\n\n工具箱的安装方式**材料里没有**，本稿照实留白。\n'], want: [] },
  { rule: 'WVR-19', name: '负12 ⛔ 没标「材料缺」时本条不适用（防误报）',
    text: '## 处置\n\n- [x] P0-1 补一段前提\n',
    set: ['# 交付说明\n\n正文\n'], want: [] },
];

export function selftest() {
  const failures = [];
  let checks = 0;
  for (const f of FIXTURES) {
    checks += 1;
    let got;
    try {
      got = runRule(f.rule, f.text, f.set, f.flags).map(x => x.sev);
    } catch (e) { failures.push(`${f.name}：抛异常 ${e.message}`); continue; }
    const want = f.want;
    const same = got.length === want.length && want.every(s => got.includes(s));
    if (!same) failures.push(`${f.name}：期望 ${JSON.stringify(want)}，实得 ${JSON.stringify(got)}`);
  }
  // ⛔ 闭集必须从规则正文读得到 —— 读不到就是工具故障，不是作者缺陷
  checks += 1;
  const rulePath = join(ROOT, 'references', '文体-设定集.md');
  if (!existsSync(rulePath)) failures.push('读不到 `references/文体-设定集.md` —— 闭集解析不出来');
  else {
    const cs = readTypeClosedSet(readFileSync(rulePath, 'utf8'));
    if (!cs || cs.length !== 6) failures.push(`\`WWK-S02\` 的闭集解析失败，实得 ${JSON.stringify(cs)}`);
  }
  // ⛔ 技术文章的空词闭集（`WRT-TA-S10`）
  checks += 1;
  const taPath = join(ROOT, 'references', '文体-技术文章.md');
  if (!existsSync(taPath)) failures.push('读不到 `references/文体-技术文章.md` —— 空词闭集解析不出来');
  else {
    const cs = readEmptyHeadingSet(readFileSync(taPath, 'utf8'));
    if (!cs || cs.length !== 4) failures.push(`\`WRT-TA-S10\` 的空词闭集解析失败，实得 ${JSON.stringify(cs)}`);
  }
  // ⛔ 技术文章的**文体分型闭集**（`WRT-TA-S11`，v0.5 裁决后的形态）
  checks += 1;
  {
    const gs = readGenreSet(readFileSync(taPath, 'utf8'));
    if (!gs || gs.length !== 5) failures.push(`\`WRT-TA-S11\` 的分型闭集解析失败，实得 ${JSON.stringify(gs)}`);
  }
  // ⛔⛔ 词表：**只许读 §2** —— §3／§4 明写「永不机检，任何脚本都不得读这一节」。
  //     这条断言就是在钉住"解析器没有越界读"：§2 里有「在当今快速发展的」，
  //     而 §3 里有一批**只该给人看**的行；如果解析越界，条数会明显偏多。
  checks += 1;
  const wlPath = join(ROOT, 'references', '词表-中文.md');
  if (!existsSync(wlPath)) failures.push('读不到 `references/词表-中文.md` —— 强红旗解析不出来');
  else {
    const wl = readFileSync(wlPath, 'utf8');
    const flags = readStrongRedFlags(wl);
    if (!flags) failures.push('`词表-中文.md` 的 §2／§3 边界定位失败（返回 null，按工具故障处理）');
    else if (flags.length < 25 || flags.length > 45) {
      failures.push(`强红旗条数异常：实得 ${flags.length} 条 —— ` +
        `偏少说明 §2 没读全，**偏多说明解析越界读到了 §3（那是明令永不机检的一节）**`);
    }
  }
  return { checks, failures };
}

function runRule(rule, text, set, flags) {
  switch (rule) {
    case 'WRT-RM-S11': return rmS11(text);
    case 'WRT-RM-S12': return rmS12(text);
    case 'WRT-RM-S13': return rmS13(text);
    case 'WWK-S02': return wwkS02(text, set || []);
    case 'WWK-S06': return wwkS06(text);
    case 'WWK-S08': return wwkS08(text);
    case 'WRT-TA-S10': return taS10(text, set || []);
    case 'WRT-TA-S01': return taS01(text, flags || []);
    case 'WRT-TA-S07': return taS07(text);
    case 'WRT-TA-S11': return taS11(text, set || []);
    case 'WVR-01': return wvr01(text);
    case 'WVR-02': return wvr02(text);
    case 'WVR-06': return wvr06(text);
    case 'WVR-20': return wvr20(text);
    case 'WRC-16': return wrc16(text);
    // `WVR-19` 是**跨文件**的：`text` = 复述测试，`set[0]` = 交付说明（不给 = null）
    case 'WVR-19': return wvr19Topic(text, (set && set.length) ? (set[0] ?? null) : null);
    default: throw new Error('未知规则 ' + rule);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isMain) {
  const argv = process.argv.slice(2);
  const argOf = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  const { checks, failures } = selftest();
  if (failures.length > 0) {
    console.error(`selftest: FAIL（${checks} 项断言）`);
    for (const f of failures) console.error(`  ⛔ ${f}`);
    console.error('⛔ 自检未过，本次结果一律作废（COL-S15）。');
    process.exit(3);                       // 工具故障，不是作者缺陷
  }
  console.log(`selftest: OK（${checks} 项断言，${FIXTURES.length} 个夹具）`);
  if (argv.includes('--selftest')) process.exit(0);

  const file = argOf('--file');
  const topic = argOf('--topic');
  const genre = argOf('--genre') || 'readme';

  // ── 专题级模式（v0.5）：查 `05_复述测试.md` 与 `07_交付说明.md` ──────────────
  // ⭐ 这两份是**本技能自己规定必须产出的**，在加这个模式之前**从来没有执行者**。
  if (topic) {
    if (!existsSync(topic)) { console.error(`⛔ 工具故障：专题目录不存在 ${topic}`); process.exit(3); }
    const found = [];
    const p05 = join(topic, '05_复述测试.md');
    const p07 = join(topic, '07_交付说明.md');
    const p04 = join(topic, '04_草稿.md');
    if (!existsSync(p05)) {
      found.push({ sev: 'major', id: 'WVR-01', file: p05, line: 1,
        why: '专题目录里没有 `05_复述测试.md` —— 交付前必须存在一份',
        ev: 'WVR-01：缺即未通过' });
    } else {
      const t = readFileSync(p05, 'utf8');
      for (const f of [...wvr01(t), ...wvr02(t), ...wvr06(t)]) found.push({ ...f, file: p05 });
    }
    if (existsSync(p07)) {
      for (const f of wvr20(readFileSync(p07, 'utf8'))) found.push({ ...f, file: p07 });
    }
    // `WVR-19` 跨文件：复述测试标了「材料缺」⇒ 交付说明必须留白
    if (existsSync(p05)) {
      const rec = readFileSync(p05, 'utf8');
      const del = existsSync(p07) ? readFileSync(p07, 'utf8') : null;
      for (const f of wvr19Topic(rec, del)) found.push({ ...f, file: p07 });
      if (!/材料缺/.test(rec)) console.log('  n/a: WVR-19（复述测试里没有「材料缺」标记）');
    }
    if (existsSync(p04)) {
      for (const f of wrc16(readFileSync(p04, 'utf8'))) found.push({ ...f, file: p04 });
    }
    for (const f of found) console.log(`  [${f.sev}] ${f.id} @ ${f.file}:${f.line}\n      ${f.why}\n      证据：${f.ev}`);
    const maj = found.filter(f => f.sev === 'major').length;
    const adv = found.filter(f => f.sev === 'advisory').length;
    console.log(`checked: ${topic}（专题级：05_复述测试 · 07_交付说明 · 04_草稿的交叉引用）`);
    console.log(`found ${found.length} (major=${maj} advisory=${adv} info=0)`);
    process.exit(maj > 0 ? 1 : 0);
  }

  if (!file) {
    console.error('用法：node tools/check.mjs --file <成稿.md> [--genre readme|wiki|tech]');
    console.error('      node tools/check.mjs --topic <专题目录>   # 查 05_复述测试.md / 07_交付说明.md');
    console.error('      node tools/check.mjs --selftest');
    process.exit(2);
  }
  if (!existsSync(file)) {
    console.error(`⛔ 工具故障：文件读不到 ${file}`);
    process.exit(3);
  }
  const text = readFileSync(file, 'utf8');
  const findings = [];
  const na = [];                           // ⛔ n/a 必须看得见，不许静默跳过
  const cs = readTypeClosedSet(readFileSync(join(ROOT, 'references', '文体-设定集.md'), 'utf8'));

  if (genre === 'readme') {
    findings.push(...rmS11(text), ...rmS12(text), ...rmS13(text));
  } else if (genre === 'wiki') {
    findings.push(...wwkS06(text), ...wwkS08(text));
    if (/^-\s*type[：:]/m.test(text)) findings.push(...wwkS02(text, cs));
    else na.push('WWK-S02（本条无 `type` 字段）');
  } else if (genre === 'tech') {
    // 技术文章：三条 A 类。⚠️ 中文禁用词表**只能读 §2**（§3／§4 明令永不机检）
    const taText = readFileSync(join(ROOT, 'references', '文体-技术文章.md'), 'utf8');
    const emptySet = readEmptyHeadingSet(taText);
    const flags = readStrongRedFlags(readFileSync(join(ROOT, 'references', '词表-中文.md'), 'utf8'));
    if (!emptySet || !flags) {
      console.error('⛔ 工具故障：闭集解析失败（空词表或禁用词表）');
      process.exit(3);
    }
    findings.push(...taS10(text, emptySet), ...taS01(text, flags), ...taS07(text),
                  ...taS11(text, readGenreSet(taText) ?? []));
    if (!/^##\s/m.test(text)) na.push('WRT-TA-S10（本条没有二级标题）');
    if (!/[\u4e00-\u9fff]/.test(text)) na.push('WRT-TA-S01（中文侧 —— 本条不是中文稿）');
  } else {
    console.error(`⛔ 用法错：未知文体 ${genre}`);
    process.exit(2);
  }

  for (const f of findings) console.log(`  [${f.sev}] ${f.id} @ ${file}:${f.line}\n      ${f.why}\n      证据：${f.ev}`);
  const maj = findings.filter(f => f.sev === 'major').length;
  const adv = findings.filter(f => f.sev === 'advisory').length;
  console.log(`checked: ${file}（文体 ${genre}）`);
  if (na.length) console.log(`n/a: ${na.join(' ｜ ')}`);   // ⛔ 与 passed 长得不一样
  console.log(`found ${findings.length} (major=${maj} advisory=${adv} info=0)`);
  process.exit(maj > 0 ? 1 : 0);
}
