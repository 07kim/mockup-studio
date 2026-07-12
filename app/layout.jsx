import './globals.css';

export const metadata = {
  title: 'Mockup Studio',
  description: 'スクリーンショット・URL・HTMLをデバイスフレームに合成する画像生成ツール',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
