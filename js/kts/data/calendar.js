/* Даты KTS. Окна в формате 'MM-DD'. Возраст компании считается от founded, не хардкодится. */
(() => {
  'use strict';
  const K = window.G.kts;
  if (!K) return;

  K.add('calendar', {
    ktsBirthday: { month: 11, day: 9, founded: 2015, from: '11-01', to: '11-30', why: 'ДР KTS 9 ноября, в 2025-м исполнилось 10 (#2835)' },
    ktsBirthdayGifts: { from: '11-09', to: '11-28', why: 'три подарка, туса 28-го (#1491)' },
    halloween: { from: '10-25', to: '10-31', why: 'Хэллоуин (05)' },
    newYear: { from: '12-01', to: '01-10', why: 'Котзилла на страже Нового года (#1669)' },
    lastWednesdayOfYear: { from: '12-25', to: '12-31', why: 'финальная жаба года (#1690)' },
  });
})();
