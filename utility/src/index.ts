import type { Site } from "@cfstackdemo/types";

export function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return {};

  const plainObject: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  // cause を明示的に追加
  if (error.cause !== undefined) {
    plainObject.cause =
      error.cause instanceof Error
        ? serializeError(error.cause) // 再帰的にシリアライズ
        : error.cause;
  }

  // enumerable なプロパティも追加
  for (const key of Object.keys(error)) {
    plainObject[key] = (error as any)[key];
  }

  return plainObject;
}

export function ConvertSiteToNumberId(site: Site) {
  switch (site) {
    case "f":
      return 0;
    case "m":
      return 1;
    case "d":
      return 2;
    case "s":
      return 3;
    default:
      throw new Error(`Invalid site: ${site}`);
  }
}

export function ConvertNumberIdToSite(siteId: number): Site {
  switch (siteId) {
    case 0:
      return "f";
    case 1:
      return "m";
    case 2:
      return "d";
    case 3:
      return "s";
    default:
      throw new Error(`Invalid siteId: ${siteId}`);
  }
}
