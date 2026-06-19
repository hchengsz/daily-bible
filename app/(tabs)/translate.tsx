import OpenCC from "opencc-js";

export function convertBibleText(text: string): string {
  // 去掉行首序号
  const withoutNumbers = text.replace(/^\d+\.\s*/gm, "");

  // 去掉汉字之间的空格
  const noSpaces = withoutNumbers.replace(/\s+/g, "");

  // 合并成一段
  const merged = noSpaces.replace(/\n+/g, "");

  // 繁体转简体
  const converter = OpenCC.Converter({ from: "tw", to: "cn" });

  return converter(merged);
}
