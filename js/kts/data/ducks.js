/* KTS-данные пакета П6: уточки KTS. Только данные, без логики. Спойлеры — в ../kts_out/SECRETS.md. */
(() => {
  'use strict';
  const K = window.G.kts;
  if (!K) return;

  // how: start — тап на стартовом экране; ride — сидит на препятствии или пикапе, берётся вместе с ним («Отложить» или подбор);
  // arc / double — вершина одиночного / двойного прыжка; under — под высоким созвоном; fever — в ЕБЛАН-РЕЖИМЕ;
  // escape — после побега от тимлида; legend — легендарная. loc — 'living', 'living:noon', 'kitchen' … как G.scene.loc.
  K.add('ducks', {
    startClock: { name: 'Дремлет на будильнике 11:56', how: 'start', ref: ['мем игры'] },
    startLamp: { name: 'Ночная, на люстре', how: 'start', when: { realNight: true }, ref: ['стартовые идеи'] },

    clockRide: { name: 'Верхом на будильнике', how: 'ride', ride: ['clock'], loc: ['living', 'kitchen'], chance: 0.3, ref: ['стартовые идеи'] },
    vacuumRide: { name: 'Верхом на роботе-пылесосе', how: 'ride', ride: ['vacuum', 'clock'], loc: ['living', 'office'], chance: 0.35, ref: ['#3192'] },
    cakeRide: {
      name: 'На торте {denis.gen}',
      how: 'ride',
      rideItem: 'cake',
      prop: 'balloon',
      loc: ['living', 'kitchen', 'metro', 'office', 'baikal'],
      chance: 0.25,
      people: ['denis'],
      ref: ['#517', 'мем №1'],
    },

    pot: { name: 'В кастрюле с пельмешками', how: 'arc', loc: ['kitchen'], prop: 'pot', chance: 0.35, ref: ['#445'] },
    mug: { name: 'В кружке с кофе', how: 'arc', loc: ['kitchen'], prop: 'mug', chance: 0.35, ref: ['#1630'] },
    chandelier: { name: 'На люстре', how: 'double', loc: ['living:morning', 'living:noon'], minT: 6, prop: 'chandelier', chance: 0.35, ref: ['стартовые идеи'] },
    handrail: { name: 'На поручне в метро', how: 'double', loc: ['metro'], prop: 'handrail', chance: 0.4, ref: ['маршрут дня'] },
    monitor: { name: 'За монитором', how: 'arc', loc: ['office'], prop: 'monitor', chance: 0.4, ref: ['стартовые идеи'] },
    windowCloud: { name: 'В облаке за окном', how: 'double', loc: ['office'], prop: 'windowCloud', chance: 0.35, ref: ['стартовые идеи'] },
    underCall: { name: 'На созвоне без камеры', how: 'under', loc: ['office', 'baikal'], chance: 0.3, ref: ['#262', '#2511'] },
    portrait: { name: 'Уточка месяца', how: 'arc', loc: ['baikal'], prop: 'portrait', chance: 0.35, ref: ['Гордость недели'] },
    cloud: { name: 'В облаке над крышей', how: 'double', loc: ['roof'], prop: 'cloud', chance: 0.35, ref: ['#1040'] },
    balloon: { name: 'На воздушном шарике', how: 'arc', loc: ['roof'], prop: 'balloon', chance: 0.35, ref: ['#2905'] },
    box: { name: 'В коробке вместо кота', how: 'arc', loc: ['bedroom'], prop: 'box', chance: 0.4, ref: ['мем №12'] },
    moon: { name: 'На луне за окном', how: 'double', loc: ['bedroom'], prop: 'windowMoon', when: { night: true }, chance: 0.4, ref: ['ночь'] },
    dreamCloud: { name: 'Во сне, на облаке', how: 'double', loc: ['dream'], prop: 'cloud', chance: 0.4, ref: ['стартовые идеи'] },
    sheep: { name: 'Считает овец', how: 'arc', loc: ['dream'], prop: 'sheep', chance: 0.4, ref: ['сон'] },
    dawn: { name: 'В первом луче рассвета', how: 'arc', loc: ['living:dawn'], prop: 'windowSun', chance: 0.5, ref: ['рассвет'] },

    umbrella: { name: 'Под зонтиком', how: 'arc', prop: 'umbrella', when: { rain: true }, chance: 0.5, ref: ['#315'] },
    wednesday: { name: 'В гостях у жабоньки', how: 'arc', loc: ['living', 'office', 'baikal'], prop: 'frogPoster', when: { wednesday: true }, chance: 0.5, ref: ['#1925', 'мем №10'] },
    disco: { name: 'На диско-шаре', how: 'fever', prop: 'disco', chance: 0.35, ref: ['#2213'] },
    pocket: { name: 'У тимлида в кармане', how: 'escape', look: 'badge', chance: 0.5, ref: ['стартовые идеи'] },

    legend: {
      name: 'Мега-крутая уточка с горящей ж...',
      how: 'legend',
      look: 'legend',
      legendary: true,
      chance: 0.2,
      need: 8,
      saturdayK: 2,
      toast: ['Мега-крутая уточка с горящей ж... Ждём мерч!'],
      check: ['#1732'],
      ref: ['#1732', '#2213'],
    },
  });

  K.add('achievements', {
    ducks5: { name: 'Утиная стая', desc: 'Найти 5 уточек KTS', group: 'ducks', icon: 'duck' },
    ducks12: { name: 'Резиновая отладка', desc: 'Найти 12 уточек. Отличные слушатели', group: 'ducks', icon: 'duck', ref: ['#2896'] },
    ducksAll: { name: 'Все уточки KTS', desc: 'Собрать всех уточек', group: 'ducks', icon: 'duck', secret: true },
    duckLegend: { name: 'Ждём мерч!', desc: 'Поймать мега-крутую уточку', group: 'ducks', icon: 'duck', secret: true, ref: ['#1732'] },
  });

  K.add('eggs', {
    ducks: {
      newMin: 10,
      repeatMin: 5,
      repeatChance: 0.1,
      maxPerRun: 3,
      gap: 8,
      minT: 10,
      earliest: 6,
      settle: 2,
      minLeft: 5,
      achs: [[5, 'ducks5'], [12, 'ducks12']],
      popup: 'УТОЧКА!',
      legendSec: 4,
      escapeLabel: 'ИЗ КАРМАНА',
    },
  });
})();
