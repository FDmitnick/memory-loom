import OpenCC from "opencc-js";

export type ChineseScript = "simplified" | "traditional";

const traditionalToSimplified = OpenCC.Converter({ from: "t", to: "cn" });
const simplifiedToTraditional = OpenCC.Converter({ from: "cn", to: "t" });

export function toSimplified(value: string) {
  return traditionalToSimplified(value);
}

export function toTraditional(value: string) {
  return simplifiedToTraditional(value);
}

export function convertChinese(value: string, script: ChineseScript) {
  return script === "traditional"
    ? toTraditional(toSimplified(value))
    : toSimplified(value);
}

export function simplifyData<T>(value: T): T {
  if (typeof value === "string") {
    return toSimplified(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => simplifyData(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, simplifyData(item)]),
    ) as T;
  }
  return value;
}
