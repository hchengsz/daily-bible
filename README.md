# Copyright Notice / 版权声明

English: This is a small personal project made for fun and learning. There is no intention to infringe any copyright or other rights. If anything is inappropriate, please contact haochengcs@gmail.com and I will remove the file(s) or folder(s) that violate copyright.

中文：这是一个个人做着玩和学习用的小项目，无意侵犯任何版权或其他权利。如有不妥，请联系 haochengcs@gmail.com，我会撤下违反版权的 file 或 folder。

# Daily Bible

Daily Bible is a mobile-first Expo app for building a steady daily rhythm of Scripture reading, assisted English study, text-to-speech listening, and catechism formation.

中文：Daily Bible 是一款每日灵修应用，把读经、英文学习、朗读和教理问答放在同一个清晰流程里。

## Preview

### Today Checklist

The Today tab gives each day a simple shape: finish the daily Bible reading, finish the catechism question, and come back tomorrow. Completed items are highlighted in green, and the same screen includes a quick light/dark mode switch.

中文：首页展示当天待读事项，包括每日读经和教理学习，并同步显示完成状态。

| Light mode | Dark mode |
| --- | --- |
| <img src="screenshots/today-list-light.png" alt="Today checklist in light mode" width="250" /> | <img src="screenshots/today-list-dark.png" alt="Today checklist in dark mode" width="250" /> |

### Daily Reading

The Reading tab follows a date-based reading plan. Each day includes a title, references, and Scripture passages. The top toolbar lets readers move between available dates, request Chinese translation, analyze vocabulary, and start audio playback.

中文：读经页按照日期展示每日经文，可以切换日期、翻译、学习词汇，也可以朗读经文。

| English Scripture | Chinese translation |
| --- | --- |
| <img src="screenshots/reading-english-scripture.png" alt="English Scripture reading view" width="250" /> | <img src="screenshots/reading-chinese-translation.png" alt="Chinese translation reading view" width="250" /> |

### Vocabulary Study

The study mode uses Gemini to identify difficult English words, idioms, and contextual phrases, then adds concise Simplified Chinese explanations directly inside the English passage. This keeps the learning aid close to the verse instead of sending readers to another app.

中文：学习模式会把英文难词和短语标注在原文中，并给出简洁中文释义。

<img src="screenshots/reading-vocabulary-annotations.png" alt="English Scripture with inline Chinese vocabulary annotations" width="250" />

### Audio Reading

The reading screen includes a floating audio player powered by `expo-speech`. It supports pause/resume, previous and next passage controls, and adjustable reading speed.

中文：朗读浮层支持暂停、前后跳段和语速调整，方便边听边读。

<img src="screenshots/reading-audio-player.png" alt="Reading aloud player with speed controls" width="250" />

### Completion Flow

At the bottom of a reading, the user can mark the day complete. The app saves progress locally, updates the Today checklist, and shows a lightweight celebration state when the task is done.

中文：完成读经后会保存本地进度，并用绿色状态和庆祝动画反馈当天已完成。

| Complete action | Completion state |
| --- | --- |
| <img src="screenshots/reading-complete-action.png" alt="Mark this reading complete button" width="250" /> | <img src="screenshots/reading-completion-celebration.png" alt="Reading completion celebration state" width="250" /> |

### Catechism Formation

The Catechism tab presents a balanced daily section from the Simplified Chinese Catechism of the Catholic Church. Its date navigation, collapsible header, reading width, and completion flow mirror the Reading tab.

中文：教理页每天展示按字数均衡分配的简体中文《天主教教理》，并采用与 Reading 一致的日期导航和阅读布局。

| Catechism reading | Completed catechism |
| --- | --- |
| <img src="screenshots/catechism-question-detail.png" alt="Catechism reading detail" width="250" /> | <img src="screenshots/catechism-completed-state.png" alt="Completed catechism state" width="250" /> |

## Features

- Successful AI passage and sentence translations are saved on-device. Tap translation again after reopening the app to reuse saved text offline, without an API key or another AI request. Only missing source passages are sent for translation; changing the source or translation scope avoids reusing unrelated text. Failed responses are never cached. Uninstalling the app or clearing its data removes these local translations. Storage failures keep generated text in memory and show a warning; reopening the translation retries saving. Tests: `node --test scripts/test-translation-cache.cjs`.

- First-launch choice of Catholic or Protestant reading tradition, editable in the Today screen's 信仰与阅读设置. Catholic readers retain the existing catechism plan; Protestant readers receive the offline English Westminster Confession (33 chapters, 172 sections), one section per day on a repeating annual plan. Bible content is currently shared. Each tradition has separate formation-reading completion records.
- The status bar follows the in-app appearance setting: white time and system icons in night mode, dark icons in day mode.

Westminster text provenance and scheduling details: [source notes](src/data/WESTMINSTER-SOURCE.md). Run `node --test scripts/test-tradition.cjs` to check preference persistence, failure recovery, progress separation and content coverage.

- Daily checklist for Scripture and catechism tasks. 中文：每日读经和教理任务清单。
- Date-based Bible reading plan with section titles and Scripture references. 中文：按日期组织的读经计划。
- Built-in English Scripture text and lookup helpers. 中文：内置英文圣经文本。
- AI Chinese translation through Gemini. 中文：通过 Gemini 生成中文译文。
- Gemini-powered vocabulary annotations for Chinese-speaking English Bible readers. 中文：Gemini 辅助英文难词中文注释。
- Text-to-speech playback with passage navigation and speed controls. 中文：支持朗读、跳段和语速调整。
- Local progress storage for completed daily tasks. 中文：本地保存每日完成进度。
- A balanced 365-day Simplified Chinese Catechism plan covering CCC 1-2865 in order. Short entries are grouped together so each day has a similar reading length. 中文：将 2865 条简体中文《天主教教理》按字数均衡分配到 365 天。
- Light and dark reading modes. 中文：支持浅色和深色模式。

## Tech Stack

- Expo SDK 57 (`expo` `^57.0.26`; use the matching [versioned documentation](https://docs.expo.dev/versions/v57.0.0/))
- React 19.2.3
- React Native 0.86.3
- Expo Router
- Zustand
- Expo Speech
- Expo SQLite
- Gemini API
- Undici for server-side proxy support

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Start Expo:

```bash
npm run start
```

If your network requires a local proxy or VPN proxy for Google/Gemini services, set `DEV_PROXY_URL` in `.env` and start with:

```bash
npm run start:proxy
```

Run checks:

```bash
npm run lint
npx tsc --noEmit
```

## Environment Variables

### Personal API keys

Open **API 设置 · 翻译与 AI** on the Today screen and enter a Gemini API key for AI translation and vocabulary analysis. Save applies the setting; Gemini validates the key on the first request. Clear the field and save to remove the personal key.

Native apps store keys with Expo SecureStore. Web keeps them in memory until refresh. Requests pass the relevant key through the app backend to the provider, bypassing the shared response cache. Personal keys take precedence over server environment keys and enable their service even when `EXPO_PUBLIC_AI_FEATURES_ENABLED=false`; without personal keys, existing server configuration still applies. Native releases need a new build for SecureStore and Expo UI, and the backend must be updated to accept the key headers. Production API origins must use HTTPS.

Run `node --test scripts/test-api-keys.cjs` for mocked credential routing, cache isolation, and storage failure tests (no paid API calls).

AI translation and vocabulary analysis require a Gemini API credential. The core reading, catechism, and progress features can still run without this key, but AI features will show configuration errors until it is set.

中文：翻译和词汇分析需要外部 API Key；基础读经、教理和进度功能不依赖这些 Key。

```env
EXPO_PUBLIC_API_ORIGIN=
DEV_PROXY_URL=
GEMINI_API_KEY=
GEMINI_VOCAB_MODEL=gemini-3.5-flash
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/interactions
```

## Project Structure

- `app/`: Expo Router routes and API routes.
- `app/(tabs)/`: Today, Reading, and Catechism tabs.
- `app/api/ai-translate+api.ts`: Gemini AI translation route.
- `app/api/vocabulary+api.ts`: Gemini vocabulary analysis route.
- `src/features/home/`: Today checklist experience.
- `src/features/reading/`: Daily reading screen, date plan logic, translation, vocabulary, and audio playback.
- `src/features/catechism/`: Daily Catechism reader and date mapping.
- `src/features/progress/`: Local completion state and celebration overlay.
- `src/data/bible/`: Bible text and lookup utilities.
- `src/data/reading-plan/`: Daily reading plan JSON files.
- `src/data/catechism-source/`: Simplified Chinese JSON converted from the 43 source Catechism PDFs, plus the generated balanced 365-day reading plan. The original PDFs are intentionally not kept in the repo.
- `screenshots/`: README screenshots with descriptive filenames.
