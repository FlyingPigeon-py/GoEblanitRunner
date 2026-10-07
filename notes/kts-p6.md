# П6 — секретки и уточки: что сделано и что нужно от соседей

Файлы: `js/kts/secrets.js` (секретки, плов, кнопка «Сделать хорошо», Котзилла, общий набор `G.kts.eggs`), `js/kts/ducks.js` (уточки), `js/kts/data/secrets.js`, `js/kts/data/ducks.js`. Спойлеры — `../kts_out/SECRETS.md`.

## Что отдаёт П6

- **Пикапы** (через ядро, событие `pickup`): `duck` (у `p.spot` — id места), `plovClue`, `kazan`, `goodButton`. У всех `weight: () => 0`: случайный `spawnPickup(null)` их не выбирает, ставит только П6 через `G.director.inject`.
- **`kts:egg {id, phase, …}`** — мелкие события для звука и эффектов:
  - `kotzilla`: `click {n}`, `meow`;
  - `plov`: `clue {n, total}`, `kazan`;
  - `duck`: `tap {spot}` (тап на стартовом экране), `legend` (вылетела легендарная).
- **`kts:event {id: 'goodButton', phase: 'start' | 'end'}`** — 10 с после нажатия кнопки (мажор у П7). `end` приходит и на `die`/`start`.
- **Секретки и уточки** — только через `G.kts.secret/duck/ach/skin`. Секреток 18: 15 фиксированных + `twoDenis`, `botBug`, `vyvezli`. Уточек 25.
- **`G.kts.eggs.plovLoc()`** — где сегодня плов (`'kitchen'`, `'metro'`, `'office'`, `'baikal'`, `'roof'`), для курьера К6. Остальное в `G.kts.eggs` — внутренний набор П6.
- **DOM:** слой `div.kts-eggs` в `#stage` (inline-стили, `z-index: 3`, `pointer-events: none`), в нём прозрачные `button[data-noinput]`. Видны только в режиме `start`, прячутся, пока открыта `#sprintBoard`.

## П5 — тексты и экраны

- Тосты на `kts:secret` / `kts:duck` ваши. Поля записей:
  - секретка: `name`, `toast` (строка для тоста находки), `desc`;
  - уточка: `name`; у легендарной ещё `toast` — массив, брать первую строку, которую `K.fmt` не обнулил;
  - в `name` и `toast` бывают токены людей (`{denis.nom}`), прогоняйте через `K.fmt`.
  - Предложение: `kts:secret` → «Секретка n/total» + `def.toast`; `kts:duck` → «Уточка KTS n/total» + `name`.
- У «Сделать хорошо» шутка в два тоста: П6 сам показывает «Спойлер: …мы не нашли», через 1.4 с открывает секретку — ваш тост с `toast: '…а вы нашли'` должен идти вторым.
- Свои тосты П6 показывает видом `'info'`: smoke пока не знает видов `kts/secret/duck`. Когда интегратор их добавит, переключить можно одной правкой: `eggs.ui.toastKind` в `js/kts/data/secrets.js`.
- Поле «Секретное слово» → `G.typeWord(text, 'field')`. П6 ловит «друллеги» (и «друлегги»), «ХОЧУ ТРУСЫ» (строчными — тост «Обязательно капсом»), «плов» (подсказка, не секретка), «стоп» (лопает голосовые; работает и на паузе).
- После `kts:secret {id: 'drullegi'}` по плану игра до конца сессии обращается «Друллеги!» — это ваше приветствие.
- Счётчик секреток: `K.found('secret').length` / `K.total('secret')`.

## П3 — сцена

- **Котзилла.** Если появится `G.scene.anchor('kotzilla')` (или `G.scene.anchors('living').kotzilla`) → `{x, alt, w, h}` в мировых единицах (`alt` — центр постера от земли; можно `y` экрана вместо `alt`), кнопка ляжет поверх вашего постера, а после первого клика П6 рисует вариации поверх него. Без якоря П6 рисует свой стикер слева на стене стартового экрана.
- Места уточек опираются на `G.scene.loc {id, variant, since}` и `G.scene.next.inSec`. Пожалуйста, не меняйте их формат и id локаций (`living:morning|noon|dawn`, `kitchen`, `metro`, `office`, `baikal`, `roof`, `bedroom`, `dream`).
- Дождь и ночь для уточек: `G.scene.weather === 'rain' && weatherK > 0.3`, `G.scene.night > 0.35`.

## П7 — звук

- Резиновый писк: `pickup` с `p.type === 'duck'` и `kts:egg {id: 'duck', phase: 'tap'}`.
- Мяу: `kts:egg {id: 'kotzilla', phase: 'meow'}`; на `click` можно тихий «пуньк».
- Мажор 10 с: `kts:event {id: 'goodButton'}`; щелчок кнопки — `pickup` с `p.type === 'goodButton'`.
- Плов: `kts:egg {id: 'plov', phase: 'clue' | 'kazan'}`.

## П8 — эффекты

- Искры на подбор уже даёт `fx` по `def.color` (у уточки жёлтый). Огненный хвост легендарной — частицы `G.fx.burst` из П6 (при `G.calm` выключен).
- П6 зовёт с фича-детектом `G.fx.ktsConfetti(n)` на «друллеги» (иначе обычное `confetti`) и `G.fx.stamp(text, {x, alt, color, rot})` на «Сделать хорошо» (иначе `popup`).

## П4 — прогресс

- Ачивки П6 объявлены в данных: `ducks5`, `ducks12`, `ducksAll`, `duckLegend` (group `ducks`), `plovFound` (group `secrets`).
- Скины открывает П6: `K.skin('trusy')` на «ХОЧУ ТРУСЫ», `K.skin('duck')` за всех уточек. Добавить в `G.skins` и нарисовать — ваше.
- Вкладка «Уточки»: `K.all('ducks')`, `name` через `K.fmt`, `legendary`, `K.has('duck', id)`.
- Мордор: секретка `mordor` по `kts:count {key: 'mordor'}` ≥ цели. Цель беру из `K.get('progress', 'mordor')`: `goalUnits` или `goalKm * unitsPerKm`; без них — 2 000 000 ед. Если назовёте поля иначе, напишите.

## П1 — препятствия и бонусы

- `vacuum` со `stompTop`: на нём иногда сидит уточка, берётся «Отложить». Без `vacuum` уточка садится на будильник.
- `voice`: прыжок сверху (`stomp` с `type: 'voice'`) → секретка `stopword`; «стоп» с клавиатуры П6 сам лопает все `voice` на экране через `G.smash`.
- `cake`: уточка иногда едет на торте; второй торт за забег → секретка `twoDenis`. `frog` (или `toad`) в среду → секретка `wednesday`.
- Из режиссёра нужны только `inject({free, double, apexId})`, `inject({ob: 'call', kind: 'air', opts: {level: 1}, under, underId})`, `busy`, `modes`, `speed`, `phys`. Новых API не надо.

## П2 — NPC

- `kts:npc {id: 'toxic', phase: 'kind'}` → секретка `botBug`, `phase: 'blocked'` → `filter`.

## Интегратор

- Smoke: в `TOAST_KINDS` нет `kts/secret/duck`, поэтому тосты П6 — `info` (см. П5).
- Для сценариев секреток при `?kts-debug=1`: `G.kts.eggs.force('goodButton' | 'plovClue' | 'kazan')`, `G.kts.eggs.forceDuck(id)`; находки пишутся в консоль `[kts] …`.
- Проверено отдельным прогоном (вне репозитория): бот-планировщик на трёх профилях при всех взведённых уточках, кнопке и плове не умирает; прыжок по дуге морковок попадает на кнопку с точностью ±6 ед.
