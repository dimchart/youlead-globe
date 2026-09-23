# YouLead Globe

Мінімалістичний сайт: екран входу → 3D-глобус з учасниками програми YouLead.

## Запуск у VS Code

1. `File → Open Folder…` і вибери папку `youlead-globe`.
2. Встанови розширення **Live Server** (Ritwick Dey), натисни правою на `index.html` → **Open with Live Server**.
   (Можна й просто двічі клікнути `index.html` — усе працює без сервера й без інтернету.)

Пароль за замовчуванням: `youlead` — змінюється в `config.js`.

## Додати учасника

Учасники живуть в Excel-файлі `data/members.xlsx` (аркуш «Учасники», один рядок на людину).
Обов'язково: Ім'я, Місто, Країна. Telegram — нік без @ або посилання t.me/….
Широту й довготу можна залишити порожніми — місто знайдеться саме (OpenStreetMap).

Файл `members.js` **генерується автоматично** — вручну його не редагуй.

## Автоматичне оновлення

GitHub Action `.github/workflows/update-members.yml` читає Excel і оновлює `members.js`:

- щодня о 00:00 за Варшавою (GitHub може запізнюватись на 5–30 хв у пікові години);
- одразу після того, як зміниться `data/members.xlsx`;
- вручну: GitHub → Actions → «Оновити учасників з Excel» → Run workflow.

Після оновлення `members.js` Vercel сам перевипускає сайт (1–2 хв).

Як змінити дані: відкрий `data/members.xlsx` в Excel/Numbers, збережи, потім у VS Code
Source Control → Commit → Sync Changes. Або на github.com: `data/` → Add file → Upload files.

Локальна перевірка: `pip install openpyxl && python3 scripts/build_members.py`.

## Структура

- `index.html` — розмітка обох екранів
- `style.css` — весь вигляд (кольори в `:root`)
- `app.js` — логін, глобус, картка учасника
- `config.js` — пароль
- `data/members.xlsx` — список учасників (джерело правди)
- `members.js` — згенерований з Excel, не чіпати
- `scripts/build_members.py` — перетворює Excel на `members.js`
- `.github/workflows/` — щоденне автооновлення
- `lib/` — globe.gl (three.js) і контури країн, лежать локально

## Важливо про безпеку

Пароль перевіряється в браузері, а `members.js` — звичайний файл, який відкриє кожен,
хто знає адресу сайту (DevTools → Sources). Тож це «двері для чемних людей», а не справжній
захист. Поки сайт лише на твоєму комп'ютері — все гаразд. Перед публікацією в інтернет,
де є Telegram-контакти реальних людей, варто зашифрувати `members.js` паролем
або перевіряти вхід на сервері.
