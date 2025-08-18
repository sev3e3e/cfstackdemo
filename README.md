# cfstackdemo – Cloudflareエコシステムで構築したフルスタックデモアプリ

外部サイトのデータをScrapingし保存, 表示するデモアプリ。

##  deployed URL

https://hoge.com 

## 使用言語

Typescript

## 使用インフラサービス

### Frontend

- Cloudflare Worker

### Backend

- Cloudflare
    - Worker
    - Queue
    - D1
    - R2

- GCP CloudRun

## 使用ライブラリ/FW

### Frontend

- Svelte5
- Sveltekit

### Backend

- hono
- DrizzleOrm / kit
- OpenTelemetry
- Vitest

## Architecture diaglams

![Frontend](./docs/frontend.mmd)

![Backend](./docs/backend.mmd)

