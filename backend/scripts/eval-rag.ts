import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withDb } from "@/lib/db";
import { retrieveContext } from "@/lib/ai/retriever";
import { config } from "@/lib/config";

// 检索质量评测：计算 SI-01 召回率@topK 与 SI-02 精确率@topK。
// 运行需要真实 embedding provider（workers-ai / dashscope）与已建立索引的数据库。
interface EvalCase {
  query: string;
  kbIds: string[];
  relevantDocIds: string[];
}

function usage(): void {
  console.log("用法: DATABASE_URL=... [EMBEDDING_PROVIDER=...] npm run eval:rag [-- <标注集路径>]");
  console.log("标注集格式: [{ query, kbIds: [..], relevantDocIds: [..] }, ...]");
  console.log("示例: npm run eval:rag -- scripts/fixtures/rag-eval-sample.json");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("缺少 DATABASE_URL 环境变量");
    usage();
    return;
  }

  const fixturesPath = args[0] ?? resolve("scripts/fixtures/rag-eval-sample.json");
  const cases = JSON.parse(readFileSync(fixturesPath, "utf8")) as EvalCase[];
  const topK = config.knowledge.topK;
  const threshold = config.knowledge.similarityThreshold;
  const provider = process.env.EMBEDDING_PROVIDER || "workers-ai";

  console.log(`评测集: ${fixturesPath}（${cases.length} 条查询，topK=${topK}, threshold=${threshold}, provider=${provider}）\n`);

  await withDb(dbUrl, async () => {
    let totalRecall = 0;
    let totalPrecision = 0;

    for (const c of cases) {
      const hits = await retrieveContext(c.kbIds, c.query, topK, threshold);
      const hitSet = new Set(hits.map((h) => h.docId));
      const relevantHit = c.relevantDocIds.filter((id) => hitSet.has(id)).length;
      const recall = c.relevantDocIds.length > 0 ? relevantHit / c.relevantDocIds.length : 0;
      const precision = hits.length > 0 ? relevantHit / hits.length : 0;
      totalRecall += recall;
      totalPrecision += precision;

      console.log(`[recall=${recall.toFixed(2)} precision=${precision.toFixed(2)}] ${c.query}`);
      for (const h of hits) console.log(`    - ${h.filename}`);
      console.log("");
    }

    const n = cases.length;
    console.log(`结果 (${n} 条查询):`);
    console.log(`  SI-01 召回率@topK: ${(totalRecall / n).toFixed(3)}（目标 ≥ 0.80）`);
    console.log(`  SI-02 精确率@topK: ${(totalPrecision / n).toFixed(3)}（目标 ≥ 0.60）`);
  });
}

main().catch((err) => {
  console.error("评测失败:", err);
  process.exit(1);
});
