import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// コピー元とコピー先のパスを設定
const seederPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"./src/masters",
);
const destinationPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"./drizzle",
);

// ディレクトリの存在確認、なければ作成
async function ensureDir(dirPath) {
	try {
		await fs.mkdir(dirPath, { recursive: true });
		console.log(`Directory created: ${dirPath}`);
	} catch (err) {
		if (err.code !== "EEXIST") {
			throw err;
		}
	}
}

// ファイルをコピーする関数
async function copyFiles(srcDir, destDir) {
	try {
		const entries = await fs.readdir(srcDir, { withFileTypes: true });
		for (const entry of entries) {
			const srcPath = path.join(srcDir, entry.name);
			const destPath = path.join(destDir, entry.name);

			if (entry.isDirectory()) {
				await ensureDir(destPath);
				await copyFiles(srcPath, destPath); // 再帰的にディレクトリ内をコピー
			} else {
				await fs.copyFile(srcPath, destPath);
				console.log(`Copied file: ${srcPath} -> ${destPath}`);
			}
		}
	} catch (err) {
		console.error(`Error copying files: ${err}`);
	}
}

// 実行
async function main() {
	await ensureDir(destinationPath);
	await copyFiles(seederPath, destinationPath);
}

main();
