from __future__ import annotations

import json
import re
from bisect import bisect_left
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "catechism"
OUTPUT_DIR = ROOT / "src" / "data" / "catechism-source"
SOURCE_NAME_PATTERN = re.compile(
    r"^(?P<id>\d{2})_(?P<start>\d{4})-(?P<end>\d{4})_ccc_zh\.pdf$",
)
ENTRY_PATTERN = re.compile(r"(?m)^(?P<number>\d{1,4})\.\s*")
CJK_PATTERN = r"\u3400-\u4dbf\u4e00-\u9fff"
CATECHISM_DAY_COUNT = 365
BOUNDARY_CANDIDATE_RADIUS = 36

# These entries repair source-PDF defects verified against the rendered pages.
# Paragraph 1725 is absent from the newer PDF but present in the Vatican source's
# earlier text-layer edition. PDF 38 has two visually correct pages whose embedded
# font maps to unreadable Unicode during extraction.
ENTRY_OVERRIDES: dict[int, str] = {
    1725: (
        "真福是重申並完成天主自亞巴郎以來所作過的多項許諾，使其導向天國，"
        "這正好回應天主安放在人心內對幸福的渴求。"
    ),
    2266: (
        "相應於捍衛公益的責任，國家致力令那些危害人權和基本民法的舉動，"
        "不得擴散。合法的掌權當局有權利和義務按罪行的嚴重性而施予懲罰。"
        "懲罰的首要目的是補償因罪行而引起的紛亂。當懲罰為罪犯自願接受時，"
        "就有贖罪的價值。其次，除了捍衛公共秩序和保障人身安全外，懲罰有"
        "治療的效果價值，在可能的範圍內，有助於罪犯的改過遷善。"
    ),
    2267: (
        "長久以來，合法當局在完成了合法程序後便訴諸死刑，這被認為是一種對"
        "某些罪行的嚴重性作出恰當的回應，是可接受的手段，即使方法極端，卻"
        "使公益受到保護。\n\n"
        "今天，人們越來越強烈地意識到，即使犯了極嚴重罪行的人也不該失去他"
        "的人性尊嚴。此外，已經出現一種對國家刑罰意識的新理解。總之，迄今"
        "已經發展出更有效的監禁系統，以保障公民受到應有的保護，但同時也不"
        "能斷然拒絕給罪犯自新的機會。\n\n"
        "因此，教會依照《福音》的教導，表明「死刑是不能接受的，因為它殘害"
        "人的不可侵犯性和尊嚴」，同時決心致力於在全世界廢除死刑。"
    ),
    2268: (
        "第五誡禁止直接和蓄意的殺人，視之為嚴重的罪行。殺人者以及那些自願"
        "的同謀殺人者，都犯了觸怒天譴的罪行。\n\n"
        "殺害嬰兒、兄弟、父母和配偶是特別嚴重的罪行，由於這些罪行破壞人性"
        "親情自然的聯繫。為了優生和公共衛生，即使是出於政府的命令，也不能"
        "使任何謀殺成為正當的。"
    ),
    2269: (
        "第五誡禁止，對意圖間接地引起一個人的死亡而袖手不管。道德律亦禁止，"
        "在無重大理由下，讓某人暴露於致命的危險中，以及拒絕對處在危險中的"
        "人伸出援手。\n\n"
        "人類社會坐視造成大量死亡的飢荒，而不設法加以補救，是可恥的不義和"
        "嚴重的過錯。高利貸者和唯利是圖者的不正當交易，在人類大家庭中給兄弟"
        "手足造成饑饉和死亡，罪同間接謀殺。這類人確實難辭其咎。\n\n"
        "意外殺人，在倫理上，不能歸咎於當事人。但若無相當的理由，當事人雖"
        "無殺人意圖，但由於採取了足以致人於死的行動，他不能沒有嚴重的過錯。"
    ),
    2270: (
        "人的生命，自受孕的開始，就應該絕對地受到尊重和保護。人自開始存在"
        "的一刻，作為一個人的所有權利就應該受到承認，無辜者對生命的不可侵犯"
        "的權利，便是其中之一。\n\n"
        "我還沒有在母腹內形成你以前，我已認識了你；在你還沒有出離母胎以前，"
        "我已祝聖了你（耶 1:5）。\n\n"
        "我何時在暗中構形，我何時在母胎造成，我的骨骸祢全知情（詠 139:15）。"
    ),
    2392: "「愛是每一個人基本的和天賦的召叫」。",
    2393: (
        "在創造男人和女人的時候，天主給予男女彼此平等的位格尊嚴。每人應"
        "承認並接納自己的性別。"
    ),
    2394: (
        "基督是貞潔的模範。每一個領過洗的人，都被召叫，按照自己的生活方式，"
        "度貞潔的生活。"
    ),
    2395: "貞潔意指性在人位格上的整合。貞潔要求自我控制的練習。",
    2396: "手淫、行淫、色情產品及同性戀行為，都是嚴重違反貞潔的罪。",
    2397: (
        "夫妻自由所締結的盟約，包括忠實的愛。這盟約要求他們堅守婚姻的不可"
        "拆散性。"
    ),
    2398: (
        "生育是婚姻的好事、恩賜和目的。夫妻傳衍生命，就是分享天主的父性。"
    ),
    2399: (
        "調節生育表現負責的生育計畫中的一點。夫妻的意向雖是正當的，但不可"
        "用不道德的方法（比如：直接絕育或人工避孕）。"
    ),
    2400: "通姦及離婚、多妻及自由結合，都嚴重地違反婚姻的尊嚴。",
}


def normalize_source_text(text: str, source_name: str) -> str:
    normalized = (
        text.replace("\u00a0", " ")
        .replace("\u200b", "")
        .replace("\ufeff", "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
    )

    if source_name == "43_2759-2865_ccc_zh.pdf":
        normalized = re.sub(r"(?m)^\s*3835\.", "2835.", normalized)

    # Repair entry numbers split by PDF line wrapping, such as "72\n2.".
    flexible_line_marker = re.compile(
        r"(?m)^[ \t]*(?P<number>\d(?:[ \t\n]*\d){0,3})[ \t\n]*\.[ \t]*",
    )

    def join_marker(match: re.Match[str]) -> str:
        digits = re.sub(r"\s", "", match.group("number"))
        return f"{digits}. "

    return flexible_line_marker.sub(join_marker, normalized)


def ensure_entry_markers(text: str, start: int, end: int) -> str:
    normalized = text

    # A few source entries omit the period after their number.
    missing_period_pattern = re.compile(r"(?m)^[ \t]*(\d{3,4})[ \t]+(?=\S)")

    def add_missing_period(match: re.Match[str]) -> str:
        number = int(match.group(1))
        return f"{number}. " if start <= number <= end else match.group(0)

    normalized = missing_period_pattern.sub(add_missing_period, normalized)

    # Some entry markers are appended to the previous line. Move them to a new line.
    for number in range(start, end + 1):
        if re.search(rf"(?m)^{number}\.\s*", normalized):
            continue

        inline_marker = re.compile(rf"(?<!\d){number}\s*\.\s*")
        match = inline_marker.search(normalized)

        if match:
            normalized = (
                normalized[: match.start()]
                + f"\n{number}. "
                + normalized[match.end() :]
            )

    return normalized


def is_heading_block(block: str) -> bool:
    compact = re.sub(r"\s+", "", block)

    if not compact:
        return True

    if compact.startswith("<續") or compact in {"全文結束", "撮要"}:
        return True

    if (
        len(compact) <= 60
        and re.match(
            r"^第[一二三四五六七八九十]+[卷部分章節條]",
            compact,
        )
        and not re.search(r"[。！？；：」』）》]$", compact)
    ):
        return True

    if (
        len(compact) <= 60
        and re.match(
            r"^[一二三四五六七八九十]+、",
            compact,
        )
        and not re.search(r"[。！？；：」』）》]$", compact)
    ):
        return True

    return (
        len(compact) <= 30
        and not re.search(r"[。！？；：」』）》]$", compact)
        and not re.match(r"^[「『《]", compact)
    )


def normalize_inline_spacing(text: str) -> str:
    normalized = re.sub(r"[ \t]+", " ", text)
    normalized = re.sub(rf"(?<=[{CJK_PATTERN}]) (?=[{CJK_PATTERN}])", "", normalized)
    normalized = re.sub(r" +([，。；：！？）》」』])", r"\1", normalized)
    normalized = re.sub(r"([（《「『]) +", r"\1", normalized)
    return normalized.strip()


def clean_entry_text(text: str) -> str:
    cleaned = re.sub(r"<續\s*\d+\s*條>", "", text)
    cleaned = cleaned.replace("全文結束", "")
    blocks = [
        block.strip()
        for block in re.split(r"\n[ \t]*\n+", cleaned)
        if block.strip()
    ]

    while blocks and is_heading_block(blocks[-1]):
        blocks.pop()

    normalized_blocks = []

    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        normalized_blocks.append(normalize_inline_spacing(" ".join(lines)))

    return "\n\n".join(block for block in normalized_blocks if block)


def extract_entries(
    text: str,
    start: int,
    end: int,
) -> list[dict[str, int | str]]:
    matches = [
        match
        for match in ENTRY_PATTERN.finditer(text)
        if start <= int(match.group("number")) <= end
    ]
    entries: dict[int, str] = {}

    for index, match in enumerate(matches):
        number = int(match.group("number"))
        content_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        entries[number] = clean_entry_text(text[match.end() : content_end])

    for number, override in ENTRY_OVERRIDES.items():
        if start <= number <= end:
            entries[number] = override

    missing = [number for number in range(start, end + 1) if number not in entries]

    if missing:
        raise ValueError(f"Missing entries {missing} in range {start}-{end}")

    empty = [number for number, entry_text in entries.items() if not entry_text]

    if empty:
        raise ValueError(f"Empty entries {empty} in range {start}-{end}")

    return [
        {"number": number, "text": entries[number]}
        for number in range(start, end + 1)
    ]


def convert_pdf(path: Path) -> dict[str, object]:
    name_match = SOURCE_NAME_PATTERN.match(path.name)

    if not name_match:
        raise ValueError(f"Unexpected catechism PDF filename: {path.name}")

    source_id = int(name_match.group("id"))
    start = int(name_match.group("start"))
    end = int(name_match.group("end"))
    reader = PdfReader(path)
    page_texts = [page.extract_text() or "" for page in reader.pages]
    source_text = normalize_source_text("\n".join(page_texts), path.name)
    source_text = ensure_entry_markers(source_text, start, end)
    entries = extract_entries(source_text, start, end)

    return {
        "id": source_id,
        "title": "天主教教理",
        "language": "zh-Hant",
        "sourceFile": path.name,
        "range": {"start": start, "end": end},
        "pageCount": len(reader.pages),
        "entryCount": len(entries),
        "entries": entries,
    }


def count_reading_characters(text: str) -> int:
    return len(re.sub(r"\s+", "", text))


def build_reading_plan(
    entries: list[dict[str, int | str]],
    day_count: int = CATECHISM_DAY_COUNT,
) -> dict[str, object]:
    if len(entries) < day_count:
        raise ValueError("Each Catechism day must contain at least one entry")

    weights = [
        count_reading_characters(str(entry["text"]))
        for entry in entries
    ]
    prefix_character_counts = [0]

    for weight in weights:
        prefix_character_counts.append(
            prefix_character_counts[-1] + weight,
        )

    total_character_count = prefix_character_counts[-1]
    entry_count = len(entries)
    candidates: dict[int, list[int]] = {
        0: [0],
        day_count: [entry_count],
    }

    # Each candidate boundary is kept near its ideal cumulative character count.
    # Dynamic programming then chooses the sequence with the smallest total
    # squared deviation while preserving CCC order and non-empty days.
    for day in range(1, day_count):
        ideal_numerator = day * total_character_count
        ideal_character_count = ideal_numerator / day_count
        insertion_index = bisect_left(
            prefix_character_counts,
            ideal_character_count,
        )
        search_start = max(day, insertion_index - 2)
        search_end = min(
            entry_count - (day_count - day),
            insertion_index + 2,
        )
        center = min(
            range(search_start, search_end + 1),
            key=lambda index: abs(
                prefix_character_counts[index] * day_count
                - ideal_numerator
            ),
        )
        candidates[day] = list(
            range(
                max(day, center - BOUNDARY_CANDIDATE_RADIUS),
                min(
                    entry_count - (day_count - day),
                    center + BOUNDARY_CANDIDATE_RADIUS,
                )
                + 1,
            ),
        )

    previous_costs = {0: 0}
    parents: list[dict[int, int]] = [{}]

    for day in range(1, day_count + 1):
        current_costs: dict[int, int] = {}
        current_parents: dict[int, int] = {}

        for end_index in candidates[day]:
            best: tuple[int, int] | None = None

            for start_index, previous_cost in previous_costs.items():
                if start_index >= end_index:
                    continue

                character_count = (
                    prefix_character_counts[end_index]
                    - prefix_character_counts[start_index]
                )
                scaled_deviation = (
                    character_count * day_count - total_character_count
                )
                candidate = (
                    previous_cost + scaled_deviation**2,
                    start_index,
                )

                if best is None or candidate < best:
                    best = candidate

            if best is not None:
                current_costs[end_index] = best[0]
                current_parents[end_index] = best[1]

        if not current_costs:
            raise ValueError(f"Unable to balance Catechism day {day}")

        previous_costs = current_costs
        parents.append(current_parents)

    boundaries = [entry_count]
    boundary = entry_count

    for day in range(day_count, 0, -1):
        boundary = parents[day][boundary]
        boundaries.append(boundary)

    boundaries.reverse()
    days = []

    for day_index in range(day_count):
        start_index = boundaries[day_index]
        end_index = boundaries[day_index + 1]
        start_number = int(entries[start_index]["number"])
        end_number = int(entries[end_index - 1]["number"])
        character_count = (
            prefix_character_counts[end_index]
            - prefix_character_counts[start_index]
        )
        days.append(
            {
                "day": day_index + 1,
                "startNumber": start_number,
                "endNumber": end_number,
                "entryCount": end_index - start_index,
                "characterCount": character_count,
            },
        )

    daily_character_counts = [
        int(day["characterCount"])
        for day in days
    ]

    return {
        "title": "天主教教理 365 天閱讀計劃",
        "language": "zh-Hant",
        "dayCount": day_count,
        "entryCount": entry_count,
        "totalCharacterCount": total_character_count,
        "averageCharacterCount": round(
            total_character_count / day_count,
            2,
        ),
        "minimumCharacterCount": min(daily_character_counts),
        "maximumCharacterCount": max(daily_character_counts),
        "countingMethod": "Characters excluding whitespace; entries are never split.",
        "days": days,
    }


def main() -> None:
    pdf_paths = sorted(PDF_DIR.glob("*.pdf"))

    if not pdf_paths:
        raise FileNotFoundError(f"No PDF files found in {PDF_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    documents = [convert_pdf(path) for path in pdf_paths]
    all_entries = [
        entry
        for document in documents
        for entry in document["entries"]  # type: ignore[index]
    ]
    numbers = [entry["number"] for entry in all_entries]
    expected_numbers = list(range(1, 2866))

    if numbers != expected_numbers:
        raise ValueError("Converted entries are not a continuous 1-2865 sequence")

    for document in documents:
        output_path = OUTPUT_DIR / Path(str(document["sourceFile"])).with_suffix(
            ".json",
        ).name
        output_path.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    index_payload = {
        "title": "天主教教理",
        "language": "zh-Hant",
        "entryCount": len(all_entries),
        "sources": [
            {
                key: document[key]
                for key in (
                    "id",
                    "sourceFile",
                    "range",
                    "pageCount",
                    "entryCount",
                )
            }
            for document in documents
        ],
        "entries": all_entries,
    }
    (OUTPUT_DIR / "index.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    reading_plan = build_reading_plan(all_entries)
    (OUTPUT_DIR / "reading-plan.json").write_text(
        json.dumps(reading_plan, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Converted {len(documents)} PDFs into {OUTPUT_DIR} "
        f"with {len(all_entries)} continuous entries across "
        f"{reading_plan['dayCount']} balanced days "
        f"({reading_plan['minimumCharacterCount']}-"
        f"{reading_plan['maximumCharacterCount']} characters/day).",
    )


if __name__ == "__main__":
    main()
