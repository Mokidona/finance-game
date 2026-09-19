# Budget Mini App

Личный финансовый трекер в формате Telegram Mini App: дневной лимит расходов с
переносом остатков, фиксированные платежи, инсайты и премиум-функции за разовую оплату.

## Архитектура

```
[ Front-End: React 18 + Vite + Tailwind CSS v3 + Framer Motion + Lucide ]
                             │  REST API (JSON, /api/v1)
                             ▼
[ Back-End: FastAPI + Pydantic v2 + SQLAlchemy 2.0 (async) ]
                             │  ORM
                             ▼
[ Database: SQLite3 (WAL mode) ]
```

## Структура

```
backend/
  app/
    main.py          # FastAPI, CORS, роутеры
    database.py      # async engine + WAL, создание таблиц
    models.py        # users, fixed_expenses, transactions, day_balances
    schemas.py       # Pydantic v2 схемы
    deps.py          # DI: сессия БД, текущий пользователь (авторизация Telegram initData)
    telegram_auth.py # проверка HMAC-подписи initData от Telegram Mini App
    create_user.py   # (легаси) разовое создание пользователя вручную — обычно не нужен
    services/budget.py  # формулы лимитов, переносы, инсайты, аналитика
    routers/         # dashboard, transactions, fixed-expenses, analytics, profile, paywall
frontend/
  src/
    api/client.js    # REST-клиент
    context/AppContext.jsx
    components/      # layout, ui, dashboard, expenses, paywall
    pages/           # Dashboard, Analytics, FixedExpenses, Profile
```

## Ключевые формулы

- `Free_Money = monthly_income − fixed_expenses_total`
- `daily_limit = Free_Money / дней в текущем месяце` (округление вниз)
- `L_today = daily_limit + carried_over − spent_today`
- Перенос: остаток дня (или минус) переносится на следующий день по цепочке `day_balances`.

## Запуск

Требования: Python 3.11+, Node.js 18+.

### Бэкенд

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --port 8000   # из папки backend/
```

База (`backend/budget.db`) создаётся пустой — демо-данных больше нет. Пользователь
заводится автоматически при первом запросе из Telegram Mini App: фронт при каждом
запросе отправляет подписанный `initData` (заголовок `X-Telegram-Init-Data`), бэкенд
проверяет HMAC-подпись по `BOT_TOKEN` и находит/создаёт запись пользователя. У каждого
заходящего — свои расходы, лимиты и премиум.

Для локальной разработки вне Telegram есть легаси-скрипт:

```bash
python -m app.create_user --name "Имя" --income 250000   # из папки backend/, опционально
```

### Фронтенд

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, /api проксируется на :8000
```

### Проверка

- Swagger UI: http://localhost:8000/docs
- `GET /api/health` — healthcheck

## API

| Метод | Путь | Описание |
| --- | --- | --- |
| GET | `/api/v1/dashboard` | Данные главного экрана (лимит, инсайты, траты дня) |
| GET/POST | `/api/v1/transactions` | Список / добавление расходов |
| DELETE | `/api/v1/transactions/{id}` | Удаление расхода |
| GET/POST | `/api/v1/fixed-expenses` | Фиксированные платежи |
| PATCH/DELETE | `/api/v1/fixed-expenses/{id}` | Изменение / удаление |
| GET | `/api/v1/analytics` | Серия по дням, категории, прогноз (премиум) |
| GET/PATCH | `/api/v1/profile` | Профиль: доход, валюта |
| POST | `/api/v1/paywall/unlock` | Разовая оплата (MVP-заглушка) |

## Премиум (пейволл)

Экраны «Аналитика» и «Фиксированные расходы» закрыты пейволлом — разовая оплата через
**Telegram Stars (XTR)**. Флоу:

1. Фронт: `POST /api/v1/paywall/unlock` → бэкенд через Bot API (`createInvoiceLink`)
   возвращает ссылку на инвойс.
2. Фронт: `WebApp.openInvoice(invoiceLink)` — нативный попап оплаты Telegram.
3. Telegram шлет `successful_payment` (XTR) на вебхук `POST /api/v1/paywall/webhook`
   → бэкенд ставит `has_paid_access = true` (поставщик `telegram_stars`).

Вебхук регистрируется сам при старте (`setWebhook` с `secret_token`), если заданы
`BOT_TOKEN` + `WEBHOOK_SECRET` + `PUBLIC_DOMAIN`. Цена в звездах — `PREMIUM_STARS_PRICE`
в `.env`. Kaspi/ЮKassa пока не подключены (заглушки в `paywall.py`).

---

# 7. REFINED APPLE IOS UI SPECIFICATION (OVERRIDE)

### 7.1 Apple System Color Tokens
- Background Base: `#0A0A0C`
- Card Layer: `rgba(255, 255, 255, 0.04)`
- Card Border: `1px solid rgba(255, 255, 255, 0.08)`
- Primary Accent (Apple Green): `#34C759`
- Primary Accent Active/Glow: `rgba(52, 199, 89, 0.25)`
- System Label Primary: `#FFFFFF`
- System Label Secondary: `#8E8E93`
- System Label Tertiary: `#48484A`

### 7.2 Component Styling Rules
1. **Buttons:**
   - Primary CTA: `bg-[#34C759] text-[#000000] font-semibold text-base h-13 rounded-2xl active:scale-[0.97] transition-all`
   - Secondary Glass: `bg-white/10 text-white border border-white/10 h-12 rounded-2xl active:bg-white/15`

2. **iOS Segmented Control (Currency Picker):**
   - Container: `bg-white/[0.06] p-1 rounded-xl flex gap-1`
   - Active Item: `bg-white/20 text-white font-medium rounded-lg shadow-sm transition-all`
   - Inactive Item: `text-[#8E8E93] hover:text-white`

3. **Typography & Layout:**
   - Use `SF Pro Display` / `Inter` with strict negative space (`tracking-tight` for numbers, `tracking-wider` for micro-labels).
   - Icons must always use `strokeWidth={1.5}` from `lucide-react`.

> Реализация: токены в `frontend/tailwind.config.js` и `frontend/src/components/ui/surfaces.js`;
> глобальный `strokeWidth` задается через `LucideProvider` в `frontend/src/main.jsx`.

---

# 8. ULTRA-MINIMALISM & DARK MONOCHROME SPECIFICATION

### 8.1 Visual De-cluttering Rules (Strict)
1. **Zero-Card Layout for Hero Sections:**
   - Remove heavy background cards around primary metrics. Key numbers (e.g., Main Limit `5 367 KZT`) must sit directly on the OLED black canvas (`#000000`).
2. **Color-as-Status Only:**
   - Default UI state must be strictly monochrome (Black, White, Gray `#8E8E93`).
   - Accent colors (Green `#30D158`, Red `#FF453A`) are RESTRICTED to status indicators, warning bars, or active success states. NEVER use green for neutral icons, tabs, or background cards.
3. **Icon Economy:**
   - Remove repeating icons in list items (e.g., do NOT place a calendar icon on every single row in Fixed Expenses).
   - All icons must use `lucide-react` with `strokeWidth={1.25}` or `strokeWidth={1.5}` in monochromatic gray/white. Remove background icon containers/boxes.

### 8.2 Screen-Specific Layout Simplification

#### Dashboard Screen:
- Replace the 3 stacked insight cards with a single-line horizontal status ticker or a single glass card.
- CTA Button: Translucent glass pill (`bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-full h-12`).

#### Analytics Screen:
- Merge the 4 top metrics boxes into a single grouped row without individual borders.
- Histogram Chart: All normal bars MUST be muted gray (`rgba(255, 255, 255, 0.12)`). ONLY limit-exceeded bars should be colored Red (`#FF453A`).

#### Fixed Expenses Screen:
- Render items as a native iOS Grouped Inset List: single parent container (`bg-white/[0.03] border border-white/10 rounded-2xl`), items separated by `border-b border-white/5`.
- Remove left-side calendar icons from each row.

#### Bottom Navigation Bar:
- Active Tab: `#FFFFFF` (Solid White).
- Inactive Tab: `#636366` (Muted Gray).
- Remove green text, green icons, and yellow/green selection borders from navigation tabs.

> Реализовано: zero-card hero, свайпер-заменитель — строка-тикер, стеклянная pill-кнопка CTA,
> merged-виджет аналитики, монохромный график с красными over-limit днями, grouped inset list
> без иконок в строках, монохромный таббар (актив — белый), сохранение дохода по onBlur.

# 9. APPLE "WOW-FACTOR" & GLASSMORPHISM DESIGN SPECIFICATION

### 9.1 Light Engine & Atmospheric Glow
1. **Hero Metric Ambient Glow:**
   - Behind the main limit counter (`7 867 KZT`), add an absolute positioned blurred radial gradient:
     `background: radial-gradient(circle, rgba(48,209,88,0.15) 0%, rgba(0,0,0,0) 70%)`
   - Apply `filter: blur(40px)` to create a subtle status-driven backlight behind the digits.
2. **Apple Glass Bevel Effect (Card Depth):**
   - All grouped containers must use translucent glass layers:
     - `background: rgba(255, 255, 255, 0.03)`
     - `backdrop-filter: blur(20px)`
     - `border-top: 1px solid rgba(255, 255, 255, 0.18)` (Top light reflection)
     - `border-bottom: 1px solid rgba(255, 255, 255, 0.03)`
     - `border-left/right: 1px solid rgba(255, 255, 255, 0.08)`
     - `border-radius: 24px` (iOS Squircle)

### 9.2 Hero Typography & Primary CTA Styling
1. **Hero Digit Styling:**
   - Text color: Gradient from `#FFFFFF` to `#C7C7CC` (`bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent`).
   - Font: Inter / SF Pro Display, `font-bold`, `tracking-tight`.
2. **Primary CTA ("+ Внести расход"):**
   - Transform the flat dark pill into a high-contrast premium glass action bar:
     - `background: rgba(255, 255, 255, 0.92)`
     - `color: #000000`
     - `font-weight: 600`
     - `box-shadow: 0px 8px 24px rgba(255, 255, 255, 0.12)`
   - On tap: Framer-motion spring scaling (`whileTap={{ scale: 0.96 }}`) combined with Haptic Light feedback.

### 9.3 Analytics & Charts Polish
1. **Histogram Bar Styling:**
   - Normal state: Muted glass bars (`bg-white/10 hover:bg-white/20`).
   - Limit exceeded bar: Crimson gradient (`from-[#FF453A] to-[#FF9F0A]`) with a red ambient glow (`shadow-[0_0_12px_rgba(255,69,58,0.4)]`).
   - Add spring entrance animation for chart bars (`initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}`).
2. **Empty State Redesign:**
   - Replace generic "Расходов пока нет" with a polished glass empty state:
     - Title: "День чист" (`text-white font-medium`)
     - Subtitle: "Все лимиты сохранены" (`text-neutral-500 text-xs`)

> Реализовано: радиальное статусное свечение за hero-цифрой (blur 40px, краснеет при перерасходе),
> bevel-грани 18/8/5% на всех стеклянных поверхностях (per-side arbitrary borders), градиентные
> hero-цифры white→#C7C7CC, белая CTA-плашка с белым свечением (haptic light, scale 0.96),
> объёмный прогресс-пилл с внутренней тенью, пружинные столбики графика с crimson→amber градиентом
> и красным glow на over-limit дне, стеклянный empty state "День чист / Все лимиты сохранены".

# 10. ADVANCED UX FEATURES & GAMIFICATION (ADDENDUM)

### 10.1 Micro-Interactions & Haptic Map
1. **Streak Counter & Haptic Milestones:**
   - Track consecutive days within the budget limit (`streak_days`).
   - Display a sleek badge on the Dashboard: "5 Days Streak 🔥".
   - Trigger `haptic.notificationOccurred('success')` on app launch if streak increases.
2. **Fast Presets Bar (1-Tap Expense Entry):**
   - Inside the "Add Expense" Bottom Sheet, include 4 quick-selection chips:
     `[ ☕️ Кофе ] [ 🍱 Обед ] [ 🚕 Такси ] [ 🛒 Продукты ]`
   - Tapping a chip pre-fills the category instantly.
3. **iOS Native Swipe Actions:**
   - Enable horizontal swipe-to-delete on expense items (`framer-motion` drag constraints) with a soft red trash background.

### 10.2 Conversion & Value Visualizers
1. **Saved Money Counter (ROI Badge):**
   - Calculate cumulative unspent daily limit sum for the month: `total_saved_kzt`.
   - Render a glowing stat pill on the Analytics screen: "Сэкономлено с приложением: X KZT".
2. **Frosted Paywall Overlays:**
   - For locked features (e.g., 30-day forecast calendar), render actual calculated user data in the background blurred with `backdrop-blur-lg filter brightness-50 pointer-events-none`, with a central Lock Icon + CTA Button "Разблокировать за 990 KZT".

> Реализовано: streak_days и total_saved_kzt считаются бэкендом (GET /dashboard), виджет серии
> + стеклянные бейджи 7/14/30 на дашборде, haptic success при росте серии; кольцо лимита в стиле
> Apple Watch (мятная дуга / пульсирующий коралл с glow при перерасходе); умный статус дня по
> времени и остатку ("Отличный темп", "Вечерняя зона риска", "День закрыт в плюсе. Экономия +N");
> 1-tap пресеты Кофе/Обед/Такси/Продукты с мгновенным POST; калькулятор в bottom sheet
> (haptic light на каждую клавишу, success/error на сохранение); iOS swipe-to-delete на
> транзакциях; ROI-плашка «Сэкономлено с приложением» в профиле; Safe Purchase Detector
> (POST /analytics/safe-purchase, премиум) — на сколько дней сместится запас прочности;
> frosted-пейволл аналитики: реальные данные под blur(6px) brightness(0.45) + замок + CTA.
> Примечание: пресеты заданы константой PRESETS в DashboardPage — вынести в настройки профиля.

# 11. COMPLETE UI REDESIGN & LAYOUT HARMONIZATION

### 11.1 Global Layout & Aesthetic Clean-up
1. **Remove Calculator Elements & Clutter:**
   - Completely remove preset shortcut grids (Coffee/Taxi boxes) and standalone badge counters.
   - Remove disjointed secondary progress bars beneath the hero ring.
2. **Unified Canvas & Spacing System:**
   - Background: Pure AMOLED Black (`#000000`).
   - Unified Padding: `px-5 py-4` across all screens.
   - Max Container Width: Strict standard mobile layout (390px viewport target).

11.2 Screen 1: Dashboard Refactor (Solid iOS Hero Ring)

    Hero Widget Architecture:

        Dynamic SVG Donut Ring (size: 220px, strokeWidth: 8px).

        Ring Gradient: Smooth transition from Apple Emerald (#34C759) to Mint (#30D158). Remaining unspent stroke uses rgba(255, 255, 255, 0.06).

        Ambient Center Blur: Behind digits inside ring, place radial-gradient(rgba(52, 199, 89, 0.12), transparent).

        Centered Metrics Stack:

            Micro Label: "ДОСТУПНО НА СЕГОДНЯ" (text-[11px] font-semibold text-neutral-400 tracking-wider uppercase).

            Hero Value: "6 667" (text-4xl font-bold text-white tracking-tight).

            Currency: "KZT" (text-sm font-medium text-neutral-400).

    Single Status Line:

        Place a simple status line directly under the ring: "Всё под контролем" (text-sm text-neutral-400).

    Primary Action CTA:

        Full-width Floating Glass Pill: h-13 w-full bg-white text-black font-semibold text-base rounded-2xl shadow-[0_8px_20px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all flex items-center justify-center gap-2.

    Insight Banner (Single Unified Card):

        Card style: bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex items-center gap-3.

        Left Icon: Shield or Flame in w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/70.

        Text: "Запас прочности без долгов: 16 дней" (text-sm font-medium text-white/90).

11.3 Screen 2: Analytics Refactor (Cohesive Cards)

    Top Value Section:

        Single Framed Header Card (bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-6):

            Primary Value: "106 667 KZT" (text-3xl font-bold text-[#34C759] tracking-tight).

            Label: "ОСТАЛОСЬ НА МЕСЯЦ" (text-[10px] font-semibold text-neutral-400 tracking-wider uppercase).

            Subtext Row: "Потрачено 93 333 KZT • Ср/день 6 222 KZT" (text-xs text-neutral-400 mt-2 border-t border-white/5 pt-2).

    Chart Aesthetics:

        All standard bars: Neutral dark gray (rgba(255, 255, 255, 0.12)), smooth top rounded corners rounded-t-lg.

        Exceeded limit bar: Solid Crimson Gradient (from-[#FF453A] to-[#FF9F0A]) with soft glow shadow-[0_0_12px_rgba(255,69,58,0.3)].

    Categories Breakdown:

        Unified Inset Group Card: Wrap all categories into one single container instead of loose floating lines.

        Rows separated by sub-pixel borders border-b border-white/5.

11.4 Screen 3 & 4: Fixed Expenses & Profile Clean-up

    Fixed Expenses (Grouped iOS Inset):

        Single container wrapper bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden.

        Expense row: Name on left (text-sm font-medium text-white), Amount + Due Date on right (text-sm text-white font-semibold + text-xs text-neutral-500).

        Right Action: Subtle muted delete cross text-neutral-600 hover:text-red-400.

    Profile (Form Harmonization):

        Combine "Имя", "Месячный доход", and "Валюта" inside a single native Grouped List Layout.

        Remove all loose standalone green buttons and marketing text banners inside the active settings view.

        Paywall CTA section at bottom: Glass card bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-center with button "Активировать Премиум за 990 KZT".

> Реализовано: канвас 390px (контейнер, навбар, модалки, viewport), unified px-5 py-4;
> пресеты/бейджи/полоска под кольцом удалены (StreakWidget/InsightTicker удалены); donut-ринг
> 220px/stroke 8 с SVG-градиентом #34C759→#30D158, треком white/6% и ambient blur в центре;
> статус-строка под кольцом; CTA h-13 rounded-2xl (h-13 добавлен в index.css); единая
> Insight-карта; аналитика: framed header-карта с #34C759 цифрой, бары rounded-t-lg white/12%
> + crimson glow 0.3, категории одним inset-контейнером; фикс. расходы: сумма+дата справа,
> muted delete neutral-600; профиль: имя+доход+валюта+премиум-статус в одном grouped list,
> ROI-баннер удален, внизу glass CTA «Активировать Премиум за 990 KZT».

# 12. UI FIXES, SWIPE ACTIONS & DEBT/FROZEN ASSETS SYSTEM

### 12.1 Elimination of Custom Calculators & Layout Fixes
1. **Remove Custom Numpad Modal (Screen 4 Fix):**
   - Completely delete the custom 3x4 grid numpad.
   - Use native iOS/Android numeric keyboard (`keyboardType="decimal-pad"` / `inputMode="decimal"`).
   - Modal Input View: Focus directly on a single big input element (`text-5xl font-bold text-white autoFocus`). Native keyboard glides up automatically.
   - Quick Category Bar: Fixed horizontal scroll or 4-pill grid placed right above the native keyboard accessory view.
2. **Fix Profile Screen Alignment (Screen 2 Fix):**
   - Section "Безопасная покупка?":
     - Redo layout using `flex-row items-center gap-3`.
     - Input field and button "Проверить" must have matching heights (`h-12`).
     - Button style: `bg-white text-black font-semibold px-5 rounded-xl h-12 flex items-center justify-center shrink-0`.
3. **Return & Elevate "Streak" Counter (Screen 1 Fix):**
   - Embed the streak status directly inside the Hero Status Line or Header to save space.
   - Placement: Top right header badge, or right below the hero ring:
     - `🔥 3 дня в лимите` with active amber accent badge (`bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold`).

12.2 Native Gestures: Swipe-to-Delete (Fixed Expenses)

    List Interaction:

        Remove permanent hardcoded X icons from row items on the right side.

        Implement react-native-gesture-handler / Framer Motion Swipeable items.

    Behavior:

        Swiping a row left reveals a hidden full-height red action button (bg-red-500 flex items-center justify-center w-20 rounded-r-2xl).

        Icon inside red container: Trash bin icon (w-5 h-5 text-white).

        Full swipe (>50% screen width) triggers deletion with a smooth layout contraction collapse (height: 0, opacity: 0).

12.3 Debt & "Frozen Money" System (Замороженные деньги)
Concept & Business Logic:

Lending money is NOT an expense, but it temporarily reduces liquid cash available for daily spending.

    Financial Status Division:

        Доступно на сегодня = (Общий баланс - Фиксированные расходы - Замороженные деньги) / Дней до конца месяца.

        Замороженные деньги (Долги мне): Money locked in receivables.

    Adding a Debt Entry:

        In "Внести расход", add a primary toggle tab: [ Расход | Дал в долг ].

        When "Дал в долг" selected:

            Fields: Сумма, Кому (Имя), Дата возврата (опционально).

            Amount is instantly transferred to "Замороженный баланс".

    UI Dashboard Representation:

        Below the Hero Donut Ring, add a sleek 2-column secondary metric card:

        ┌───────────────────────────┬───────────────────────────┐
        │  🛡 Запас прочности       │  ❄️ Заморожено (Долги)    │
        │  16 дней                  │  15 000 KZT               │
        └───────────────────────────┴───────────────────────────┘

        Tapping "Заморожено" opens a clean sheet listing active debtors:

            «Ержан — 10 000 KZT (до 25 сен)» -> [ Кнопка: Вернул ].

        Tapping "Вернул" adds money back to liquid balance without marking it as new income.

    Smart Reminders:

        Push notifications 1 day before due date: «Ержан должен вернуть 10 000 KZT завтра. Напомнить ему?»

> Реализовано: нумпад удален — большой input (text-5xl bold, autoFocus, inputMode=decimal)
> с нативной клавиатурой; таб [Расход | Дал в долг]; streak-бейдж (amber) под кольцом;
> 2-колоночная карта Запас прочности / Заморожено; шторка должников с кнопкой «Вернул»
> (разморозка без дохода); SwipeableRow (bg-red-500 w-20 rounded-r-2xl, collapse height/opacity
> при свайпе >50%) на транзакциях И фиксированных расходах, хардкодные ✕ убраны; профиль:
> flex-row + h-12 выровненные инпут/кнопка «Проверить» (shrink-0).
> Бэкенд: таблица debts (debtor_name, amount, given_date, due_date, is_returned), формула
> daily_limit = (income - fixed - frozen) / дней в месяце, эндпоинты GET/POST /debts,
> POST /debts/{id}/return, DELETE /debts/{id}, в /dashboard добавлены frozen_total и
> safety_days, инсайт Snowflake о влиянии долгов + напоминание Bell за день до срока.
> Вживую проверено: создание долга заморозило (6166→6066), «Вернул» разморозил (→6400),
> шторка показывает должников, дашборд обновляет «Заморожено».
> Примечание: push-напоминания реализованы как инсайт-строка в дашборде; настоящие push
> через Telegram Bot API — отдельная задача (нужен серверный планировщик).

# 14. AVATAR GAMIFICATION & IMPULSE-CONTROL SYSTEM

### 14.1 Central Avatar Engine (Inside Hero Ring)
1. **Avatar Component Integration:**
   - Render a central character avatar inside the main Dashboard ring (`size: 140px`).
   - The avatar reflects the user's financial status for the day.
2. **Visual States (Strictly Monochrome / No Emoji):**
   - **State 1: Full Shield (`daily_spent == 0`):**
     - Avatar with solid outline, backlighting: `radial-gradient(rgba(52, 209, 88, 0.2), transparent)`.
     - Subtext under avatar: "Щит активен".
   - **State 2: Damaged (`daily_spent > 80%`):**
     - Avatar opacity drops to 0.6, flickering animation (`animate-pulse`).
   - **State 3: Defeated (`daily_spent > 100%`):**
     - Trigger `Glitch` or `Fracture` CSS filter on the avatar.
     - Ring border transforms to solid crimson (`#FF453A`) with heavy Haptic vibration.

### 14.2 Impulse Purchase Barrier (UX Flow)
1. **Expense Classification Toggle:**
   - Inside the Add Expense modal, add a binary selector:
     `[ Обязательный расход ] [ Импульсивная покупка ]`
2. **Impulse Penalty Trigger:**
   - If "Импульсивная покупка" is selected and amount exceeds remaining daily limit:
     - Show confirmation screen: "Внимание: Эта покупка нанесет урон вашему персонажу и сбросит стрейк."
     - Disable immediate submit button for 5 seconds (Cooling-off timer).
     - Primary button: "Отменить и сохранить стрейк" (`bg-white text-black`).
     - Secondary button: "Всё равно потратить" (`text-neutral-500 text-xs mt-2`).

### 14.3 Debt & Frozen Funds Module (Refined)
1. **Frozen Asset Ledger:**
   - Add a separate balance tracker: `Frozen Cash` (Money lent to others).
   - Lent money is excluded from daily spend calculations but deducted from active liquid balance.
2. **Debtor Row Component:**
   - Render active debts in a grouped list with countdown timer ("До возврата: 3 дня").
   - Action: Swipe right to mark as "Возвращено" (triggers animation of funds returning to the Avatar's shield).

> Реализовано: AvatarShield внутри кольца — 3 состояния (Щит активен с mint-свечением /
> Критический уровень энергии с pulse+opacity 0.6 / Щит сломан с CSS-glitch расщеплением
> и красной виньеткой экрана + shake); импульс-барьер: селектор [Обязательный | Импульсивная],
> confirm-экран «Задержка импульса» с 5-секундным таймером (кнопка «Всё равно потратить»
> заблокирована), «Отменить и сохранить стрейк» — белая CTA; Debt-модуль: countdown строки
> («До возврата: 3 дн.» / просрочка красным), свайп ВПРАВО = «Вернул» (mint-зона),
> флеш «+N вернулись на щит». Вживую проверено: импульс 9000 → confirm с таймером →
> сохранение → Щит сломан + glitch + виньетка; риск 84% → pulse + «Критический уровень энергии»;
> возврат долга → флеш и empty state.
> Примечание: «потеря 2 дней прочности» пока визуальный текст подтверждения — бэкенд не
> штрафует safety_days (штраф будет означать ретроактивную правку истории трат).

## 15. AVATAR SKINS, PROGRESSION SYSTEM & PREMIUM FEATURE

### 15.1 Core Character Concept: «Хранитель» (Vault Guardian)
- Векторный монохромный персонаж (Cyberpunk/Neo-Noir) внутри главного кольца: голова,
  лицо с эмоциями, экипировка — виден полностью с первой секунды.
- Эмоции: НОРМА (спокойный взгляд, mint-свечение `#34C759`) / ТРАТЫ > 80% (напряжение,
  капли, янтарное `#FF9F0A`) / КРАХ (кресты-глаза, опущенная голова, glitch, алый `#FF453A`).

### 15.2 Skin Unlock System (Мета-прогресс за стрики)
| Скин | Условие | Эффект |
|---|---|---|
| Кадет | сразу | базовый кибер-костюм |
| Титановый Страж | стрик 7 | броня с неоновыми прожилками |
| Ронин Дисциплины | стрик 30 | шлем-самурай, катаны |
| Архитектор Богатства | стрик 90 | золотой костюм, волновая аура |

### 15.3 Premium: «Кибер-Призрак» и Time Lock
- Скин **Phantom Gold** (премиум): тёмное стекло с золотыми узлами, `phantom-pulse` аура,
  фоновая золотая пыль на дашборде.
- **Time Lock** («Защита от сожалений»): в профиле задается порог опасной покупки
  (`danger_threshold`); импульсная хотелка дороже порога уходит в `pending_transactions`
  на 1 час. Экран паузы: медитирующий Хранитель, отсчет, «84% импульсивных покупок
  отменяются». Подтвердить после часа → обычный расход; отменить → сумма падает в
  `saved_capital` (Сэкономленный Капитал, показан в профиле).
- Эндпоинты: `GET /avatar`, `GET /avatar/skins`, `POST /avatar/skins/equip`,
  `POST/GET /pending-transactions`, `POST /pending-transactions/{id}/confirm|cancel`.
- `POST /transactions` при kind=impulse и amount > danger_threshold возвращает
  `pending_transaction` вместо создания транзакции.

> Реализовано и проверено вживую: гардероб в профиле (замки «Нужен стрик N дней»,
> ПРЕМИУМ-бейдж, equip через API с проверкой блокировки 403), Time Lock: импульс 6 000 >
> порога 5 000 → экран паузы с таймером 00:59:55 → отмена → saved_capital 15 000 → 21 000;
> Phantom Gold надевается только с премиумом; золотая пыль и узлы на дашборде.
> Анимации — CSS/SVG (60 FPS), Rive/Lottie не подключались ради размера бандла.

## 16. DETAILED 2D AVATAR & PROFILE CLEANUP

### 16.1 Bust-portrait «Хранитель» (200×200 SVG)
- Детализированный line-art портрет (стилистика Hades / LoL UI): лицо с бровями,
  миндалевидными глазами и радужкой, хай-тек прическа с прядью набок, микро-чип у виска,
  высокий воротник штормовой куртки с неоновыми прожилками, текстурированные матовые
  наплечники с застежками, молния груди с акцентными строчками.
- 3 эмоции-спрайта: НОРМА (уверенная ухмылка, mint-прожилки на скулах и воротнике) /
  WARNING (прищур, стиснутые зубы, капля пота, царапины брони, янтарный акцент) /
  DEFEATED (разбитый кибер-окуляр с крестом, трещина по скуле, поникший рот, shake+glitch).
- Скины-оверлеи адаптированы под бюст: Титан (плиты брони с неоном), Ронин (шлем-гребень,
  рукояти катан), Архитектор (золотые кольца-аура, кант), Phantom (золотые цепи-узлы).

### 16.2 Dashboard Cleanup
- Убрана дублирующая инсайт-карта под статусом (единственная строка статуса DayStatus +
  две нижние карточки Запас/Заморожено остались). Мертвые компоненты удалены:
  AvatarShield, InsightBanner, MainBalanceHero.
- Аватар в кольце строго 140px, прогресс эмоции считается от БАЗОВОГО лимита
  (progress_percentage с бэкенда) — исправлен баг, при котором вечерние траты ошибочно
  переводили персонажа в DEFEATED из-за тающего текущего лимита.

### 16.3 Profile: три изолированные Inset-карточки
1. **Гардероб Хранителя** — превью аватара 56px, название активного скина, кнопка
   «Сменить скин» (bg-white/10 rounded-xl), открывает полноэкранный гардероб.
2. **Защита от импульсов (Time Lock)** — подзаголовок «Задержка 1 час…», инпут порога
   с суффиксом KZT, 0 — выключить.
3. **Сэкономлено на отмене импульсов** — изумрудный бейдж emerald-500/10 с суммой
   Сэкономленного Капитала (всегда виден, даже 0 KZT).

## 17. ANTHROPOMORPHIC HUMAN CHARACTER (FINAL AVATAR SPEC)

### 17.1 Human Bust Art (Valorant / LoL style)
- «Хранитель» перерисован как полноценный человеческий погрудный портрет: анатомичные
  черты (волевой подбородок, линия челюсти, скулы, переносица, бровные дуги, уши),
  никаких схематичных овалов и гигантских голов.
- Прическа: текстурная объемная масса с затемнением затылка, контрастными прядями,
  выбритым виском и бачком.
- Кибер-татуировка: неоновая ломаная линия под глазом (цвет = статус лимита).
- Одежда: высокий структурированный матовый воротник с прошивкой и заклепкой,
  штормовая куртка с центральными и карманными молниями, плечевые ремни с пряжками,
  LED-индикатор статуса на груди (заполнение зависит от состояния).

### Динамический rim-light
- НОРМА: изумрудный `#34C759` — контур скулы/челюсти, прядь, правое плечо, мягкий bloom.
- WARNING (<20%): янтарный `#FF9F0A` — сведенные брови, прищур, капли пота, стиснутые губы.
- КРАХ: алый `#FF453A` — опущенный взгляд, носогубные складки, микро-трещины,
  glitch-слои (красный + циан), shake + **красная виньетка по краям экрана**
  (radial-gradient оверлей на дашборде).

### Скины поверх человеческой базы
Титан: полу-визор с неоновой линией + плиты; Ронин: гребень + маска на нижней части
лица + катаны; Архитектор: золотые кольца-аура; Phantom: золотые цепи-узлы + пыль.

## 18. PIXEL-ART AVATAR (TAMAGOTCHI STYLE)

### 18.1 Pixel Hero — ретро-персонаж вместо векторного портрета
- Новый `PixelHero`: full-body персонаж на логической сетке **16×24** (рендер CSS-дивами
  в grid — чистый «растр», без SVG-линий). Яркая сочная палитра: рыжие волосы, лицо с
  пиксельными глазами, синяя куртка, джинсы, белые кеды, контурная обводка.

### 18.2 Pixel-состояния (3 анимации)
- **Idle (в лимите)**: 2-frame bounce — персонаж подпрыгивает и машет рукой
  (попеременные спрайты BASE_BODY / WAVE_BODY, steps(2)).
- **Low limit (<20%)**: «тяжело дышит» — scaleY-дыхание steps(2), рот открыт (OOO),
  синяя **капля пота**, падающая над головой.
- **Over limit (крах)**: «Game Over» — пиксельное **надгробие с RIP-крестом** на земле,
  slam-анимация падения сверху (steps(4)), коралловое кольцо + красная виньетка экрана.

### 18.3 Pixel Wardrobe (скины в пиксель-арте)
| Скин | ID | Оверлей |
|---|---|---|
| Pixel Hero (дефолт) | `skin_cadet` | повседневная одежда |
| Кибер-Папа (стрик 7) | `skin_titan_guardian` | черные очки Deal-With-It через лицо |
| Рыцарь (стрик 30) | `skin_ronin` | шлем с плюмажем + горжет-доспех |
| Gold Hero (премиум) | `skin_phantom_gold` | золотая корона с glow + золотая пыль |

## 23. 3D BUST ASSETS (FINAL ARCHITECTURE)

### 23.1 Компонент = чистый загрузчик ассетов
- `MascotAvatar` больше НЕ генерирует персонажа кодом (запрещены SVG-сборка лица,
  Canvas-рисование, составные контейнеры). Компонент только подгружает готовые файлы:
  - `public/assets/mascot/mascot_normal.png` — уверенная улыбка
  - `public/assets/mascot/mascot_warning.png` — задумчивое выражение
  - `public/assets/mascot/mascot_defeated.png` — глаза-дуги, грусть (без крипоты)
- Наличие PNG проверяется автоматически: файл есть → рендерится он; файла нет →
  мягкий fallback на цельные SVG-бюсты (22), чтобы UI не был пустым. Когда дизайнер
  положит PNG — они подхватятся без единой правки кода.
- Аура статуса: emerald/amber/rose 15% radial-gradient под персонажем.
- Кивок на расход (вертикальный боб), истинный crossfade 400ms — сохранены.

### 23.2 Спека ассетов для дизайнера
- PNG/WebP с прозрачностью, 512×512, кроп по грудь, БЕЗ рук.
- Стиль Monzo/Revolut: один персонаж в худи во всех трех файлах, мягкий объемный свет.
- Defeated: приглушенные тона внутри рендера, никаких красных полос на глазах.
- Полное ТЗ: `public/assets/mascot/README.md`.

> Проверено вживую: fallback-бюсты в normal и defeated (перерасход −1 133 KZT),
> ауры и crossfade работают. Гардероб/скины не затронуты.

## 22. BUST-PORTRAIT SPEC (HARD BAN ON CODE-DRAWN LIMBS)

### 22.1 Причина бага «летающих рук»
- Кивок-реакция вращала всю иллюстрацию на ±3° и переигрывалась при каждом remount —
  руки замахивались. Crossfade перезаписывал таймер и старый слой не успевал гаснуть.
- Фиксы анимации: кивок теперь чистый вертикальный боб БЕЗ rotate (таймер глушит после
  проигрывания), crossfade — истинный (старый слой гаснет 400ms через mascot-fade-out,
  новый проявляется mascot-fade-in, слои снимаются по таймеру).

### 22.2 Портретный кроп: конечности удалены физически
- Все три ассета перерисованы как ЕДИНЫЕ бюст-портреты (голова + плечи + верх груди):
  `hero_bust_normal.svg` / `hero_bust_warning.svg` / `hero_bust_defeated.svg`.
- Руки, кисти и предплечья ИСКЛЮЧЕНЫ из арта — анатомические ошибки невозможны
  по построению. Кроп по нижнему краю кадра (Figma/Slack avatar композиция).
- Старые full-body ассеты удалены; компонент рендерит один цельный SVG на состояние,
  без наложения кодовых элементов.
- Defeated: опущенная голова (rotate 10° в самом арте), покатые плечи, глаза-дуги,
  тихая слеза, десатурированная палитра — эстетично, без криповости.

> Проверено вживую на скриншотах: normal-бюст с улыбкой, defeated при перерасходе
> (серый, поникший, без рук). Смена состояний — плавный crossfade без дёрганья.
> Сборка: 3 бюста по ~5 KB.

## 21. PRE-RENDERED ASSETS (NO CODE-DRAWN FACES)

### 21.1 Кодовая отрисовка лица удалена
- Canvas-движок с процедурной мимикой (ctx.arc-глаза, глитч-оверлеи, осколки) полностью
  убран — «uncanny valley» от геометрических примитивов недопустим.
- Вместо этого — три цельные дизайнерские SVG-иллюстрации-состояния:
  `hero_normal.svg` / `hero_warning.svg` / `hero_defeated.svg` (assets/mascot/).
- Компонент только подгружает иллюстрации; поверх не рисуется НИЧЕГО кодом.

### 21.2 Эстетика Defeated (без криповости)
- Персонаж сидит, обняв колени, голова опущена, глаза — мягкие закрытые дуги,
  одна тихая слеза. Никаких повязок/крестов/подтеков.
- Десатурация всего персонажа: `filter: grayscale(0.6)` + приглушенная палитра
  внутри самого арта (не оверлеем).
- Окружение: кольцо бордовое (#FF453A, как и было), фон — мягкое красное
  radial-свечение. Никаких «красных мух/квадратиков».

### 21.3 Реализация
- `MascotAvatar({ status, skinId, size, reactionKey })` — чистая подгрузка ассетов,
  crossfade 400ms между состояниями, кивок-реакция на расход (CSS keyframes,
  re-mount по key).
- Скины — ненавязчивый hue-rotate фильтр (Кадет базовый, Титан зеленый, Ронин сталь,
  Архитектор/Phantom золото). Дизайнер может подменить любой SVG на свой экспорт
  из Figma/Illustrator без правки кода.

> Проверено вживую: NORMAL (улыбка, живой взгляд), WARNING при 95.7% (прищур,
> пот на виске, янтарные акценты), DEFEATED при −2 033 KZT (сидит обняв колени,
> серый, глаза-дуги, бордовое кольцо). Сборка: 326.6 KB JS + 3 SVG (по ~5 KB).

## 20. COMMERCIAL-GRADE CANVAS MASCOT (FINAL)

### 20.1 Вариант Б: Enhanced HTML5 Canvas + процедурные эффекты
- `MascotAvatar` переписан на Canvas 2D рендер (60 FPS, DPR-aware до 2x, совместим
  и с пропсом `status: normal|warning|defeated`, и со старым `emotion`):
  - Многослойный шейдинг: радиальный градиент лица с тенью под челюстью, двухслойные
    волосы с бликами-прядями, худи со складками-затемнением по бокам, молния с зубцами,
    карман-кенгуру, шнуры с наконечниками, кеды.
  - **Rim Light**: пульсирующий неоновый контур по силуэту плеч/шеи (lighter-blend,
    цвет статуса).
  - **Партиклы**: mint-искры с sway (normal), янтарные капли (warning), красные
    вращающиеся осколки (defeated).
  - **Idle-жизнь**: дыхание-синусоида, случайный blink (каждые 2.4–4.6 с), glance
    зрачков (лево/центр/право), покачивание корпуса, машущая правая рука, кивок на
    новый расход (reactionKey).
  - **State Machine**: плавная интерполяция всех параметров мимики ~400ms (eyeOpen,
    брови, плечи, наклон головы, кривая рта, цвет ауры) — никаких мгновенных подмен.
  - **DEFEATED**: разбитый visor-окуляр с трещинами поверх глаз + глитч-слайсы самой
    канвы (drawImage разрывы) с красным screen-tint.
- Скины — палитры худи/волос/акцента: Кадет, Кибер-Папа, Ронин, Архитектор,
  Phantom Gold (алиасы `cadet`/`knight`/`gold` поддержаны).

### 20.2 Контракт компонента (совместим с ТЗ)
`MascotAvatar({ status: 'normal'|'warning'|'defeated', skinId?, size?, reactionKey? })`
— при появлении авторского `.riv`/Lottie-ассета компонент заменяется на
`@rive-app/react-canvas` без изменения мест вызова.

> Проверено вживую на скриншотах всех состояний: NORMAL (шейдинг, искры, машущая
> рука), WARNING при 95.7% (прищур, капля, янтарь), DEFEATED при −2 033 KZT (visor
> с трещинами, глитч, коралловое кольцо). Тестовые траты удалены. Сборка:
> 336.5 KB JS / 24.5 KB CSS.

## 19. SMOOTH VECTOR MASCOT (RIVE-STYLE STATE MACHINE)

### 19.1 Почему не pixel-art / PNG-последовательности
- Растровые спрайты при масштабировании дают суб-пиксельное размытие на OLED,
  покадровые GIF — рваные 4–8 FPS. Заменены на векторную скелетную анимацию
  (framer-motion, нативные 60 FPS, четкость на любой плотности экрана).

### 19.2 MascotAvatar: Duolingo / Alto's Adventure quality
- Flat-векторный маскот с мягкими градиентами (лицо, волосы), румянцем, статусным
  светодиодом на груди и четким силуэтом.
- Эквивалент Rive State Machine на framer-motion (дроп-ин замена на `.riv` — тот же
  API пропсов { emotion, skinId, size, reactionKey }):
  - **Idle**: дыхание (scaleY-синусоида), float по оси Y, машущая рука, пульсирующая
    ambient-аура за головой.
  - **Spending Reaction**: при добавлении расхода — короткий кивок головы (trigger
    reactionKey из формы).
  - **Over-Limit**: плавная интерполяция **400ms** (не мгновенная подмена): глаза
    сужаются (scaleY 1 → 0.25), брови опускаются, плечи drop 5px, рот меняет кривую,
    аура плавно перетекает в красную.
- Скины — палитры тела/волос (Кадет синий, Кибер-Папа зеленый худи, Ронин сталь,
  Архитектор золото, Phantom тёмное золото) + акцент LED и ауры.

### 19.3 Уборка пиксельного наследия
- `PixelHero` и `GuardianAvatar` удалены, пиксельные keyframes вычищены из CSS.

> Проверено вживую на скриншотах: idle-улыбка с машущей рукой, WARNING при 95.7%
> (прищур, янтарный LED), DEFEATED при −2 033 KZT (расстроенный рот, опущенные
> плечи, тёмная аура, коралловое кольцо). Сборка: 329.9 KB JS / 24.5 KB CSS.

> Проверено вживую: NORMAL при 0%, WARNING при 95.7% (стиснутые зубы, янтарь),
> DEFEATED при перерасходе (окуляр, алый glow, коралловое кольцо, «−2 033 KZT»);
> профиль: 3 карточки + изумрудный бейдж 21 000 KZT. Сборка: 333 KB JS / 24.5 KB CSS.

## 24. HD PIXEL-ART MASCOT ENGINE (ФИНАЛ)

### 24.1 Ассеты: эмоции запечены в спрайт

- Отказ от кодовой отрисовки лица полностью. Персонаж — **цельные PNG-спрайты**
  `public/assets/mascot/pixel_hero_{normal,warning,defeated}.png` (256x256,
  логическая сетка 128x128, x2 nearest, RGBA, бюст-кроп без рук).
- Генератор `frontend/scripts/generate_pixel_mascot.py` (Pillow) выступает
  «цифровым художником» на этапе сборки: рисует **все** эмоции прямо в спрайт —
  открытые глаза/прищур/закрытые дуги, брови, улыбку, капли пота, слезу —
  плюс HD-детали: dithering-объём на волосах и щеке, rim light по правому
  краю причёски и плечу, неоновый чип на груди (цвет = статус), шнурки худи
  с неоновыми наконечниками. Рантайм ничего не дорисовывает.
- Палитры: normal (сочные), warning (неон → янтарь), defeated — десатурирование
  к холодному серому прямо в файле (никаких красных крестов и крипоты).
- Замена ассету дизайнером: положить свой PNG с тем же именем — код не меняется.

### 24.2 Pixel Crispness (защита от размытия и дёрганий)

- `image-rendering: pixelated` + `crisp-edges`, рендер-слой `translateZ(0)`.
- Размер в компоненте кратен сетке (128px в кольце, 56px в профиле — шаг 128):
  целочисленный масштаб исключает полупиксельное размытие.
- Idle-«дыхание» и кивок-реакция на расход — `steps()` с целыми пикселями:
  спрайт смещается на 2–3 px без субпиксельного плывуна; вращений нет — руки
  не «летают» (фикс из раздела 22 сохранён).

Проверено вживую: normal (улыбка-дуга, открытые глаза), warning при 95.7%
(веки-тени, сведённые брови, янтарное кольцо, «340 KZT»), defeated при
−1 660 KZT (брови-домиком, слеза, серые тона, «Превышение»). Тестовые траты
удалены. Итоговый бандл: 3 спрайта по ~6 KB.

## 25. PIXEL-ART BUGFIX: HAIR BLUR & ANIMATION JITTER

### 25.1 Джиттер устранён: вся анимация — в кадрах APNG

- Причина дёрганий: CSS-transform на контейнере спрайта (translateY при дыхании
  и кивке) давал полупиксельные смещения на Retina.
- Фикс: микро-движение **запечено в кадры** — `pixel_hero_*_apng.png`
  (idle-петля дыхания: 4 кадра целыми пикселями, 256x256) и
  `pixel_hero_nod_apng.png` (one-shot кивок 5 кадров ~380ms, реакция на
  добавление расхода). На спрайте НОЛЬ CSS-анимаций: компонент только свапает
  `src`; остались лишь opacity-фейды между состояниями.

### 25.2 «Каша» в волосах устранена: канон 128 и чистые полосы

- Причина мыла: 256px PNG рендерился в 140px слот (нецелый масштаб 0.55) —
  браузер интерполировал пиксели.
- Фикс размеров: `snapSize()` — слоты СТРОГО кратны канону 128 (64 через
  точный /2-mip / 128 / 256 / 384). Кольцо — APNG 256 (x2, nearest),
  профиль — 64px mip 1:1. Канонический статик 128 больше никогда не
  даунскейлится.
- Фикс арта: checkerboard-дизеринг убран с тонких деталей (волосы, лицо) —
  бленды теперь чистыми полосами (3px блик / 2px база), которые выживают
  при любом целом масштабе. Дизеринг остался только на широкой груди худи.

Проверено вживую: idle-петля без подёргиваний в кольце 128, nod отыгрывается
при добавлении расхода, профиль 64px — mip без размытия. Тестовый расход
удалён. Ассеты: 3 ститика по ~1.7 KB, 3 APNG по ~5–12 KB, mips по ~0.8 KB.

## 26. TEXTURED HAIR & CANVAS-BASED SPRITE RENDERER

### 26.1 Problem: Monolithic Hair & Choppy Animation

**Hair Issue**: Previous implementation drew hair as a single solid block without individual strands, creating a flat "helmet" appearance.

**Animation Issue**: Only 2-4 frames in APNG resulted in choppy 2-4 FPS animation, lacking smoothness expected in modern games/apps.

### 26.2 Solution: Individual Hair Strands & Multi-Frame Animation

**Textured Hair Rendering**:
- Individual hair strands drawn with proper angles and shading
- Crown strands (15 strands) with light/dark variations
- Side strands (10 strands) with directional flow
- Fringe strands (8 strands) for natural hairline
- Each strand has base color + highlight on alternating pixels

**Multi-Frame Animation**:
- 8 frames per state for smooth idle animation
- Subtle breathing motion (2px vertical movement)
- Blink animation on frame 4
- 12 FPS playback via canvas renderer

**Canvas-Based Renderer** (`SpritePlayer.jsx`):
- Loads all 8 frames for current status
- Plays them in sequence with `requestAnimationFrame`
- `imageSmoothingEnabled = false` for crisp pixels
- Handles status transitions with opacity crossfade

### 26.3 Asset Structure

```
frontend/public/assets/mascot/
├── frames/
│   ├── normal/frame_00.png through frame_07.png (256x256)
│   ├── warning/frame_00.png through frame_07.png (256x256)
│   └── defeated/frame_00.png through frame_07.png (256x256)
├── pixel_hero_normal.png (256x256 static)
├── pixel_hero_warning.png (256x256 static)
└── pixel_hero_defeated.png (256x256 static)
```

### 26.4 Generation

```bash
cd frontend
../.venv/bin/python scripts/generate_pixel_mascot_v2.py
```

Generates:
- 8 frames per state (24 total frames)
- Individual PNG files for reliable canvas playback
- Small mips (64x64) for profile previews

### 26.5 Technical Details

- **Resolution**: 256x256 logical grid (displayed at 128px for 2x crisp scaling)
- **Frame Timing**: 83ms per frame (12 FPS)
- **Hair Rendering**: Individual strands with proper angles and shading
- **Animation**: Breathing (2px vertical) + blinking
- **Canvas**: `requestAnimationFrame` loop with frame indexing

### 26.6 Integration

`MascotAvatar` → `SpritePlayer` → Canvas renderer:
1. Loads all 8 frames for current status
2. Plays them in sequence at 12 FPS
3. Handles status transitions with crossfade
4. Supports size prop for responsive scaling

Verified in production: Smooth 12 FPS idle animation, crisp pixel rendering, textured hair with individual strands.

## 27. FINAL STATE: SIMPLE IMAGE LOADING (NO GENERATORS)

### 27.1 Emergency Block Applied

All canvas/SVG generators have been removed:
- `generate_pixel_mascot.py` - DELETED
- `generate_pixel_mascot_v2.py` - DELETED
- `SpritePlayer.jsx` - DELETED
- `frames/` directory - DELETED

### 27.2 MascotAvatar Component

The component now ONLY loads a pre-made image file:

```jsx
<MascotAvatar status="normal" size={128} />
```

Renders:
```html
<img src="/assets/mascot/pixel_hero_normal.png" style={{ imageRendering: 'pixelated' }} />
```

### 27.3 Asset Files

Static PNG files in `public/assets/mascot/`:
- `pixel_hero_normal.png` (256x256)
- `pixel_hero_warning.png` (256x256)
- `pixel_hero_defeated.png` (256x256)
- Small mips (64x64) for profile previews

### 27.4 No Procedural Generation

The code does NOT:
- Draw pixels with Canvas
- Generate hair with SVG
- Use mathematical loops to create characters
- Render anything programmatically

The code ONLY:
- Loads a PNG file from the assets folder
- Displays it with `imageRendering: pixelated`

### 27.5 Adding New Artwork

To replace the mascot:
1. Create PNG artwork (256x256, transparent background)
2. Save as `pixel_hero_{status}.png` in `public/assets/mascot/`
3. No code changes needed - just drop in the file

## 28. SPRITE-МАСКОТ (SLIME): ПРИЧИНА БАГА, РЕСЁРЧ ДВИЖКА И ФИКС

### 28.1 Диагностика: почему слизень не рисовался вообще
- `SlimeSprite` собирал путь шаблоном `/assets/sprites/slime${id}/${id}_${anim}_with_shadow.png`
  (маленькая «s»), а файлы на диске — `Slime1_Idle_with_shadow.png` (большая «S»).
- Проверено curl'ом по Vite: старый путь → `200 text/html 736b` (SPA-fallback на Index.html!),
  правильный → `200 image/png 6947b`. `<img>` не может декодировать HTML → `onerror` →
  `[SlimeSprite] failed to load` → в кольце оставался серый placeholder.
- Почему баг выглядел «иногда работающим»: APFS на macOS регистронезависима, поэтому
  `fs.existsSync(lowercase)` = `true`, а `readdirSync` возвращает правильный регистр.
  В браузере (HTTP-путь) регистр важен всегда; на Linux-хостинге был бы чистый 404.
- Дополнительно: `FRAMES` был общим для всех слизней, а в листах разное число кадров —
  attack: slime1 = 10, slime2 = 11, slime3 = 9 (канвас вырезал 10-й кадр за границей
  листа → пустой/мигающий кадр).
- Плюс арт занимает ~38×30 px внутри кадра 64×64 (огромные поля) — в кольце слизень
  выглядел крошкой.

### 28.2 Ресёрч движка: варианты и почему выбран CSS steps()
| Вариант | Что даёт | Вердикт |
|---|---|---|
| CSS `steps(N)` + окно (`background-size`/`translate3d`) | 0 зависимостей, анимация на композиторе, integer-скейл без мыла | **выбран** |
| `react-sprite-animator` 2.0.2 (15 KB) | готовый компонент | заброшен (эпоха React 0.14/15), риск с React 18 |
| `@rive-app/react-canvas` 4.34.3 | state-machine, скелетная анимация | нужен `.riv`-арт + WASM-рантайм (~200 KB) — на будущее, API компонента совместим |
| `lottie-react` 3.1.2 | векторный JSON | нужен Lottie-арт, избыточно для 6-кадрового пиксель-арта |
| `pixi.js` 8.21.0 | WebGL-рендер | ~450 KB min, избыточно |
| APNG/анимированный WebP (Pillow, pre-bake) | `<img>` вообще без JS | отклонено: производные бинарные ассеты + Picture-скрипт в сборке (правило «арт не генерируем»); при желании компонент меняется один |
| `setInterval`/rAF и перевод кадров в base64 | текущий легаси-подход | отклонено: до 10 data-URL на состояние и дрожание на слабом Android WebView |

### 28.3 Реализация
- `frontend/src/components/ui/slimeAssets.js` — единый манифест: точные имена файлов, `view`
  (окно кадрирования внутри 64×64-кадра), тайминги, эмоция→анимация. Манифест — единственный
  источник путей, поэтому опечатка/регистр больше не могут разойтись с диском незаметно.
- `frontend/src/components/ui/SlimeSprite.jsx` — переписан: окно фиксированного размера +
  слой листа, который прокручивается `@keyframes` с `steps(N)` (шаг = 64 × целый масштаб).
  Число кадров берётся из `naturalWidth` загруженного листа (не хардкод!), death — one-shot
  с `fill-mode: forwards` (замирает на последнем кадре, а не на 6-м из 10), смена состояния —
  кроссфейд 380 ms, держим предыдущий слой 380 ms. Никакого канваса, `setInterval` и data-URL.
- Целый масштаб (`floor(size / span)`) + чётные стороны окна: при центрировании в кольце 220px
  окно садится на целый пиксель (нечётные 37→111px давали полупиксельное смешивание).
- `frontend/scripts/verify-sprites.mjs` (+ `npm run check:sprites`, подключён к `npm run build`):
  сверяет имена с `readdir` (точный регистр — то, на что не способен `existsSync`), геометрию PNG
  (высота = 4×64, ширина кратна 64, ≥2 кадров), попадание окна в кадр и чётность сторон.

### 28.4 Проверка
- `npm run check:sprites`: 18/18 листов OK (кадры 5–11, окна 38×30/40×36/42×42).
- Поодночный curl всех 8 используемых URL → `200 image/png` (а старый путь по-прежнему
  `200 text/html` — тот самый баг).
- Headless Chrome, попиксельная сверка (эталон — тот же кроп, посчитанный Pillow):
  standalone-приём `steps(6)` — все 6 кадров `max|diff| = 0`; реальный `SlimeSprite`
  в реальном `ProgressRing` для NORMAL/WARNING/DEFEATED — `max|diff| = 0`;
  **реальный дашборд приложения — слизень найден в окне (193,149), кадр idle #3, `max|diff| = 0`**.
- Консоль Chrome на дашборде чиста (ни `[SlimeSprite]`, ни Uncaught).
- Сборка: `dist` JS 323.5 KB (легаси-канвас-кроп убран), CSS 24.5 KB.
> Замечания: `slimeId` и `row` — пропсы (row 0 = лицевой ракурс листа), под будущую привязку
> к скинам/замороженному кадру; анимации attack/run/hurt доступны, но в UI не задействованы
> (attack-кадры раздуваются на всю ячейку и в окно не входят сознательно).

## 31. TAMAGOTCHI PET: HEALTH BAR (HP) & DAMAGE SYSTEM

### 31.1 Логика HP (`frontend/src/utils/petHealth.js`)
- `HP = clamp(round(Доступно на сегодня / Дневной лимит × 100), 0, 100)`,
  где доступно = `daily_limit_current` (лимит + перенос − траты дня), лимит = `daily_limit_base`.
- Статусы: `HP > 50` → normal, `1..50` → warning, `0` → defeated.
- Сердечки: сердце i (1..5) полное, если `HP ≥ i×20` (ровно правило из ТЗ) → 100 % = 5, 50 % = 2, 0 % = 0.
- Крайние случаи: `available ≤ 0` → 0 % (defeated); `limit ≤ 0` (доход не задан) → 100 % при
  положительном остатке, иначе 0 % (без деления на ноль).
- Перенос из прошлых дней может держать питомца живым, даже когда кольцо красное:
  кольцо/винетка считаются по `progress_percentage` от БАЗОВОГО лимита (см. §16.2), HP —
  по остатку. Это две разные метрики, специально не смешиваются.

### 31.2 Визуал
- `TamagotchiPet` (`components/dashboard/TamagotchiPet.jsx`) — питомец внутри `ProgressRing`:
  аура статуса (`glowMap` из ТЗ: 52/199/89 · 255/159/10 · 255/69/58 @ 25 %), тонкое кольцо
  статуса, вспышка урона.
- `PetHealthBar` (`components/dashboard/PetHealthBar.jsx`) — шкала под кольцом: пилюля
  `HP + 5 сердечек + %`, `role="progressbar"` с `aria-valuenow`, цвет сердец по статусу,
  пустые — нейтрально-серые, при крахе — разбитые (`HeartCrack`, §31.2 «сердечко разбито»).
- Иконки — `lucide-react` (`Heart`, `HeartCrack`, strokeWidth 1.5) вместо эмодзи ❤️/🖤:
  правило §8.1 запрещает эмодзи, а цвет-статус разрешён именно как индикатор состояния.
- Питомец = существующий пиксельный спрайт-слизень (`SlimeSprite`) вместо `pet_*.gif`
  из ТЗ: GIF-ассетов в проекте нет, а пайплайн спрайтов уже отлажен (§28). Статус → эмоция
  маскота: normal/warning/defeated → NORMAL/WARNING/DEFEATED → idle/walk/death.
- Урон = **уменьшение** остатка между рендерами (ref с предыдущим значением). В ТЗ условие
  было `availableBudget < dailyLimit` — оно истинно почти всегда при переносе, поэтому питомец
  «получал урон» на каждом рендере; исправлено. Реакция: 500 ms целочисленный shake/squash
  (framer-motion, без размытия пиксель-арта) + `triggerHaptic("warning")`.
- Код — JSX, а не TSX из ТЗ: в проекте нет TypeScript (весь `src` — `.js/.jsx`), вводить его
  ради одного компонента не стали.

### 31.3 Проверка
- `node` -проверка чистой логики: 10/10 кейсов (7867/10000 → 79 % normal 3♥; 5000/10000 → 50 % warning 2♥;
  2100/10000 → 21 % warning 1♥; 0 и −1500 → 0 % defeated; 14533/6666 → 100 %; лимит 0).
- Вживую в Preview (дашборд): 100 % — 5 зелёных сердец, aura mint, idle;
  после расхода 12 000 → **38 % «Уязвим»**, 1 янтарное сердце, аура/кольцо янтарь, спрайт → walk;
  затем 500 → 30 % и 300 → 26 %, при каждом списании — squash-анимация урона
  (`matrix(0.96…)` в замерах) и HP падает; тестовые траты удалены (id 26–28, `DELETE` → 204),
  дашборд вернулся к 100 %/5♥/idle.
- `npm run build` — OK (спрайт-чек + бандл JS 327.6 KB / CSS 25.1 KB).

## 32. UI REFACTORING, 5-СЕКУНДНАЯ ПАУЗА И ИНТЕГРАЦИЯ С ТАМАГОЧИ

### 32.1 «Запас прочности» удален, состояние = HP питомца
- Фронт: `FrozenSavingsCard` больше не рисует колонку «Запас прочности» — осталась одна
  карточка «Заморожено (долги мне)» на всю ширину. `DayStatus` переведен на HP
  (перерасход → HP = 0, риск → HP ≤ 50), алая виньетка и «пере-лимит» кольцо тоже
  считаются от HP (`overLimit = hpPercent <= 0`).
- Бэкенд: удалены `safety_days` из `/dashboard`, инсайт `safety_days` и поле в схеме;
  `POST /analytics/safe-purchase` теперь отвечает в терминах HP (`hp_now`/`hp_after`/`hp_loss`)
  и формулирует текст как «HP питомца: 100% → 68% (−32)».
- Итог: единственный источник истины о состоянии — HP питомца (0–100 %), как в ТЗ.

### 32.2 Пауза 5 секунд вместо часа (Fast Impulse Check)
- Новый `ImpulseGuardModal` — компактный bottom sheet: разбитое сердце (lucide
  `HeartCrack`, без эмодзи по правилу §8.1), сумма, превью «HP до → HP после»,
  кнопка «Пауза (5с)» с реальным обратным отсчётом и разблокировкой, затем «Да, потратить».
- `QuickAddExpenseModal`: пауза вызывается до отправки, если выбран «Импульсивная покупка»,
  включён тумблер паузы и сумма ≥ порога (порог 0 → для любой импульсной покупки).
  При подтверждении уходит `impulse_acknowledged: true` → бэкенд сохраняет расход сразу;
  без флага (старые/внешние клиенты) остаётся легаси-часовой Time Lock.
- Отмена на паузе → `POST /impulse-guard/cancel` → сумма растет в «Сэкономленный Капитал»
  (деньги и так не списаны) — фича из §16.3 осталась живой.
- Из ТЗ не переносим условие `availableBudget < dailyLimit` ( оно истинно почти всегда
  при переносе): урон/пауза считаются от фактического порога и наличия флага.

### 32.3 Профиль: секция «Геймификация и фичи»
- Тумблеры `Пауза перед бессмысленной тратой (5 сек)` и `Вибрация при уроне питомцу` +
  поле «Порог опасной покупки» в одном grouped-inset card. Новый `ui/ToggleSwitch.jsx` —
  iOS-switch 51×31 с пружинкой и haptic light.
- Настройки хранятся в `localStorage` (`utils/petSettings.js` + подписка между компонентами):
  миграций в проекте нет (`init_db` = `create_all`), а две UX-опции устройства не стоят
  изменения схемы `users` с риском для уже существующей demo-базы. Перенести серверно —
  один шаг (добавить колонки + поля в `ProfileUpdate`).
- Вибрация при уроне реально управляет haptic в `TamagotchiPet`.

### 32.4 Главный экран
- Убрано второе декоративное кольцо внутри кольца — остался один тонкий `ProgressRing`,
  внутри питомец (аура статуса сохранилась).
- Компактный центральный блок: `HP-пилюля → «ДОСТУПНО НА СЕГОДНЯ» → сумма` без разрывов
  (`mt-2` у блока, `mt-2.5`/`mt-0.5` внутри), статус-строка под суммой.
- Вместо двух-колоночной сетки безопасности — одна стеклянная карточка «Заморожено».

### 32.5 Багфиксы UI из скриншотов
- **Две серые полоски в «Новый расход»**: ручку-полоску рисует сам `Modal`, а модалка
  рисовала вторую. Дубликат удален (в DOM ровно один `h-1 rounded-full`).
- **Красная линия и красные дуги справа у строк расходов**: композитный слой строки
  (drag-transform) просвечивал красную зону удаления на скруглённых углах. Теперь слой
  действия скрыт в покое (`opacity: 0`, `tabIndex -1`) и появляется только на свайпе
  (`onDragStart` / при возврате в 0 — снова скрывается).

### 32.6 Проверка
- `npm run build` — OK (проверка спрайтов + сборка).
- Бэкенд (curl): `/dashboard` без `safety_days`, инсайты = только `streak`;
  `POST /transactions` с `impulse_acknowledged=true` → `pending: false`, транзакция создана;
  `POST /impulse-guard/cancel` → `saved_capital` 287 556 → 289 056;
  `safe-purchase` (с временно включённым премиумом): 10 000 → «HP 100% → 68% (−32)»,
  20 000 → «обнулит HP питомца (100% → 0%)».
- Живьем в Preview: в «Новый расход» одна ручка и подсказка про 5-секундную паузу;
  импульс 6 000 → sheet «Урон питомцу!» с отсчётом `Пауза (5с) → (3с) → «Да, потратить»` (кнопка
  разблокировалась ровно через 5 с); «Отмена» → `saved_capital +6000`, расход НЕ создан,
  шторки закрылись, в дашборде флеш про Сэкономленный Капитал; повтор с подтверждением →
  расход создан без pending (`/pending-transactions` = 0), доступно 14 533 → 8 533;
  свайп строки влево раскрывает красную зону (translateX -80), в покое красного нет
  (opacity слоя действия = 0, скриншот чистый), тап по корзине удаляет строку;
  профиль: обе секции тумблеров, «ГЕЙМИФИКАЦИЯ И ФИЧИ», Сеэкономленный Капитал 287 556 EUR.
- Тестовые данные убраны (транзакции удалены, `saved_capital` возвращен в 287 556, премиум снова выкл).
> Замечания: 1) бэкенд был запущен без `--reload`, поэтому его пришлось перезапустить —
> теперь он под launchd-джобой `freebuff-backend-2mln-8000` (порт 8000); 2) легаси-механика
> Time Lock (`pending_transactions`, `/pending-transactions/*`, баннер) оставлена для
> совместимости — новый клиентский флоу ее не вызывает.

---

## 33. TAMAGOTCHI CORE LOOP: МАТРИЦА СОСТОЯНИЙ, ТАП, НОКАУТ И КАРАНТИН

Номер в ТЗ означает §33; нумерация README продолжается после §32.

### 33.1 Матрица состояний (`utils/petHealth.js`)

| Состояние | HP | Аура | Сердечки | Экономика / наказание |
| --- | --- | --- | --- | --- |
| `normal` (Сыт и счастлив) | 51–100 % | зелёная `#34C759` | 5–3 ❤ | +10 монет за закрытый день |
| `warning` (Голоден, тревога) | 1–50 % | жёлтая `#FF9F0A` | 2–1 ❤ | стандартный режим |
| `defeated` (Финансовый нокаут) | 0 % | красная `#FF453A` | 0 ❤ (`HeartCrack`), grayscale | стрик = 0, карантин 5 с |

- Формула прежняя (§31/§32): `HP = clamp(round(доступно / дневной лимит × 100))`;
  статус — `hp === 0 → defeated`, `hp <= 50 → warning`, иначе `normal`.
- **Сердечки переехали с шага 20 % на ступени 90/75/51/25/1.** Старая формула
  `hp >= i × 20` давала при 51 % всего 2 сердца, а матрица §33 требует 3–5 в
  «сыт и счастлив» и 1–2 в «тревоге». Проверено на живом экране: 33 % → 2 ❤.
- Монеты (`dashboard.coins`, +10 за каждый *завершившийся* день месяца с HP > 50 %)
  считаются на бэкенде **производно** от расходов по дням (`compute_coins`) —
  не хранятся в БД, поэтому схему `users` менять не пришлось (миграций в проекте нет,
  `init_db` = `create_all`). Видны пилюлей рядом со шкалой HP и строкой в профиле.
- `petIsFainted(health)` — единый предикат нокаута, им пользуются дашборд, модалка
  расхода и профиль. `PET_TAP_MESSAGE` — реплики питомца (тексты из ТЗ, без эмодзи по §8.1).

### 33.2 Тап по питомцу (`TamagotchiPet.jsx`)

- Тап/Enter/Space → реакция по статусу + всплывающая реплика на 4,2 с:
  `normal` → прыжок `scale 1.05` и 6 частиц по фиксированным углам (без `Math.random`
  в рендере) + haptic heavy; `warning` → дрожь целыми пикселями + «Осторожно! Лимит почти
  исчерпан.»; `defeated` → «Я в нокауте... Ждем обновления лимита в 00:00 или пополни бюджет.».
- Дрожь/вспышка урона при списании бюджета осталась (§31): сравниваем соседние рендеры
  `availableBudget`, а не `availableBudget < dailyLimit` (это условие из ТЗ истинно почти
  всегда при переносе — исправлено ещё в §31).
- В нокауте спрайт уходит в `grayscale(0.85) contrast(0.95)`, аура и кольцо — красные.

### 33.3 Нокаут = финансовый карантин (Fainted Flow)

- **Пауза принудительно включена для ВСЕХ трат** (не только импульсивных) до 00:00:
  `QuickAddExpenseModal` получает `fainted` и в карантине вызывает 5-секундный sheet
  независимо от тумблера **и от порога опасной покупки**. Последнее нашлось только на живом
  прогоне: в demo-профиле порог 5 000, и трата на 100 EUR в нокауте проскакивала без паузы.
- **Тумблер в профиле заблокирован** (`ToggleSwitch disabled`, принудительно `checked`),
  копирайт меняется на «Карантин питомца: пауза обязательна для всех трат до 00:00».
- **Стрик обнуляется мгновенно**: `compute_streak` возвращает 0, как только доступное на
  сегодня ≤ 0 (раньше серия рвалась только на следующий день, когда перерасход попадал в
  `day_balances`). Проверено: 5 → 0 сразу после перерасхода.
- **Компактное уведомление** на дашборде («Питомец обессилел! Лимит на сегодня превышен.»)
  с объяснением карантина и способов revive (00:00 / доход) и крестиком, чтобы скрыть.
- Revive бесплатный (новый день, в 00:00 `daily_limit_current` пересчитывается сам) или
  дисциплинированный (пополнить бюджет доходом в профиле) — отдельных эндпоинтов не нужно.

### 33.4 Баг, найденный на этом шаге (одноразовые анимации исчезали)

В нокауте питомца **не было видно вообще**: кольцо красное, аура есть, спрайта нет.
Причина — `steps(N, end)` + `fill-mode: both` у одноразовой анимации: после окончания
браузер подставляет значение `to` = `-(N)` ячеек, то есть пустую клетку **за** последним
кадром листа (у `Death` ровно 10 кадров — окно уезжало в 11-ю клетку). Для лупов это
незаметно (итерация начинается заново с нуля), поэтому баг всплыл только на death.
Исправление: у одноразовых анимаций шагаем `N-1` шагом и замираем на реальном кадре
(`ANIMATIONS[*].holdFrame`, для `death` — кадр 6: тело уже распласталось, но читаемо;
кадры 7–9 «растворяются» в лужу и в окне 38×30 выглядят пустым местом).

### 33.5 Проверка

- `npm run build` — OK; `npm run check:sprites` — 18/18 OK (геометрия и регистр не менялись).
- Бэкенд (curl): перерасход → `/dashboard` `streak_days: 5 → 0`, `coins: 20`
  (2 закрытых дня с HP > 50 %); после удаления тестовых транзакций — снова `5`, `20`,
  `daily_limit_current 21199.98`. Новые поля: `dashboard.coins` (`DashboardResponse.coins`).
- Живьём в Preview (DOM-проверки + скриншоты): 100 % HP — тап «Всё под контролем! Сила
  Казны растет.», 6 частиц, `scale → 1.0435`; «Внести расход» — **одна** ручка и `EUR`
  (а не `KZT`) в поле суммы; строки расходов в покое без красной кромки (opacity слоя
  действия `0`, свайп влево по-прежнему раскрывает красный блок: `translateX(-96px)`,
  opacity `1`); 33 % → «Уязвим», 2 ❤, реплика «Осторожно! Лимит почти исчерпан.»;
  0 % → баннер нокаута, `HeartCrack`, grayscale-спрайт (после фикса §33.4), реплика нокаута,
  тумблер паузы в профиле `disabled + checked`, sheet «Карантин питомца» для **обязательной**
  траты на 100 EUR (порог 5 000 не помешал), «Пауза (5с)» → «Да, потратить» → расход создан.
- Тестовые данные убраны (4 транзакции удалены, `pending_transactions` = 0, стрик и лимит
  вернулись к исходным; валюта профиля возвращена в `EUR`).
> Замечания: 1) бэкенд поднят без `--reload` — после правок §33 он перезапущен
> (порт 8000), фронтенд-превью живёт на 5173; 2) `Сэкономленный Капитал` = 287 556
> накоплен прошлыми прогонами отмен импульсов (сидер его не задаёт) — значение не трогал;
> 3) скриншоты превью в конце шага перестали сниматься («webview is not being composited») —
> это ограничение окна Preview, а не кода: DOM-проверки и более ранние скриншоты прошли.

---

## 34. IMMUTABLE LEDGER И ИНТЕРАКТИВНЫЙ ОНБОРДИНГ

### 34.1 Расходы нельзя удалять или менять

- **Бэкенд**: маршрут `DELETE /transactions/{id}` оставлен намеренно и **всегда** отвечает
  `403` с текстом правила («Записи в Казне неизменяемы. Это защищает твою дисциплину от
  самообмана.»). Так сделано вместо удаления маршрута: `405 Method Not Allowed` от FastAPI
  ничего не объясняет клиенту, а устаревшая сборка в WebView Telegram и внешние клиенты
  получают внятную причину. Реализация удаления из роутера убрана полностью —
  `db.commit()` с `session.delete()` больше не существует даже теоретически.
- **UI**: в строке расхода (`TransactionItem`) больше нет `SwipeableRow` и кнопки удаления —
  это обычная кнопка «только чтение» с иконкой `Lock` и тапом, который показывает тултип с
  правилом (3,2 с, над нижней навигацией, haptic warning). Подсказка-выход: «Ошиблись суммой?
  Скорректируйте доход в профиле» — изменение `monthly_income` честно пересчитывает дневной
  лимит (а не подтирает историю).
- Что не тронуто: свайп-удаление осталось у **шаблонов** фиксированных расходов и у долгов
  (вкладка «Расходы» — это план, а не совершённые траты) — удаление плана не искажает историю.
- `api.deleteTransaction` из клиента убран, чтобы мёртвый вызов не возвращался в код.

### 34.2 Онбординг (4 шага)

Флаг `has_completed_onboarding` — в `localStorage` (`utils/onboarding.js`,
ключ `budget.onboarding.v1`, есть `resetOnboarding()` для повторного прохождения).
В `users` его не заводили по той же причине, что и настройки §32: миграций в проекте нет,
`init_db` делает только `create_all`, а «пройден на устройстве» — корректная семантика для тура.

| Шаг | Экран | Действие |
| --- | --- | --- |
| 1 | Тёмный оверлей, спотлайт на питомце | «Познакомиться» — кнопка или тап по самому питомцу |
| 2 | Карточка снизу, ввод суммы | «Сохранить лимит» → `PATCH /profile` |
| 3 | Подсветка настоящей кнопки «Внести расход» | пользователь вносит тестовый расход |
| 4 | Карточка про 5-секундную паузу | «Понятно, я готов!» |

- **Шаг 2 — не декоративный**: дневной лимит на бэкенде производный
  (`(доход − фикс. расходы − заморожено) / дни месяца`, округление вниз), поэтому онбординг
  считает доход обратно от желаемого лимита: `income = limit × дни + fixed + frozen`.
  Проверено: ввод `5000` → `monthly_income = 200 000` → `daily_limit = 5000.00` ровно.
- **Шаг 3 работает с реальной модалкой**, а не со своей копией: оверлей пропускает клики
  (`pointer-events-none`), вокруг кнопки — зелёная рамка, а шаг закрывается, когда в
  сегодняшних расходах появляется новая запись. Никакого демонстрационного «фейкового» урона:
  питомец реально вздрагивает от списания (§31), после чего карточка показывает арифметику
  `−1 000 из 5 000 = −20 % HP` с анимацией полосы (полоса — иллюстрация правила, рядом — факт:
  «Твой HP сейчас — N %», чтобы цифры не расходились с переносом лимита из прошлых дней).
- В шаг 3 встроено **правило неизменяемости** (в ТЗ оно было отдельным шагом 3 в примере
  кода) — обучение и правило выдаются в одном месте, где пользователь впервые вносит трату.
- Текст тестовой покупки — 20 % от введённого лимита (та же арифметика «1 000 из 5 000»,
  но верна для любого лимита); эмодзи из ТЗ заменены на иконки lucide (правило §8.1).
- Можно пропустить на любом шаге («Пропустить обучение») — флаг всё равно ставится,
  иначе тур вернётся при следующем запуске.

### 34.3 Проверка

- `curl -X DELETE /api/v1/transactions/1` → `403` + текст правила, число транзакций в БД не
  изменилось (25). `npm run build` — OK (JS 352.8 KB).
- Живьём в Preview: тур запустился сам на чистом флаге — спотлайт на питомце, «Познакомиться»
  (и тап по питомцу, и кнопка) → ввод `5000` → лимит стал `5000.00`, «доступно» пересчиталось;
  на шаге 3 кнопка обведена и кликабельна → настоящая модалка → «Кофе» на 1 000 EUR →
  дашборд обновился (`14 533 → 13 533`), появилась карточка с `−1 000 из 5 000 = 80 %`,
  правилом и «Дальше» → шаг 4 → «Понятно, я готов!» → оверлей исчез, флаг
  `{hasCompletedOnboarding: true, via: "completed"}` в localStorage; тап по строке расхода
  даёт тултип «Записи в Казне неизменяемы...», свайп-зоны удаления в строке больше нет
  (`[aria-label="Удалить"]` отсутствует).
- После проверки демо-состояние возвращено: тестовый расход удалён **прямым SQL** (API для
  этого больше не существует — это и есть смысл §34.1), `monthly_income` вернён в 250 000,
  лимит пересчитан в 6666.66, стрик/coins — прежние (5 / 20), флаг онбординга снят,
  чтобы тур можно было пройти заново.

---

## 35. МУЛЬТИВАЛЮТНОСТЬ, ЛОКАЛИЗАЦИЯ (RU/KK/EN) И МАГАЗИН МОНЕТ

### 35.1 Мультивалютность

- `utils/format.js`: `CURRENCIES` (KZT ₸ / USD $ / EUR € / RUB ₽), `currencySymbol()`,
  `currencyLabel()` («KZT (₸)» для чипов) и **`formatCurrency(amount, currency)`** — единый
  способ рендерить суммы в UI. Старый `formatMoney` оставлен алиасом, чтобы не переписывать
  сразу все экраны: суммы теперь везде с символом («21 200 ₸»).
- Глобальный стейт — `useCurrency()` в `AppContext` (в ТЗ был `useCurrencyStore`): источник
  правды один — профиль с сервера, второй стор разошёлся бы с ним. Хук даёт
  `{ currency, symbol, options, changeCurrency }`; смена пишет в профиль.
- Онбординг: валюта выбирается **до** ввода лимита (шаг 2 = чипы + сумма) и сохраняется ДО
  пересчёта лимита. Попутный баг: `pendingCurrency` инициализировался жёстким `"KZT"`,
  поэтому «Сохранить лимит» без тапа по чипу переключил бы валюту на KZT — теперь по
  умолчанию берётся валюта профиля.

### 35.2 Локализация (react-i18next, RU/KK/EN)

- Зависимости: `i18next@23` + `react-i18next@15` (`next-intl` не подходит — он для Next.js).
  Инициализация — `src/i18n/index.js`, словари — `src/i18n/locales/{ru,kk,en}.json`.
- Определение языка: ручной выбор (`localStorage: budget.lang.v1`) →
  `Telegram.WebApp.initDataUnsafe.user.language_code` → язык браузера → RU; `<html lang>`
  синхронизируется. Переключатель — карточка «Язык» (RU / KK / EN) в профиле.
- Эмодзи из словаря ТЗ не переносим (правило §8.1), а `\n` в JSON заменён нормальной вёрсткой.
- **Локализовано полностью**: онбординг (4 шага), нижняя навигация, хедер и статус-бейдж,
  главный экран (HP, сумма, монеты, кнопки, пустой день, баннер нокаута, тултип
  неизменяемости), шкала HP, реплики питомца, статус дня, модалка расхода, карантинный шит,
  профиль и магазин монет, названия категорий и скинов.
- **Осталось на русском** (осознанно, чтобы не раздувать шаг): экраны «Аналитика», «Расходы»
  (фикс-платежи), шторка долгов, пейволл и легаси-Time Lock, а также тексты, которые
  генерирует бэкенд (инсайты дашборда, `lock_reason` в `/avatar/skins`). Паттерн для них
  тот же: ключ в словаре + `useTranslation` в компоненте.

### 35.3 Магазин монет

- Монеты (§33) остаются **производными** (10 за каждый закрытый день с HP > 50 %), а траты
  хранятся в новой таблице `coin_purchases` — баланс = заработано − куплено. Таблица новая,
  поэтому её создаёт `create_all` прямо на существующей БД (ALTER TABLE не нужен — в проекте
  нет миграций). Уникальный ключ `(user_id, skin_id)` защищает от двойной покупки при гонке.
- **Кошелёк, а не месячный счётчик:** `compute_coins` изначально считал только завершившиеся
  дни *текущего месяца*, и экономика магазина не сходилась: максимум 31 × 10 = 310 монет в
  месяц при ценах 150 / 500 / 1500 → единственный доступный по цене скин (Титан, 150)
  открывался стриком 7 дней **бесплатно**. Теперь окно идёт от первой записи пользователя
  (`min(date_key)`), монеты накапливаются между месяцами и длинная дисциплина реально
  конвертируется в кастомизацию (Титан ≈ 15 дней, Ронин ≈ 50, Архитектор ≈ 150).
- **Защита от сжигания монет:** `POST /shop/purchase` отказывает (`400 Скин уже открыт
  стриком — монеты тратить не нужно`), если скин и так разблокирован стриком. UI/`:owned`
  такую кнопку не показывает, но клиент в WebView Telegram может быть устаревшим, а списание
  при этом необратимо.
- `services/skins.py`: у каждого скина появилась `price_coins`. Два пути к одному скину:
  стрик (бесплатно) или монеты (быстрее). Цены: Титан 150 / Ронин 500 / Архитектор 1500
  (×15 / 50 / 150 дисциплинированных дней). Скины `premium_only` за монеты не продаются —
  платный вход остаётся платным. `unlocked_skin_ids(streak, premium, purchased)` получил
  третий источник разблокировки, поэтому и `/avatar`, и `/avatar/skins/equip` учитывают покупки.
- API: `GET /shop` (баланс, заработано/потрачено, стрик, предметы с флагами
  owned/purchased/equipped/purchasable) и `POST /shop/purchase`. Покупка сразу надевает скин
  (иначе не видно, за что заплатил), а надетый скин меняет маскота на главной (`utils/skins.js`).
- UI: шторка `CoinShopSheet` (открывается из профиля; пилюля монет на главной ведёт в профиль),
  названия/описания скинов переводятся по id с фоллбэком на текст бэкенда. Кнопка действия
  вынесена в отдельную строку карточки: в общем ряду длинная плашка «Не хватает 130 монет»
  сжимала текстовую колонку до 64 px из 303 (замерено в DOM) и рвала описание по два слова.
- Заодно: `AppContext.refreshAll` теперь повторяет запросы 3 раза — перезапуск бэкенда в dev
  раньше оставлял экран на «Загружаем профиль...» навсегда.

### 35.4 Проверка

- `npm run build` — OK (JS 439.1 KB / 139 KB gzip; i18next добавил ~30 KB gzip);
  `npm run check:sprites` — OK.
- Магазин проверялся **на трёх копиях демо-БД** (`VACUUM INTO`, сервер на порту 8010 с
  `DB_PATH=/tmp/shop_*.db`) — демо-данные не затронуты:
  - A (демо как есть): `earned 20`, покупка Титана → `400 Недостаточно монет: нужно 150, у тебя 20`;
  - B (48 чистых дней с 1 августа, хвост 12–17.09 слит): `earned 420, streak 0`,
    покупка → `200`, баланс 270, `spent 150`, скин наделся и `active_skin_id` сменился,
    `unlocked` содержит Титана, повтор → `409 Скин уже куплен`;
  - C (те же 48 дней без слива): `earned 480, streak 17` — Титан уже открыт стриком,
    покупка → `400 Скин уже открыт стриком` (баланс остался 480 — монеты не сгорели).
- Остальные ветки: `403` на премиум-скин, `400 Этот скин доступен и так` на Кадет,
  `404` на несуществующий id; `/avatar` и `/avatar/skins` показывают покупку в `unlocked`.
- Живьём в Preview: онбординг на RU; шаг 2 — четыре чипа валют с символами (проверены KZT
  и EUR: символ в инпуте и весь UI меняются сразу, лимит из шага 2 сохраняется арифметически —
  ввод 6666.66 дал `monthly_income 249 999.8` и `daily_limit 6666.66`); тестовый расход через
  реальную модалку → карточка `−1 000 из 5 000 = 80 %` → шаг 4 → «Понятно, я готов!»;
  переключение на EN в профиле перевело интерфейс целиком (шапка, навигация, главная с
  «AVAILABLE TODAY», статус дня, магазин, названия скинов), `document.documentElement.lang`
  и `budget.lang.v1` = `en`; переключение на KK через тот же селектор — «БҮГІНГЕ
  ҚОЛЖЕТІМДІ», «Шығын қосу», «Басты / Талдау / Шығындар / Профиль», тултип питомца
  казахский; магазин: «Buy for 15» → тост «Skin bought and equipped», баланс 170 → 5,
  карточка стала «Equipped», маскот на главной сменился на `Slime2`, пилюля монет говорит 5.
- Демо-состояние возвращено: покупка и тестовый расход удалены прямым SQL (API удаления
  расходов не имеет — §34.1), `active_skin_id=skin_cadet`, доход 250 000, лимит 6666.66,
  стрик 5, монеты 20; временная цена скина откатана до 150; флаги `budget.onboarding.v1`
  и `budget.lang.v1` сняты — тур и RU снова получаются «с нуля».
> Замечания: 1) `npm install` в этом окружении падает на root-owned `~/.npm` (`sudo chown`
> не выполнялся) — зависимости ставились через `npm install --cache /tmp/npm-cache-2mln`,
> это записано в run-doc; 2) валюту профиля пользователь переключил сам в живом превью —
> при возврате демо-состояния она ставится в `KZT` (значение сида), а свой выбор можно
> сделать в шаге 2 онбординга или в профиле.

## 36. DOCKER-ДЕПЛОЙ НА СЕРВЕР (COMPOSE + TRAEFIK, ПОДДОМЕН 2MLN.FREEDDNS.ORG)

Стек поднимается одной командой из корня репозитория. Наружу смотрит только Traefik,
который уже стоит на сервере; контейнеры подключаются к его внешней сети.

### Состав

| Файл | Назначение |
| :--- | :--- |
| `docker-compose.yml` | backend (FastAPI+SQLite, только internal-сеть, volume `budget_data`) + frontend (nginx: статика Vite и прокси `/api` → `backend:8000`), labels для Traefik |
| `backend/Dockerfile` | `python:3.12-slim`, tzdata (граница дня), non-root `appuser`, healthcheck `/api/health`, uvicorn с `--proxy-headers` |
| `frontend/Dockerfile` | двухэтапный: `node:22-alpine` (`npm ci` + `npm run build` = check:sprites + vite build) → `nginx:1.27-alpine` |
| `frontend/nginx.conf` | gzip, `/api/` → `backend:8000` (без перезаписи пути), кеш 7d на `/assets/`, `no-store` на `index.html` (иначе WebView Telegram залипает на старом бандле), SPA-fallback |
| `.env.example` | `DOMAIN`, `CERTRESOLVER`, `TRAEFIK_NETWORK`, `TZ` |

### Схема и Traefik

`Пользователь → Traefik (entrypoint websecure, certresolver myresolver) → frontend:80
→ /api/* → backend:8000`. Порты на хост не публикуются. Backend в Traefik-сеть не ходит.

Labels (повторяют рабочий шаблон `zalpos.freeddns.org` с сервера):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=traefik-public"          # иначе Traefik может выбрать internal-сеть → 502
  - "traefik.http.routers.2mln.rule=Host(`2mln.freeddns.org`)"
  - "traefik.http.routers.2mln.entrypoints=websecure"
  - "traefik.http.routers.2mln.tls.certresolver=myresolver"
  - "traefik.http.services.2mln.loadbalancer.server.port=80"
```

Значения из `.env`: `DOMAIN` (по умолчанию `2mln.freeddns.org`), `CERTRESOLVER`
(`myresolver`), `TRAEFIK_NETWORK` (`traefik-public`), `TZ` (`Asia/Almaty` — по нему
считается «сегодня»: лимит, стрик, монеты, нокаут), `BOT_TOKEN` (авторизация + Stars),
`WEBHOOK_SECRET` (защита вебхука бота), `PREMIUM_STARS_PRICE` (цена в звездах).

### Деплой на сервер

```bash
# 1. Разово: DNS A-запись 2mln.freeddns.org → IP сервера
# 2. Разово: узнать имя traefik-сети (по умолчанию ждём traefik-public)
docker network ls | grep -i traefik
#    если называется иначе — в .env: TRAEFIK_NETWORK=<имя>
# 3. Код + конфиг
git pull
cp .env.example .env        # вписать BOT_TOKEN (от @BotFather) и WEBHOOK_SECRET
# 4. В BotFather: /mybots → бот → Bot Settings → Menu Button → Mini App = домен
#    (иначе Telegram не откроет приложение). Домен должен быть https.
# 5. Запуск
docker compose up -d --build
# 6. Проверка
docker compose ps
docker compose logs -f backend   # «Telegram webhook установлен: ...» — значит бот привязан
curl -s https://2mln.freeddns.org/api/health    # {"status":"ok"}
```

Дальше просто открывайте Mini App из Telegram — пользователь создастся сам при первом
запросе, все данные каждого пользователя изолированы по telegram_id.

Дальнейшие выкладки — тот же `docker compose up -d --build` (пересоберёт изменённые
слои). Данные живут в named volume `budget_data` (SQLite+WAL); `down -v` удаляет их
вместе с историей. При необходимости отката: `docker compose down && git checkout
<prev> && docker compose up -d --build` — volume с данными не страдает.

### Проверено локально без Docker-демона

Docker Desktop на этой машине не установлен (CLI 29.8.0 без демона и без плагина
compose), поэтому валидация выполнена по частям: `docker compose config` недоступен —
compose-файл проверен структурным тестом (16/16: labels, external-сеть с env-именем,
frontend без портов на хост, backend только в internal, volume, healthcheck-gate);
сборка backend-образа симулирована (venv из requirements.txt, uvicorn на чистой БД:
health 200); сборка frontend-образа — на чистом дереве без node_modules
(npm install + `npm run build` → dist, раздача 200). Перед первым деплоем на сервере
рекомендуется прогнать `docker compose config` и `docker compose build` там, где демон
есть.

