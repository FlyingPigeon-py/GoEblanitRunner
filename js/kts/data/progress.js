/* KTS-данные пакета П4: скины, ачивки, коллекции «Личного дела», Мордор, грейды. Только данные, без логики. */
(() => {
  'use strict';
  const K = window.G.kts;
  if (!K) return;

  // Новые скины. bunny.js рисует trusy и duck; открытие — G.kts.skin(id).
  K.add('skins', {
    trusy: {
      ref: ['#1107', '#1351', '#1491', '#2420'],
      check: ['#1351', '#1491'],
      name: 'Трусы KTS',
      desc: 'Оцените этот божественный дизайн 🤌',
      cond: 'Вручают в ноябре на ДР KTS. Или если очень хочется',
      legendary: true,
      tag: 'легенда',
      color: '#2fae5f',
      gift: { event: 'ktsBirthday', line: ['Вручение трусов из новой не секретной коллекции'] },
    },
    duck: {
      ref: ['#1732', '#2896'],
      name: 'Уточка',
      desc: 'Надувной круг для тех, кто нашёл всех',
      cond: 'Найти все уточки KTS',
      allOf: 'duck',
      legendary: true,
      tag: 'легенда',
    },
  });

  // Правки существующих скинов: имя, описание и вид.
  K.add('skinLook', {
    hoodie: {
      ref: ['#578'],
      check: ['#578'],
      name: 'Чёрная толстовка KTS',
      desc: 'Приключения чёрной толстовки продолжаются',
      fabric: 'black',
      logo: 'kts',
      logoColor: '#3ecf6e',
    },
  });

  // Ачивки П4. counter/goal — открываются сами, когда счётчик G.kts дорастает до цели (per — делитель, unit — подпись).
  K.add('achievements', {
    denis1: {
      ref: ['#226'],
      check: ['#226'],
      people: ['denis'],
      group: 'denis',
      icon: 'cake',
      counter: 'denis',
      goal: 1,
      name: 'Часть корпоративной культуры',
      desc: 'Поймать торт и поздравить {denis.acc}. Бросьте все дела',
    },
    denis10: {
      ref: ['#517'],
      check: ['#517'],
      people: ['denis'],
      group: 'denis',
      icon: 'cake',
      counter: 'denis',
      goal: 10,
      name: 'Это не учения!',
      desc: 'Поздравить {denis.acc} 10 раз. День рождения у него каждый день',
    },
    denis48: {
      ref: ['#517', '#521'],
      check: ['#521'],
      people: ['denis'],
      group: 'denis',
      glyph: '48',
      counter: 'denis',
      goal: 48,
      name: 'Круг дней рождений',
      desc: '48 поздравлений — необходимое и достаточное условие для работы в KTS',
    },
    mordor10: {
      ref: ['#2398'],
      group: 'mordor',
      icon: 'mountain',
      counter: 'mordor',
      per: 2000,
      goal: 10,
      unit: 'км',
      name: 'Часть братства',
      desc: 'Протопать 10 км в сторону горы',
    },
    mordor500: {
      ref: ['#3629'],
      group: 'mordor',
      glyph: '500',
      counter: 'mordor',
      per: 2000,
      goal: 500,
      unit: 'км',
      name: 'Полпути к горе',
      desc: '500 км позади. Назад теперь так же далеко, как вперёд',
    },
    frogs1: {
      ref: ['#1925'],
      check: ['#1925'],
      group: 'frogs',
      icon: 'frog',
      counter: 'frogs',
      goal: 1,
      name: 'Посмотрел на жабоньку',
      desc: 'Поймать жабу среды. Вдохнуть, выдохнуть',
    },
    frogs10: {
      ref: ['#3115'],
      group: 'frogs',
      icon: 'frog',
      counter: 'frogs',
      goal: 10,
      name: 'Десять сред спокойствия',
      desc: '10 жаб среды в коллекции. До 101 — всего ничего',
    },
  });

  // Вкладка «Коллекции» в «Личном деле». kind: found — находки G.kts, counter — счётчик, score — счёт, mordor — путь.
  K.add('collections', {
    ducks: { order: 10, kind: 'found', of: 'duck', section: 'ducks', icon: 'duck', title: 'Уточки KTS', sub: 'Прячутся по всему маршруту дня' },
    secrets: { order: 20, kind: 'found', of: 'secret', section: 'secrets', icon: 'question', title: 'Найдено секреток', sub: 'Подсказок не будет' },
    mordor: { ref: ['#2398', '#2421'], order: 30, kind: 'mordor', icon: 'mountain', title: 'Путь в Мордор', unit: 'км' },
    frogs: { ref: ['#3115'], order: 40, kind: 'counter', counter: 'frogs', goal: 101, icon: 'frog', title: 'Жабы среды', sub: 'Одна жаба за среду' },
    denis: {
      ref: ['#517'],
      check: ['#517'],
      people: ['denis'],
      order: 50,
      kind: 'counter',
      counter: 'denis',
      icon: 'cake',
      title: 'Поздравлено Денисов',
      sub: 'В каждом дне есть восход, закат и день рождения {denis.gen}',
    },
    vivi: { ref: ['#3192', '#2914'], order: 60, kind: 'score', counter: 'vivi', start: 2, icon: 'crown', title: 'Королева Виви', text: 'Виви {n}:0 Пылесос' },
  });

  K.add('progress', {
    mordor: {
      ref: ['#2398', '#2421'],
      check: ['#2421'],
      unitsPerKm: 2000,
      goalKm: 1000,
      windowDays: 14,
      secret: 'mordor',
      start: ['Дружно идём к горе'],
      left: ['Осталось топать всего-то {n} {unit}'],
      stalled: ['Братство на привале. Гора подождёт'],
      done: ['Дошли до горы. Братство гордится'],
      units: { year: ['год', 'года', 'лет'], month: ['месяц', 'месяца', 'месяцев'], day: ['день', 'дня', 'дней'] },
    },
    // Подборы, после которых растёт счётчик, если владелец пикапа сам его не посчитал. perDay — не чаще раза в реальный день.
    counts: {
      ref: ['#517', '#3115'],
      byPickup: { cake: { counter: 'denis' }, frog: { counter: 'frogs', perDay: true }, toad: { counter: 'frogs', perDay: true } },
    },
  });

  // Грейды спринта: idx — номер ступени в лестнице meta, name — новое имя, cheer — тост при повышении.
  K.add('grades', {
    intern: { ref: ['#149', '#1833'], idx: 0, name: 'Стажёр Metaclass' },
    up: { cheer: ['Мощного роста!'] },
    lead: { ref: ['#3005'], check: ['#3005'], idx: 4, cheer: ['Поздравляем… или сочувствуем 🤭'] },
  });
})();
