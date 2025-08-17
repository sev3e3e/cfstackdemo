# ログ命名ルール（dot記法）

```
<scope>.<entity>[.<sub-entity>...].<action>[.<sub-action>...].<stage>
```

* **scope**：システム領域（例：`r2`, `d1`, `api`, `worker`）
* **entity / sub-entity**：対象データや機能名。関数名やテーブル名を反映し、必要に応じて`.`で階層化。関数名・固有名は`_`で結合（例：`save_all`）
* **action / sub-action**：操作内容（例：`read`, `create`, `append`, `insert`, `update`, `delete`, `parse`, `cleanup`）
* **stage**：処理段階（例：`start`, `prepare`, `complete`, `success`, `error`, `unexpected`）
* すべて**小文字**で記述し、省略語は避ける