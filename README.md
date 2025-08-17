# cfstackdemo – Cloudflareエコシステムで構築したフルスタックデモアプリ

Cloudflare Workers / D1 / R2 / Queue /  Pages / GCP CloudRun で構成されたデモアプリ。

frontend: https://hoge.com  

## 特徴

- CloudflareとGCPによるフルスタック構成
- 合計12packagesによるmonorepo構成
- OpenTelemetry導入によるedge環境での観測性の確保

## アーキテクチャ概要

![Frontend](./docs/frontend.mmd)

![Backend](./docs/backend.mmd)

## 使用技術

- Cloudflare Workers (バックエンド)
- Cloudflare Queue (Worker間通信)
- Cloudflare D1 / R2 (DB, ストレージ)
- Svelte5 + SvelteKit (フロントエンド)
- GCP Cloud Run (外部Proxy)
- OpenTelemetry SDK(独自実装), Logger
