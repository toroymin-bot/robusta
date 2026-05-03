/**
 * next.config.ts
 *   - C-D35-1 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-1 6 게이트 정합.
 *     · serverExternalPackages: @modelcontextprotocol/sdk (server entry 차단 — Next 15)
 *     · webpack alias: 클라이언트 컴포넌트에서 SDK 정적 import 차단 (mcp-bundle 진입점만 허용)
 */

import type { NextConfig } from "next";
import path from "node:path";

const ALLOWED_BUNDLE_DIR = path.resolve(__dirname, "src/modules/mcp");

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  // C-D35-1 (2): server entry 차단 — SDK 는 클라이언트 lazy chunk 외 진입 금지.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  webpack: (config, { dev: _dev, isServer: _isServer, webpack }) => {
    // C-D35-1 (5): alias 차단 — SDK 진입은 src/modules/mcp/mcp-bundle.ts 안에서만 허용.
    //   다른 위치에서 정적 import 시 IgnorePlugin 으로 빌드 fail.
    //   mcp-bundle.ts 자체는 같은 디렉토리에서 import 하므로 통과.
    config.plugins = config.plugins ?? [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource: string, context: string) {
          if (!resource.startsWith("@modelcontextprotocol/sdk")) return false;
          const callerDir = path.resolve(context);
          if (callerDir === ALLOWED_BUNDLE_DIR) return false;
          return true;
        },
      }),
    );
    return config;
  },
};

export default nextConfig;
