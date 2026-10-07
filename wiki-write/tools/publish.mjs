#!/usr/bin/env node
// =============================================================================
// wiki-write 发布转换 · v0.4（2026-10-07）
//
// 解决的问题：接口 §7 要求「正文里的角标保留在校对版、发布版隐藏」，但**从没规定
// 怎么隐藏**。实测后果：作者自己写正则隐藏角标，把正文里的 `delete[]`、`parts[]`、
// `assets[].sha256` 三处 `[]` 一起吃掉了 —— **内容损伤，靠两版逐行对照才发现**。
//
// 所以 v0.4 把「隐藏」变成一个**确定性的、可复核的转换**：
//
//     06_发布版.md  ≡  publish(04_草稿.md)
//
// 发布版**不许手改**；改草稿，重跑本脚本。`--verify` 就是这个不变式的机检。
//
// 用法：
//   node publish.mjs --draft 04_草稿.md [--out 06_发布版.md] [--status active]
//   node publish.mjs --verify 04_草稿.md 06_发布版.md
//   node publish.mjs --selftest
//
// 零依赖，只用 node 内置模块。
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// ── 角标语法（v0.4 定义 · 接口 §7）──────────────────────────────────────────
//   〔A-nn〕/〔B-nn〕/〔C-nn〕—— **全角六角括号**（U+3014 / U+3015）。
//
// ⛔ 为什么不用 `[A-01]`（v0.3 的写法）：方括号在正文里到处都是 —— C++ 的
//    `delete[]`、JSON 路径的 `assets[].sha256`、数组的 `parts[]`、Markdown 链接的
//    `[text](url)`。**任何以半角方括号为锚的正则都有误伤风险**，而且误伤是
//    「悄悄吃掉两个字符」，不报错、看不出来。
//    全角六角括号**不会出现在代码里**，是安全的锚。
//
// 写法纪律：角标**紧贴前一个字符**，不留空格（`…自动更新〔A-08〕。`）。
//    留了空格也能删干净，但会留下一个多余空格；本脚本会对这种写法报 advisory。
//
// ── 册名（v0.5 新增 —— 账本分册逼出来的）────────────────────────────────────
// ⛔ **一本账装不下时，`wiki-collect` 允许拆成多册**（`素材账本字段.md` §3：
//    「装不下就拆专题，不要扩位数」—— 每级上限 99 条）。拆了之后**三册的 `A-01` 是三个不同的东西**，
//    所以跨册引用**必须带册名**：
//      〔A-01〕          主册 `01_素材账本.md`（**册名可省** —— 绝大多数引用都是它）
//      〔01b A-01〕      `01b_素材账本-续.md`
//      〔02 A-01〕       `02_素材账本-Q5Q6.md`
//    **册名 = 文件名的第一段**（下划线之前）。
// ⛔ **为什么必须治这个**：拆分那一轮，作者只能自创「续 A-01」这种写法 ——
//    而 `COL-S16` 明令「**不许自造前缀**」，于是它删不掉，**实测 35 条 advisory**，
//    角标原样出现在发布版里给读者看。
const MARK_RE = /〔(?:([0-9]{2}[a-z]?) )?([ABC]-\d{2})〕/g;
const MARK_LOOSE_RE = /(^|[\s])〔(?:[0-9]{2}[a-z]? )?[ABC]-\d{2}〕/;
// ⛔ 括号里的内容：册名**可选**（主册不带）。第一次写成 `^([0-9]{2}[a-z]?) ?(…)$`
//    —— **册名成了必需**，于是 `〔A-01〕` 这个最常见形态被判成"不是角标"（自检当场抓到）。
const MARK_BODY_RE = /^(?:([0-9]{2}[a-z]?) )?([ABC]-\d{2})$/;

// HTML 注释 = 内部批注（写给采集/校对看的，不是给读者的）
const COMMENT_AT_LINE_START_RE = /^[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n?/gm;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

const FRONTMATTER_RE = /^(---\r?\n)([\s\S]*?)(\r?\n---[ \t]*\r?\n?)/;

// ── 转换本体 ─────────────────────────────────────────────────────────────────
export function publish(text, { status = 'active' } = {}) {
  // ⛔ **先剥 UTF-8 BOM**（v0.5 补 —— 实测撞出来的）。
  //    PowerShell 5.1 的 `Set-Content -Encoding UTF8` **会写 BOM**，而 `FRONTMATTER_RE`
  //    要求 `^(---` —— BOM 一挡就抛「找不到 frontmatter（接口 §2 要求恰好 5 键）」，
  //    而草稿本身**完全合法**。与 `wiki-collect/tools/check.mjs` 那个
  //    「UTF-16 被判成二进制」是**同一类病**：**工具写的字节，被另一个工具误判**。
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const fm = FRONTMATTER_RE.exec(text);
  if (!fm) throw new Error('找不到 frontmatter（接口 §2 要求恰好 5 键）');
  const [, open, head, close] = fm;
  let rest = text.slice(fm[0].length);

  const advisories = [];

  // ① 角标：紧贴写法检查（先查再删）
  for (const line of rest.split(/\r?\n/)) {
    if (MARK_LOOSE_RE.test(line)) {
      advisories.push(`角标没紧贴前一个字符 —— 删完会留下多余空格；**如果这一格只有角标，整格会变空**（实测：附录的「角标」列整列变空。表格里的角标建议改成读者可见的纯文本条号）：${line.trim().slice(0, 60)}`);
    }
  }
  const marksRemoved = (rest.match(MARK_RE) ?? []).length;
  rest = rest.replace(MARK_RE, '');

  // ② HTML 注释：独占一行的整行删掉，行内的只删注释本身
  const commentsAtLineStart = (rest.match(COMMENT_AT_LINE_START_RE) ?? []).length;
  rest = rest.replace(COMMENT_AT_LINE_START_RE, '');
  const commentsInline = (rest.match(COMMENT_RE) ?? []).length;
  rest = rest.replace(COMMENT_RE, '');

  // ③ frontmatter：只改 status 一行，**其余键逐字节不动**
  if (!/^status\s*:/m.test(head)) throw new Error('frontmatter 里没有 status 键');
  const newHead = head.replace(/^status\s*:.*$/m, `status: ${status}`);
  const statusChanged = newHead !== head;

  return {
    text: open + newHead + close + rest,
    stats: { marksRemoved, commentsRemoved: commentsAtLineStart + commentsInline, statusChanged },
    advisories,
  };
}

// ── 发布版的「结构完好性」（v0.5 新增）──────────────────────────────────────
// ⛔ **为什么加**：`--verify` 只查「两版是否同源」，**不查「发布版是不是一份合法的 Markdown」**。
//    实测一轮，**两个真缺陷都是这么漏过门禁的**：
//      · 草稿里 8 处非 `A-nn` 的六角括号原样漏进发布版（`MARK_RE` 只认 `〔A-nn〕`）
//      · 发布版里 `## …` 与上一段黏在同一行 → **不再被解析成标题**
//    **两个缺陷 `--verify` 都照样通过。**
//
// ⚠️ **关于第二个缺陷，我复现不出来** —— 写探针试了 **15 种**注释结构（紧跟 frontmatter／前后空行／
//    多行／两条相邻／含角标／带尾随空格／缩进／行内／后接 H1……），**坏的 0 种**。
//    症状是真的（那一轮确实看到了黏在一起的行），但「注释正则吃掉换行」这个原因站不住。
//    → 所以这里**不修原因，只加检测**：无论触发条件是什么，这一条都拦得住。
//
// ⚠️ **判据故意收窄**：只认「`#` 直接黏在**非空白字符**后面」。放宽成「行内任意位置有 `##`」
//    会误伤 `见 §3 ## 小节` 这种正当写法 —— **误报比漏报更伤**。
export function sanity(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue; // COL-S14 的纪律：围栏代码块整块跳过
    // ⛔ **行内代码（反引号）里的 `##` 不是标题。** 这一条是**上线后立刻撞到的真实误报**：
    //    `（见 \`## 未知\` 一节）` 被当成了「标题黏在上一行」。**先剥行内代码再判。**
    const probe = line.replace(/`[^`]*`/g, '');
    if (!/^\s*#/.test(probe) && /(?<=[^\s#])#{2,}\s+\S/.test(probe)) {
      out.push({ sev: 'major', line: i + 1, why: `标题记号黏在上一行里，不会被解析成标题：${line.trim().slice(0, 60)}` });
    }
    if (!/^\s*\|/.test(probe) && /(?<=[^\s|])\|[\s:|-]{5,}\|/.test(probe)) {
      out.push({ sev: 'major', line: i + 1, why: `表格分隔行黏在上一行里：${line.trim().slice(0, 60)}` });
    }
    for (const m of line.matchAll(/〔([^〕]*)〕/g)) {
      if (!MARK_BODY_RE.test(m[1])) {
        out.push({ sev: 'advisory', line: i + 1, why: `六角括号里不是角标形态，会原样带给读者：${m[0].slice(0, 40)}` });
      }
    }
  }
  return out;
}

// ── 自检（`COL-S15` 的纪律；`wiki-collect/规则契约.md` §5）────────────────────
// 正样本 = 必须发生的变化；负样本 = 必须**逐字节不动**的东西。
// ⚠️ 负样本 1 就是那次真实事故的回归测试。
// ⚠️ HEAD 必须以 `---\n` **结尾**（不是 `---\n\n`）—— frontmatter 正则只吃到 `---` 后那一个
//    换行为止，多出来的换行会留在正文里，夹具就会集体「多一个 \n」。
const HEAD = '---\nschema_version: 2\nstatus: draft\nrouting_summary: 测试\nlast_reviewed: 2026-10-07\nreview_cycle: 30d\n---\n';
const FIXTURES = [
  { name: '正1 角标被删除', body: '更新是自动的〔A-08〕。\n', want: '更新是自动的。\n' },
  { name: '正2 多类角标都删', body: '〔A-01〕前〔B-02〕中〔C-03〕后\n', want: '前中后\n' },
  { name: '正3 行内 HTML 注释删除', body: '正文 <!-- 内部批注 --> 继续\n', want: '正文  继续\n' },
  { name: '正4 独占一行的注释整行删除', body: '正文\n<!-- 本文承诺：给谁看 -->\n继续\n', want: '正文\n继续\n' },
  { name: '正5 跨行注释删除', body: '正文\n<!--\n多行\n批注\n-->\n继续\n', want: '正文\n继续\n' },
  { name: '正6 代码块里的 〔A-01〕 也删（它是标记，不是代码）',
    body: '```\n〔A-01〕\n```\n', want: '```\n\n```\n' },
  // ── 负样本：必须逐字节不动 ────────────────────────────────────────────────
  { name: '负1 ⛔ C++/JSON 里的空方括号（真实事故回归）',
    body: '删除项写进 `delete[]`；分卷在 `parts[]` 里；`assets[].sha256` 是整包语义。\n',
    want: '删除项写进 `delete[]`；分卷在 `parts[]` 里；`assets[].sha256` 是整包语义。\n' },
  { name: '负2 ⛔ Markdown 链接不是角标', body: '见 [接口](https://example.com/a) 与 ![图](x.png)\n',
    want: '见 [接口](https://example.com/a) 与 ![图](x.png)\n' },
  { name: '负3 半角 [A-01] 不是角标（v0.3 写法不再识别）', body: '旧写法 [A-01] 不该被删\n',
    want: '旧写法 [A-01] 不该被删\n' },
  { name: '负4 表格与列表结构不动', body: '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- x\n- y\n',

    want: '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- x\n- y\n' },

  // ── 册名（v0.5 新增 —— 账本分册逼出来的）────────────────────────────────────
  { name: '正7 带册名的角标被删（01b 续册）', body: '见〔01b A-01〕与〔A-02〕。\n', want: '见与。\n' },
  { name: '正8 带册名的角标被删（02 册）', body: '依据〔02 B-07〕。\n', want: '依据。\n' },
  // ⛔ 负5 是**实测形态**：拆分那一轮作者只能自创「续 A-01」——
  //    而 `COL-S16` 明令「不许自造前缀」，它**删不掉**（实测 35 条 advisory）。
  //    **本夹具的意义就是钉住"自创形态仍然不被认识"**，逼作者改用 `〔01b A-01〕`。
  { name: '负5 ⛔ 自创前缀「续 A-01」不被删（实测形态）', body: '见〔续 A-01〕。\n',
    want: '见〔续 A-01〕。\n' },
];

// ── `sanity()` 的夹具（v0.5）─────────────────────────────────────────────────
// 正样本来自**实测撞到的**两个真缺陷；负样本是**故意收窄判据**要防的误报。
const SANITY_FIXTURES = [
  { name: '正1 标题黏在上一段末尾（实测撞到）', text: '把素材同步进 Unreal 工程。## 它是干什么的\n', expect: ['major'] },
  { name: '正2 表格分隔行黏在上一行', text: '| 操作系统 | Windows |\n| --- | --- |\n', expect: [] },
  { name: '正3 非角标形态的六角括号（实测撞到）', text: '见 〔03_变更与缺口.md §2.6〕 与 〔A-01〕。\n', expect: ['advisory'] },
  { name: '负1 正常标题与表格', text: '## 标题\n\n段落。\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n', expect: [] },
  { name: '负2 ⛔ 行内出现 `##` 但前面有空格（不许报）', text: '见 §3 ## 小节 的说明。\n', expect: [] },
  { name: '负3 ⛔ 围栏代码块里整块跳过', text: '```\n把素材同步进 Unreal 工程。## 它是干什么的\n| --- | --- |\n```\n', expect: [] },
  { name: '负4 ⛔ 合法的 〔A-nn〕/〔B-nn〕/〔C-nn〕 不算残留', text: '前〔A-01〕中〔B-02〕后〔C-99〕\n', expect: [] },
  { name: '负6 ⛔ 带册名的角标是合法形态（v0.5 新增）', text: '见〔01b A-01〕与〔02 B-07〕。\n', expect: [] },
  { name: '正4 自创前缀「续 A-01」不是角标形态（实测撞到 35 条）', text: '见〔续 A-01〕。\n', expect: ['advisory'] },
  // ⛔ **上线后立刻撞到的真实误报**（crossingvoid 第 97 行）：行内代码里的 `##` 是**节名**，不是标题。
  { name: '负5 ⛔ 行内代码里的 `##`（实测误报，crossingvoid:97）',
    text: '- 名词表另有一处用法与设定页不同：`docs/references/glossary.md:10`（见 `## 未知` 一节）\n', expect: [] },
];

export function selftest() {
  const failures = [];
  let checks = 0;
  for (const fixture of FIXTURES) {
    checks += 1;
    let got;
    try {
      // ⚠️ 不能按 `HEAD.length` 切片比对 —— 转换会改 `status`（`draft`→`active` 长 1 字符），
      //    基准一错位，所有夹具都会「差一个字符」。要按**输出自己的** frontmatter 长度切。
      const out = publish(HEAD + fixture.body).text;
      const m = FRONTMATTER_RE.exec(out);
      if (!m) throw new Error('输出里找不到 frontmatter');
      got = out.slice(m[0].length);
    } catch (error) {
      failures.push(`${fixture.name}：抛异常 ${error.message}`);
      continue;
    }
    if (got !== fixture.want) {
      failures.push(`${fixture.name}：\n      期望 ${JSON.stringify(fixture.want)}\n      实得 ${JSON.stringify(got)}`);
    }
  }
  // frontmatter 的负样本：除 status 外的键必须逐字节不动
  checks += 1;
  const published = publish(HEAD + '正文\n').text;
  const headOut = FRONTMATTER_RE.exec(published)[2];
  const keep = ['schema_version: 2', 'routing_summary: 测试', 'last_reviewed: 2026-10-07', 'review_cycle: 30d'];
  for (const key of keep) {
    if (!headOut.includes(key)) failures.push(`frontmatter 的 ${key} 被改动了（只许改 status）`);
  }
  checks += 1;
  if (!/^status: active$/m.test(headOut)) failures.push(`status 没被改成 active，实得：${headOut}`);

  // ── ⛔ `--status` 早就有，却**从没被自检覆盖**（v0.5 实测撞出来的）──────────────
  // 后果不是"少测一条"：`--verify` 一直用**默认 `active`** 算期望值，所以用
  // `--status draft` 生成的发布版**必然 FAIL**，而且报的是「发布版被手改过」—— **指错方向**。
  checks += 1;
  const customHead = FRONTMATTER_RE.exec(publish(HEAD + '正文\n', { status: 'draft' }).text)[2];
  if (!/^status: draft$/m.test(customHead)) failures.push(`--status draft 没生效，实得：${JSON.stringify(customHead)}`);
  checks += 1;
  for (const key of keep) {
    if (!customHead.includes(key)) failures.push(`--status 自定义时 frontmatter 的 ${key} 被改动了`);
  }

  // ── `sanity()` 的夹具（v0.5）───────────────────────────────────────────────
  for (const fixture of SANITY_FIXTURES) {
    checks += 1;
    const got = sanity(fixture.text).map(p => p.sev);
    const want = fixture.expect;
    const same = got.length === want.length && want.every(sev => got.includes(sev));
    if (!same) {
      failures.push(`${fixture.name}：期望 ${JSON.stringify(want)}，实得 ${JSON.stringify(got)}` +
        `\n      ${JSON.stringify(sanity(fixture.text))}`);
    }
  }
  // ── 直接断言：**UTF-8 BOM 不得让 `publish()` 抛错**（v0.5）────────────────────
  // 踩出来的：PS 5.1 的 `Set-Content -Encoding UTF8` **会写 BOM**，而 `FRONTMATTER_RE`
  // 要求 `^(---` —— BOM 一挡就抛「找不到 frontmatter」，**而草稿完全合法**。
  checks += 1;
  try {
    const out = publish('\uFEFF' + HEAD + '正文\n').text;
    if (out.charCodeAt(0) === 0xfeff) failures.push('带 BOM 的草稿：发布版里 BOM 没被剥掉');
    else if (!/^---\n/.test(out)) failures.push(`带 BOM 的草稿：解析出来的结果不对 —— ${JSON.stringify(out.slice(0, 20))}`);
  } catch (error) {
    failures.push(`带 BOM 的草稿抛异常了：${error.message}`);
  }
  return { checks, failures };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const argv = process.argv.slice(2);
  const argOf = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  const { checks, failures } = selftest();
  if (failures.length > 0) {
    console.error(`selftest: FAIL（${checks} 项断言）`);
    for (const f of failures) console.error(`  ⛔ ${f}`);
    console.error('⛔ 自检未过，本次结果一律作废（COL-S15）。');
    process.exit(1);
  }
  console.log(`selftest: OK（${checks} 项断言，${FIXTURES.length} 个夹具）`);

  if (argv.includes('--selftest')) process.exit(0);

  if (argv.includes('--verify')) {
    const [draftPath, publishedPath] = argv.filter(a => !a.startsWith('--') && a.endsWith('.md'));
    if (!draftPath || !publishedPath) {
      console.error('用法：node publish.mjs --verify <04_草稿.md> <06_发布版.md> [--status active]');
      process.exit(2);
    }
    const expected = publish(readFileSync(draftPath, 'utf8'), { status: argOf('--status') ?? 'active' }).text;
    const actual = readFileSync(publishedPath, 'utf8');
    if (expected === actual) {
      console.log(`✅ ${publishedPath} ≡ publish(${draftPath})，逐字节相同`);
      // ⛔ v0.5：**逐字节相同 ≠ 发布版合法。** 两个实测真缺陷都是在这一步之后才被发现的。
      const probs = sanity(actual);
      for (const p of probs) console.log(`  [${p.sev}] 发布版第 ${p.line} 行：${p.why}`);
      const maj = probs.filter(p => p.sev === 'major');
      if (maj.length > 0) {
        console.error(`⛔ major：不变式成立，但发布版有 ${maj.length} 处结构损伤（上面已列出）—— 读者会看到坏结构。`);
        process.exit(1);
      }
      process.exit(0);
    }
    const a = expected.split(/\r?\n/), b = actual.split(/\r?\n/);
    console.error(`⛔ major：发布版与「草稿经转换」的结果不一致 —— 发布版被手改过，或有转换漏项。`);
    // ⛔ v0.5：**"不一致"的头号原因是 `--status` 没一起传**，而原来的报错会把人指向"被手改过"。
    const assumedStatus = argOf('--status') ?? 'active';
    const actualStatus = /^status\s*:\s*(.+)$/m.exec(FRONTMATTER_RE.exec(actual)?.[2] ?? '')?.[1]?.trim();
    if (actualStatus && actualStatus !== assumedStatus) {
      console.error(`   ⚠️ 提示：发布版的 status 是 \`${actualStatus}\`，本次校验按 \`${assumedStatus}\` 算 ——` +
        `若它是用 \`--status ${actualStatus}\` 生成的，校验时也要照样传。`);
    }
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < 10; i += 1) {
      if (a[i] !== b[i]) {
        console.error(`  第 ${i + 1} 行：`);
        console.error(`    应为 ${JSON.stringify(a[i] ?? '<无>')}`);
        console.error(`    实为 ${JSON.stringify(b[i] ?? '<无>')}`);
        shown += 1;
      }
    }
    process.exit(1);
  }

  const draftPath = argOf('--draft');
  if (!draftPath) {
    console.error('用法：node publish.mjs --draft <04_草稿.md> [--out <06_发布版.md>] [--status active]');
    console.error('      node publish.mjs --verify <04_草稿.md> <06_发布版.md> [--status active]   ← --status 两边必须一致');
    process.exit(2);
  }
  const outPath = argOf('--out') ?? draftPath.replace(/04_草稿/, '06_发布版');
  const { text, stats, advisories } = publish(readFileSync(draftPath, 'utf8'), {
    status: argOf('--status') ?? 'active',
  });
  writeFileSync(outPath, text, 'utf8');
  console.log(`${draftPath} → ${outPath}`);
  console.log(`  删除角标 ${stats.marksRemoved} 个 · HTML 注释 ${stats.commentsRemoved} 处 · status ${stats.statusChanged ? `已改为 ${argOf('--status') ?? 'active'}` : '无需改'}`);
  for (const a of advisories) console.log(`  [advisory] ${a}`);
  // ⛔ v0.5：转换完顺手查一遍结构完好性 —— 别把坏结构留给 --verify 之后的读者
  const probs = sanity(text);
  for (const p of probs) console.log(`  [${p.sev}] 发布版第 ${p.line} 行：${p.why}`);
  const maj = probs.filter(p => p.sev === 'major');
  if (maj.length > 0) {
    console.error(`⛔ 转换产出的发布版有 ${maj.length} 处结构损伤（上面已列出）—— 修草稿后重跑。`);
    process.exit(1);
  }
  console.log(`  复核：node publish.mjs --verify "${draftPath}" "${outPath}"`);
}
