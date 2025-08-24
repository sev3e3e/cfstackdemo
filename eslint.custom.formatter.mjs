export default function (results) {
  return results
    .map((result) => {
      const errorCount = result.messages.filter(
        (msg) => msg.severity === 2
      ).length;
      return { path: result.filePath, count: errorCount };
    })
    .filter((item) => item.count > 0)
    .map((item) => `${item.path}: ${item.count}`)
    .join("\n");
}
