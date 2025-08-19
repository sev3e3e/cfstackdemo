# cfstackdemo – Cloudflare+GCPで構築したフルスタックデモアプリ

外部サイトからデータをFetch, ScrapingしFrontendで表示するフルスタック**デモ**アプリ。

※実際のWebサイトではなくMocked Web ServerからFetch/Scrapingしています。

frontend: https://hoge.com

## 特徴

本番プロダクトへの技術導入検証を目的としたデモアプリケーション。

- monorepo構成による一元管理
- 依存性注入(DI)によるテスト容易性の確保 [(設計思想, 技術的負債についての思考ログ)](https://github.com/sev3e3e/cfstackdemo/issues/1)
- 独自SDKを用いたOpenTelemetry計測(Traceのみ)
- neverthrowを用いたResult型のエラーハンドリング

## Local Setup

### frontend local debug

todo

### backend local debug

todo



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

## アーキテクチャ概要

### Summary
![Summary](./docs/arch.svg)

### Detail
![Detail](./docs/arch_detail.svg)



