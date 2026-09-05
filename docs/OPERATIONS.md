# 公開・運用

本番URL：https://yu-zora.com/games/PULSE_CHAIN/

配信：Cloudflare Worker `pulse-chain` のStatic Assets。ゲームの計算はクライアントのみ。

## デプロイ

1. `npm ci`
2. `npm run typecheck && npm test && npm run regression`
3. `npm run deploy:check`
4. `npm run deploy`
5. 本番でContinue、クリア、Daily、共有コード、オフライン再起動を確認。

`wrangler.jsonc` のproductionは2つのルートだけを管理します。

- `yu-zora.com/games/PULSE_CHAIN`
- `yu-zora.com/games/PULSE_CHAIN/*`

既存の `yu-zora.com/games/*` のゲームポータルより具体的なルートです。ポータルや他ゲームのWorkerは変更しません。Cloudflareへの認証はWranglerのOAuthまたは安全な環境変数を使います。APIトークンをコミットしないでください。

`site/` はビルド専用です。ビルドスクリプトは作業ルートと出力先を検証してから、古い出力を置き換えます。別のサイトのファイルをこのディレクトリへ入れないでください。

## 更新とロールバック

配信済みのCloudflare Version IDは `docs/deployment.json` に記録します。Wranglerのdeployment/versionコマンドまたはCloudflare Dashboardで直前の正常バージョンへ戻せます。ロールバック先のversion IDを確認し、対象Workerが `pulse-chain` であることを確認してください。

Service Workerのキャッシュ名は全配信アセットの内容hashから作ります。新キャッシュのインストールが成功するまで既存キャッシュを残し、既存のタブを閉じた後に更新されます。古いゲーム画面を開いたままのプレイヤーへ、新しいルールを途中適用しません。オフラインのプレイヤーには取得済みの版が残ります。

## 長期互換

- RULE-V1、GEN-V1、`manifest-v1.ts` と公開済みPuzzle Codeを固定する。
- バージョン変更時は旧実装を削除せず、コードの接頭辞から分岐する。
- セーブ形式を変える時は既存セーブの移行テストを先に追加する。
- `tests/fixtures-v1.json` の更新で回帰失敗を隠さない。
- Dailyの日付基準はUTCを維持する。
- 品質調整を既存Campaignへ遡及適用しない。

## 検証の運用

GitHub Actionsは手動起動で、型検査、ユニットテスト、1万件回帰、ビルド、候補QA、3ブラウザ操作を実行します。検証停止の依頼に合わせてpush時の自動実行は無効にしています。Cloudflareへの自動デプロイ用秘密情報は設定していないため、pushだけで本番が変わる構成ではありません。

大きな生成テストは `npm run qa -- 100000`。6プロセス以内で実行し、各CSVは `reports/solver-N.csv` に残します。最短解探索の予算超過とプログラムの不整合を区別してください。大量CSVはGit管理対象外です。集計JSONと、問題の再現コードをレビューへ添付します。

人間レビューはInspectorから問題を開き、クリア画面で評価し、設定から記録を書き出します。サーバーへ自動送信しません。別ブラウザ・実機の記録を統合する場合も同じエクスポート／インポートを使用できます。

Cloudflare以外へ移す場合は、`site/games/PULSE_CHAIN/` を同じパスで静的配信してください。ホスト固有の `_headers` は移行先に合わせて設定します。
