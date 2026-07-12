/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright 系はサーバー専用の外部パッケージとして扱う（P4 以降のレンダラで使用）
  experimental: {
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  },
};

export default nextConfig;
