#!/usr/bin/env node
/**
 * page-health-snapshot.mjs — C-META-D77-4 (Tori §3.6 spec / Task_2026-05-12 §3)
 *
 * Confluence 페이지 version + lastModified jsonl append (read-only GET).
 *
 * graceful skip: CONFLUENCE_TOKEN env 미존재 시 reason='token absent' 반환 +
 *   페이지 메타데이터 0건 + 정상 종료 (DryRun 정합).
 *
 * 외부 dev-deps +0 (node 표준 fetch). src/ 변경 0. Confluence write 0 (GET만).
 */

import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_OUTPUT = "analytics/page-health.jsonl";
const DEFAULT_PAGE_IDS = [25985025];
const CLOUD_HOST = "ai4min.atlassian.net";

/**
 * @param {object} [input]
 * @param {number[]} [input.pageIds]
 * @param {string} [input.token]
 * @param {string} [input.output]
 * @returns {Promise<{ snapshots: Array<{ pageId: number, version: number|null, lastModified: string|null, observedAt: string, reason?: string }> }>}
 */
export async function pageHealthSnapshot({
  pageIds = DEFAULT_PAGE_IDS,
  token = process.env.CONFLUENCE_TOKEN,
  output = DEFAULT_OUTPUT,
} = {}) {
  const observedAt = new Date().toISOString();
  const snapshots = [];

  if (!token) {
    for (const pid of pageIds) {
      snapshots.push({
        pageId: pid,
        version: null,
        lastModified: null,
        observedAt,
        reason: "token absent (graceful skip)",
      });
    }
    return { snapshots };
  }

  for (const pid of pageIds) {
    try {
      const url = `https://${CLOUD_HOST}/wiki/api/v2/pages/${pid}?include-version=true`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.status === 401) {
        snapshots.push({ pageId: pid, version: null, lastModified: null, observedAt, reason: "401 token expired" });
        continue;
      }
      if (res.status === 404) {
        snapshots.push({ pageId: pid, version: null, lastModified: null, observedAt, reason: "404 not found" });
        continue;
      }
      if (!res.ok) {
        snapshots.push({
          pageId: pid,
          version: null,
          lastModified: null,
          observedAt,
          reason: `http ${res.status}`,
        });
        continue;
      }
      const body = await res.json();
      snapshots.push({
        pageId: pid,
        version: body?.version?.number ?? null,
        lastModified: body?.version?.createdAt ?? null,
        observedAt,
      });
    } catch (e) {
      snapshots.push({
        pageId: pid,
        version: null,
        lastModified: null,
        observedAt,
        reason: `fetch error: ${e.message}`,
      });
    }
  }

  const outPath = resolve(process.cwd(), output);
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  for (const snap of snapshots) {
    appendFileSync(outPath, JSON.stringify(snap) + "\n");
  }

  return { snapshots };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (k, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(`--${k}=`.length) : fallback;
  };
  const pageIdsRaw = get("pages", "25985025");
  const pageIds = pageIdsRaw.split(",").map((s) => Number(s.trim())).filter(Boolean);
  const output = get("output", DEFAULT_OUTPUT);
  try {
    const { snapshots } = await pageHealthSnapshot({ pageIds, output });
    console.log(JSON.stringify({ snapshots, count: snapshots.length }));
    process.exit(0);
  } catch (e) {
    console.error(`pageHealthSnapshot error: ${e.message}`);
    process.exit(2);
  }
}
