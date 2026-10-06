# ui — что есть и что нужно от других

## Ядро — сделано при интеграции

Ядро шлёт `fonts` после `document.fonts.ready`, `duration` тоста в контракте — в секундах, общий флаг `G.calm` и событие `calm` есть. Ниже — исходные просьбы.

1. **Шрифты.** Oswald и Golos Text грузятся с `display=swap`. Всё, что кэширует текст в offscreen-canvas до загрузки шрифтов, остаётся с фолбэком (Impact и т. п.). Просьба: в `G.boot` после `document.fonts.ready` эмитить `resize` (или новое событие `fonts`), чтобы кэши с текстом перерисовались. ui свои подписи переразмечает сам (`fonts.ready` и `loadingdone`).
2. **Единицы `duration` у тоста.** В контракте не указаны. ui считает секунды, а значения больше 60 принимает за миллисекунды. Стоит дописать в CONTRACT.md: `duration` в секундах.
3. **Общий флаг reduced-motion** (`G.calm`), как предлагает pickups. Сейчас ui читает `matchMedia` сам.

## Токены (css/base.css, обе темы)

- Для канваса: `--face-ink` (тёмные стрелки и цифры на светлом циферблате, одинаковый в обеих темах) и `--gold` (золото ачивок). ui уже сделал `G.colorKeys.add('face-ink')` и `G.colorKeys.add('gold')`, так что `G.C['face-ink']` и `G.C.gold` доступны после boot.
- Только для DOM: `--bg-hi`, `--chip`, `--shadow`, `--scrim` (тройка RGB для `rgba(var(--scrim), a)`), цвета видов тостов `--k-milestone`, `--k-achievement`, `--k-powerup`, `--k-record`, `--k-skin`, `--k-info`.
- Нужен новый токен — напишите сюда, добавлю в `:root` и оба тёмных блока.

## `G.ui`

- `toast(label, text, {kind, duration})`. Виды: `milestone`, `achievement`, `skin`, `powerup`, `record`, `info` (неизвестный → `info`). Очередь: на экране до 2 тостов (на сцене уже 560 px — один), остальные ждут, в очереди до 6. Ширина — не больше 64% сцены, чтобы не наезжать на индикатор пауэр-апов слева. Одинаковый тост (вид + label + text) не дублируется, а продлевается. Тосты стоят в правом верхнем углу сцены: левый верхний занят HUD-ом pickups. На паузе таймеры тостов стоят. На `start` и `gameover` очередь чистится целиком: свежие открытия meta показывает в `#metaOver`.
- `setOverlay('start' | 'over' | 'pause' | null)`, `verdict(score)` — как раньше.

## Кто что тостит

- **balance**: тост на `milestone` показывает ui (и звонит будильником в HUD). Если balance начнёт тостить сам в том же кадре, ui свой не покажет.
- **meta**: ачивки и скины тостит сама meta (`kind: 'achievement' | 'skin'`), ui на событие `achievement` своих тостов не делает. Для этих двух видов слева золотая медалька в духе `.mp-badge`. `#metaOver` внутри `.result`, ui его не трогает. Он стоит последним в карточке, после кнопки «скопировать результат». На низкой сцене (телефон) карточка прокручивается, и копирование остаётся на виду. Переключатель скинов на стартовом экране сделан через `G.meta.selectSkin / isSkinUnlocked`; он виден, если открыто два скина или больше.
- **pickups**: раз есть `G.powerups` (свои кольца и плашка с названием, в том числе для мгновенных), ui на `powerup` не тостит. Без `G.powerups` показывает полный тост: название и описание или «на N секунд».
- **combo** `{count, mult}`: в HUD рядом с «ебланством» появляется чип `×1,5`, если `mult > 1`. Сам «КОМБО ×n» рисует fx.

## Разметка

- В оверлее кликабельное: `#startBtn`, `#againBtn`, `#resumeBtn`, `#copyBtn`, `#skinPrev`, `#skinNext` (всё `button`), карточка результата `#resultCard` с `data-noinput`.
- Новые id: `hudClockBox`, `hudAlarm`, `alarmH`, `alarmM`, `hudCombo`, `hudBestBox`, `pauseBtn`, `musicBtn`, `startBest`, `startBestVal`, `skinPick`, `skinPrev`, `skinName`, `skinNext`, `resultCard`, `recordStamp`, `sClock`, `sBonus`, `sBestNote`, `copyBtn`, `copyLabel`, `shareText`, `resumeBtn`, `themeColor`, `themeAuto`, `themeLight`, `themeDark`. Старые id не менялись, `#toast` теперь контейнер очереди (`role="status"`, `aria-live="polite"`).
- Тема: переключатель «авто / день / ночь» в подвале пишет `data-theme` на `<html>` и `eblan.ui.theme` в хранилище. В режиме «авто» ui атрибут не трогает: если его выставил хост, он сохраняется.
