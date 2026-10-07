/* KTS-данные пакета П6: секретки, квест плова, кнопка «Сделать хорошо», Котзилла. Только данные, без логики. Спойлеры — в ../kts_out/SECRETS.md. */
(() => {
  'use strict';
  const K = window.G.kts;
  if (!K) return;

  K.add('secrets', {
    wednesday: { name: 'It is Wednesday', toast: 'Жаба среды поймана. Вдохнули-выдохнули', desc: 'Поймать жабоньку в настоящую среду', kind: 'date', ref: ['#1925', 'мем №10'] },
    gift: { name: 'Кое-что абсолютно секретное', toast: 'Вручение кое-чего абсолютно секретного', desc: 'Открыть третий подарок на ДР KTS', kind: 'date', ref: ['#1491', '#2835'] },

    drullegi: {
      name: 'Друллеги',
      toast: 'Друллеги! 💚',
      desc: 'Сказать главное слово KTS',
      kind: 'word',
      words: ['друллеги', 'друлегги', 'друлеги'],
      ref: ['#1335', '#3152'],
    },
    trusy: {
      name: 'ХОЧУ ТРУСЫ',
      toast: 'Добавили в чатик избранных. Трусы KTS — твои',
      desc: 'Попросить трусы KTS как положено',
      kind: 'word',
      phrase: 'ХОЧУ ТРУСЫ',
      lower: ['Обязательно капсом'],
      check: ['#1107'],
      ref: ['#1107', '#1351'],
    },
    stopword: {
      name: 'Стоп-слово',
      toast: 'Стоп-слово принято. Фейк разоблачён',
      desc: 'Остановить голосовое «залогай время»',
      kind: 'word',
      words: ['стоп'],
      ref: ['#414'],
    },

    meme1156: { name: 'Тот самый момент', toast: 'Доебланился ровно в 11:56. Расследование года', desc: 'Закончить забег ровно в 11:56', kind: 'action', clockMin: 716, ref: ['мем игры', '#1732'] },
    snoozeMeme: { name: 'Отложил тот самый', toast: 'Будильник 11:56 — done', desc: 'Отложить мем-будильник прыжком сверху', kind: 'action', ref: ['мем игры'] },
    goodButton: {
      name: 'Сделано хорошо',
      toast: '…а вы нашли',
      desc: 'Нажать кнопку «Сделать хорошо»',
      kind: 'action',
      spoilerLabel: 'Спойлер',
      spoiler: 'большой красивой кнопки, по нажатию которой всё налаживается само, мы не нашли',
      label: 'СДЕЛАТЬ ХОРОШО',
      stamp: 'СДЕЛАНО ХОРОШО',
      chance: 0.25,
      loc: ['office', 'baikal'],
      majorSec: 10,
      check: ['#1960'],
      ref: ['#1286', '#1960'],
    },
    filter: { name: 'Фильтруем базар', toast: 'Блокируем бота-токсика и фильтруем базар', desc: 'Заблокировать бота-токсика в полёте', kind: 'action', check: ['#3005'], ref: ['#3005'] },
    kotzilla: {
      name: 'Многоооо вариаций котзиллы',
      toast: 'Многоооо вариаций котзиллы',
      desc: 'Потыкать в Котзиллу на старте',
      kind: 'action',
      clicks: 7,
      meow: 'МЯУ',
      newYearHat: true,
      ref: ['#1962', '#1669', '#1285'],
    },
    inevitable: { name: 'KTS неизбежен', toast: 'Невозможно НЕ работать в KTS', desc: 'Попробовать уволиться', kind: 'action', check: ['#192'], ref: ['#192'] },

    plov: {
      name: 'Плов найден',
      toast: 'Плов найден! Олды помнят',
      desc: 'Пять зацепок и казан',
      kind: 'quest',
      people: ['sasha'],
      word: 'плов',
      clues: 5,
      loc: ['kitchen', 'metro', 'office', 'baikal', 'roof'],
      clueLabel: 'Зацепка {n}/{total}',
      clueText: [
        'Курьер был здесь. Плова нет',
        'Пакет пустой, чек на плов',
        'Пахнет зирой. След тёплый',
        'Плов {sasha.gen} всё ещё ищут всем офисом',
        'Свидетели видели казан',
      ],
      lastClue: 'Казан где-то {where}',
      hintLabel: 'Плов',
      hint: 'Сегодня плов ищут {where}',
      hintKazan: 'Казан ждёт {where}',
      hintDone: 'Плов найден. Олды помнят',
      kazanMin: 60,
      kazanLabel: 'ПЛОВ НАЙДЕН +1 ЧАС',
      check: ['#1462'],
      ref: ['#1462', '#265', '#2765', 'мем №7'],
    },
    mordor: { name: 'Дошёл до горы', toast: 'Дружно дошли до горы, как Фродо', desc: 'Пройти весь путь в Мордор', kind: 'quest', goal: 2000000, ref: ['#2398', '#2421'] },
    ducks: { name: 'Все уточки KTS', toast: 'Все уточки KTS в сборе. Ждём мерч!', desc: 'Собрать всех уточек', kind: 'quest', ref: ['#1732', '#2896'] },
    vivi: { name: 'Королева непобедима', toast: 'Королева Виви непобедима', desc: 'Довести счёт Виви против пылесоса до 10:0', kind: 'quest', goal: 10, ref: ['#3192', '#2914'] },

    twoDenis: {
      name: 'Ещё один {denis.nom}',
      toast: 'К нам присоединился ещё один {denis.nom}. Странно как-то',
      desc: 'Подобрать два торта за один забег',
      kind: 'action',
      people: ['denis'],
      cakes: 2,
      check: ['#479'],
      ref: ['#479', '#521', 'мем №1'],
    },
    botBug: { name: 'Злючка-бот словил баг', toast: 'Сбой в матрице: милое предсказание', desc: 'Застать бота-токсика добрым', kind: 'action', ref: ['#1808', '#2446', '#3124', 'мем №3'] },
    vyvezli: {
      name: 'Было сложно, но мы вывезли',
      toast: 'Тимлид позади, all-hands закрыт. Было сложно, но мы вывезли',
      desc: 'Сбежать от тимлида и закрыть all-hands за один забег',
      kind: 'action',
      ref: ['#3696', '#2213'],
    },
  });

  K.add('achievements', {
    plovFound: { name: 'Плов найден', desc: 'Олды помнят', group: 'secrets', icon: 'kazan', secret: true, people: ['sasha'], ref: ['#1462'] },
  });

  K.add('eggs', {
    where: {
      kitchen: 'на кухне',
      metro: 'в метро',
      office: 'в офисе',
      baikal: 'в «Байкале»',
      roof: 'на крыше',
      bedroom: 'дома',
      dream: 'во сне',
      living: 'на диване',
    },
    route: {
      gm: [0, 60, 144, 192, 240, 360, 480, 660, 900, 1260],
      id: ['living:morning', 'kitchen', 'living:noon', 'metro', 'office', 'baikal', 'roof', 'bedroom', 'dream', 'living:dawn'],
    },
    ui: { toastKind: 'info', toastSec: 4 },
  });
})();
