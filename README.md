# PULSE CHAIN

**ひとつ押す。全部つながる。**

[プレイする](https://yu-zora.com/games/PULSE_CHAIN/) · [Generator Inspector](https://yu-zora.com/games/PULSE_CHAIN/inspector.html)

8方向へ走る光球、反射・分岐・蓄積を使い、最小 TAP で全 CORE を消すパズル。ブラウザだけでゲーム・問題生成・最短解の証明が動きます。実行時の AI API、バックエンド、ログイン、外部トラッキングはありません。

## 実装されているもの

- Campaign：初期300ステージの固定マニフェスト、その後は番号から決定論的に生成。Stage 10,000 / 100,000 にも対応。
- Infinite：EASY / NORMAL / HARD / EXPERT / EXTREME。12候補を検証・比較して採用。
- Daily：UTCの日付から世界共通の問題。履歴と連続プレイ日のローカル記録。
- NORMAL、ARMOR 2/3、BLOCK、MIRROR、SPLITTER、VOID、GATE、CHARGE、ROTATOR、PORTAL。
- 光球の移動、反射、分裂、波紋、連鎖音、対応端末の振動。
- 最短手数表示、Solverヒント、Undo、Reset、途中再開、Puzzle Code / URL共有。
- お気に入り、Perfect記録、問題評価、セーブのエクスポート・マージインポート。
- PWA / オフライン、Workerでの生成・探索、先読み、IndexedDBの問題キャッシュ。
- キーボード操作、色と形の併用、動きの軽減、ハイコントラスト、音量設定。
- 大量検証、1万件の互換性回帰、初期300問のマニフェスト、ブラウザ自動テスト、レビュー用Inspector。

## 開発

Node.js 24 を使用。

```sh
npm ci
npm run dev
```

開発URL：`http://127.0.0.1:5173/games/PULSE_CHAIN/`

```sh
npm run typecheck
npm test
npm run regression
npm run build
npm run preview -- --port 4173
npm run test:browser
node scripts/offline-smoke.mjs
```

`test:browser` は初期設定で開発サーバーを使用します。`TEST_URL` で変更できます。ブラウザの準備は `npx playwright install chromium firefox webkit`。CIではブラウザが起動できない場合も失敗として扱います。

## 公開

Cloudflare Workers Static Assets で `/games/PULSE_CHAIN/` に配信しています。`npm run build` は通常の `dist/` と、パス込みの `site/games/PULSE_CHAIN/` を作ります。

```sh
npm run deploy:check
npm run deploy
```

認証には Wrangler のログインまたは環境変数のAPIトークンを使用します。リポジトリには認証情報を保存しません。既存サイトとのルーティング、ロールバック、更新時の注意点は [運用手順](docs/OPERATIONS.md) を参照してください。

## 検証と品質

現段階は **1.0.0-rc.1（実環境で評価するための公開候補版）**。機能実装と、自動検証による正しさの確認を進めた状態です。「長く遊んで面白い」という人間による評価、実機のMobile Safari、大量QAの最終判定は別のリリース条件です。

初期300問はSolverで選定・固定したものです。すべてを人がレビュー済みという意味ではありません。専用の導入盤面を14ステージに用意しています。自動品質スコアは連鎖長・最短手数・正解初手比率・装置への関与に基づくヒューリスティックです。Inspectorとローカル評価で改善できます。

```sh
npm run qa -- 100000
npm run qa -- 1000000 --safety
```

前者は候補の再現性、盤面整合性、全初手の安全性、予算内のSolver証明とその再生を検査します。後者は100万候補の全初手の安全性検査で、全候補の最短解を証明する試験とは区別します。CSVは `reports/`、集計JSONも同ディレクトリに出力します。候補の探索予算超過や光球上限は不採用理由として集計し、実装不整合は失敗として集計します。

詳しくは [ルールと設計](docs/ARCHITECTURE.md)、[検証・残課題](docs/VALIDATION.md) を参照してください。

## 互換性

`RULE-V1 / GEN-V1 / PC1` は初回公開以降固定します。改善で既存コードの問題が変わる場合は、旧エンジンと旧ジェネレータを残し、新バージョンを追加します。回帰データの上書きによって互換性の失敗を隠さないでください。

原仕様書は [MASTER_DESIGN.txt](docs/MASTER_DESIGN.txt) に保存しています。
