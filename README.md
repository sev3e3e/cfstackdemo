# cfstackdemo – Cloudflare+GCPで構築したフルスタックデモアプリ

外部サイトからデータをFetch, ScrapingしFrontendで表示するフルスタック**デモ**アプリ。

※実際のWebサイトではなくMocked Web ServerからFetch/Scrapingしています。

frontend: https://cfstackdemo-frontend.ripfirem-cloudflare.workers.dev/

## 特徴

本番プロダクトへの技術導入検証を目的としたデモアプリケーション。

- monorepo構成による一元管理
- 依存性注入(DI)によるテスト容易性の確保 [(設計思想, 技術的負債についての思考ログ)](https://github.com/sev3e3e/cfstackdemo/issues/1)
- 独自SDKを用いたOpenTelemetry計測(Traceのみ)
- neverthrowを用いたResult型のエラーハンドリング

## 使用技術

### language

- TypeScript

### frontend

- Cloudflare Worker

### backend

Cloudflare
- Worker
- Queue
- R2
- D1

GCP
- CloudRun

OpenTelemetry

## 使用ライブラリ/FW

### frontend

- Svelte 5
- Sveltekit

### backend

- Drizzle ORM / kit
- hono
- Vitest

## packages

| package name | description |
|--------------|-------------|
| [@cfstackdemo/sitef-entrypoint](backend/sitef/entrypoint) | cron entrypoint, saleを取得, saleに紐づくitemを取得, queueへ流す |
| [@cfstackdemo/sitef-fetcher](backend/sitef/fetcher) | fetcher. 基本proxy経由. |
| [@cfstackdemo/sitef-main](backend/sitef/main) | queueに流れてきたitemデータから詳細データをscraping, r2とd1へ保存 |
| [@cfstackdemo/sitef-scraper](backend/sitef/scraper) | scraper. |
| [@cfstackdemo/main-d1](backend/main-d1) | D1 Wrapper |
| [@cfstackdemo/main-r2](backend/main-r2) | R2 Wrapper |
| [@cfstackdemo/mock-web-server](backend/mock-web-server) | 外部サイトのResponseをMockするDEMO用web server |
| [@cfstackdemo/jwt-worker](backend/proxy-relay/gcp/cf-jwt-worker) | ProxyのためのJWTをCacheするD1をwrapするworker |
| [@cfstackdemo/gcp-request-relay](backend/proxy-relay/gcp/function) | Proxy本体, GCPにdeployする |
| [@cfstackdemo/lightweight-otel-sdk](lightweight-otel-sdk) | OpenTelemetry 独自SDK (Only Tracing) |
| [@cfstackdemo/logger](logger) | 独自Logger |
| [@cfstackdemo/frontend](frontend) | Svelte5 + SveltekitのFrontend |



## Testing

主にVitestを使用しています。workerではvitest-pools-workerを使ってunit testを実施しています。

テストを書いているpackage

- [jwt-worker (jwt cache wrapper worker)](backend/proxy-relay/gcp/cf-jwt-worker/test)
- [sitef-entrypoint](backend/sitef/entrypoint/test)
- [sitef-fetcher](backend/sitef/fetcher/test)
- [sitef-main](backend/sitef/main/test)
- [sitef-scraper](backend/sitef/scraper/test)
- [main-r2](backend/main-r2/test)
- [main-d1](backend/main-d1/test)

## アーキテクチャ概要

### Summary
![Summary](./docs/arch.svg)

### Detail
![Detail](./docs/arch_detail.svg)

## Local Setup

rootで以下を実行します。

1. change branch

```
git checkout -b out-of-the-box
```

2. install dependency packages

```
pnpm i 
```

😀🎉

### Run Local

**cliを複数使う必要があります。**

### frontend local run

別々のcliで以下の3つのインスタンスを起動します。

```
pnpm run dev:d1
```

```
pnpm run dev:r2
```

```
pnpm run dev:frontend
```

access localhost and explore them! 😀🎉

### backend local run

別々のcliで以下の3つのインスタンスを起動します。

```
pnpm run dev:proxy
```

```
pnpm run dev:mws
```

```
pnpm run dev:backend
```

最後に`__scheduled`エンドポイントにアクセスしてscheduled handlerを起動してください。

access `http://localhost:{PORT}/__scheduled` in a web browser or something.

😀🎉

<details>
    <summary>何故こんな複雑なの？😭</summary>

    frontendではsveltekit - backend(r2,d1)間のlocal通信が同じcli上で動いているとうまくいかないため。
    (configオプション, npm-run-all2等の並列実行等, いずれも。)

    ---

    backendではworkerはmulitple configである程度まとめているが、mock-web-serverのみ別にしている。これはmulti configだととprimary worker以外serverがlistenしないため。
    gcpのproxyはwranglerではないため別枠起動。並列実行できそうだがもうここまで来たら別枠でよい。かも。
</details>