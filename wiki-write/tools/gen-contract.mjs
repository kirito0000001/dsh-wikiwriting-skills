#!/usr/bin/env node
// 从 wiki-write 的各文件里抽取规则表，生成 references/规则契约.md（索引，非正文）。
// 零依赖。用法：node tools/gen-contract.mjs <draftDir>
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("用法: node tools/gen-contract.mjs <draftDir>"); process.exit(2); }
const refDir = join(dir, "references");
if (!existsSync(refDir)) { console.error("找不到 references/: " + refDir); process.exit(2); }

const LEVELS = ["structural_invariant", "reviewed_invariant", "craft_default", "taste_option"];
// 行形如： | `WVR-01` | `structural_invariant` | 条文…… |
const ROW = /^\|\s*`?([A-Z]{2,4}(?:-[A-Z]{2})?-[A-Z]?\d+)`?\s*\|\s*`?([a-z_]+)`?\s*\|(.+?)\|\s*$/;

const files = readdirSync(refDir).filter((f) => f.endsWith(".md") && f !== "规则契约.md").sort();
const rows = [];
const problems = [];
for (const f of files) {
  const lines = readFileSync(join(refDir, f), "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = ROW.exec(line);
    if (!m) return;
    const [, id, level, body] = m;
    if (!LEVELS.includes(level)) { problems.push(`${f}:${i + 1} 级别不在四级内: ${level}`); return; }
    // ID 里若带级别字母，校验它与级别列一致
    const letter = /-([SRCT])\d+$/.exec(id)?.[1];
    const want = { S: "structural_invariant", R: "reviewed_invariant", C: "craft_default", T: "taste_option" }[letter];
    if (want && want !== level) problems.push(`${f}:${i + 1} ID 级别字母与级别列不一致: ${id} vs ${level}`);
    rows.push({ id, level, file: f, summary: body.replace(/`/g, "").replace(/\s+/g, " ").trim() });
  });
}

const seen = new Map();
for (const r of rows) {
  if (seen.has(r.id)) problems.push(`重复 ID：${r.id}（${seen.get(r.id).file} 与 ${r.file}）`);
  else seen.set(r.id, r);
}
const uniq = [...seen.values()];
const count = (lv) => uniq.filter((r) => r.level === lv).length;

const byFile = new Map();
for (const r of uniq) byFile.set(r.file, (byFile.get(r.file) ?? 0) + 1);

const trunc = (s, n = 72) => (s.length <= n ? s : s.slice(0, n - 1) + "…");
const out = [];
out.push("# 规则契约（`wiki-write`）—— 索引");
out.push("");
out.push("> **本文件是索引，不是规则正文。** 每条规则的正文**只存在于它所属的那一个文件里**（各文体骨架 / `重构.md` / `验收.md`），本文件只登记 `ID ｜ 级别 ｜ 摘要 ｜ 所在文件`。");
out.push("> ⚠️ **与 `wiki-collect` 的差异**：那份的契约是「规则正文的唯一处」；这一份不是 —— 规则太多，集中到一处会变成没人读的巨文件。**单一定义点仍然成立**：一条规则只有一个正文处。");
out.push("> ⚠️ **改级别要同时改两处**：ID 里的级别字母（若含）与本索引。**改 ID 算破坏性变更。**");
out.push("");
out.push("## 0. 判定者由级别决定");
out.push("");
out.push("| 级别 | 谁能判 | 能不能阻断交付 | 怎么用 |");
out.push("| --- | --- | --- | --- |");
out.push("| `structural_invariant` | 脚本（确定性检查） | **默认**能，退出码即门禁 | **当门槛**：交付前必须全过 |");
out.push("| `reviewed_invariant` | reviewer（人／独立实例），**必须引证据** | 能，但要给证据 | **抽查**，别全查 |");
out.push("| `craft_default` | 作者；**说明理由即可覆盖** | 不能 | **默认值**，覆盖要写理由 |");
out.push("| `taste_option` | 不判 | **不得单独阻断** | **自由度** |");
out.push("");
out.push("> ⚠️ **现阶段 `structural_invariant` 的执行者尚未实现** —— 级别描述的是「**可**被脚本阻断」，不是「已有脚本在阻断」。**不得声称「脚本已过」。**");
out.push("");
out.push("### 0.1 ⛔ 级别 ≠ 档位：`structural_invariant` 里有 advisory（**实测撞出来的**）");
out.push("");
out.push("**「可被脚本判」与「该不该拦交付」是两件事。** 上面那张表的第三列写的是**默认值**，不是保证。");
out.push("");
out.push("实测撞到过：`WRT-TA-S02`（em dash）**级别是 `structural_invariant`，而规则正文自己明写「按 advisory 记录不阻断」** —— 因为它的来源**自己的正面示例里就用了 em dash**，我们没有依据把它升级为阻断项。同理 `WRT-TA-S01` 的中文侧也明写「先按 `advisory` 跑」。");
out.push("");
out.push("⛔ **两条规则打架时，以规则正文为准，不以本表为准。** 但**必须在计数行里看得见**：报 `advisory` 的规则要能和各体裁一起被数出来，**不许静默降档**。");
out.push("");
out.push("> 为什么不在级别表里加第五级：`structural_invariant` 的**判据性质**（脚本可判、确定性）是它的定义，**档位是另一根轴**。把两根轴塞进一个枚举，就会出现「同一条规则既是结构级又不可阻断」这种说不清的状态 —— 而**这正是当初撞出这次冲突的原因**。");
out.push("");
out.push(`## 1. 索引（共 ${uniq.length} 条）`);
out.push("");
for (const [f, n] of [...byFile.entries()]) out.push(`- \`${f}\`：${n} 条`);
out.push("");
out.push("| ID | 级别 | 摘要 | 文件 |");
out.push("| --- | --- | --- | --- |");
for (const r of uniq.sort((a, b) => (a.file + a.id).localeCompare(b.file + b.id))) {
  out.push(`| \`${r.id}\` | \`${r.level}\` | ${trunc(r.summary)} | \`${r.file}\` |`);
}
out.push("");
out.push("## 2. 计数");
out.push("");
out.push("| 级别 | 条数 |");
out.push("| --- | --- |");
for (const lv of LEVELS) out.push(`| \`${lv}\` | ${count(lv)} |`);
out.push(`| **合计** | **${uniq.length}** |`);
out.push("");
out.push("## 3. 生成方式");
out.push("");
out.push("本文件由 `tools/gen-contract.mjs` 从各文件的规则表抽取生成（零依赖）。**不要手工编辑** —— 改了也会被下次生成覆盖；要改规则请改它所在的正文文件。");
out.push("");

writeFileSync(join(refDir, "规则契约.md"), out.join("\n"), "utf8");
console.log(`已生成 references/规则契约.md：${uniq.length} 条规则（${files.length} 个源文件）`);
console.log(`级别分布：` + LEVELS.map((l) => `${l}=${count(l)}`).join(" / "));
if (problems.length) {
  console.log(`\n⚠️ 发现 ${problems.length} 处问题：`);
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
console.log("校验通过：无重复 ID、无级别越界、ID 级别字母与级别列一致。");
