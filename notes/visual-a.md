# visual-a — мир и маршрут (scene.js, loc-day.js)

Статус: каркас в работе. `G.registerLocation` и `G.sceneKit` уже есть, их можно звать при загрузке `loc-*.js`.

## id локаций маршрута

| id | кто | вариант |
|---|---|---|
| `living` | A (scene.js) | `morning` / `noon` / `dawn` |
| `kitchen` | A (loc-day.js) | |
| `office` | A (loc-day.js) | |
| `baikal` | A (loc-day.js) | |
| `metro` | C (loc-out.js) | |
| `roof` | C (loc-out.js) | |
| `bedroom` | B (loc-night.js) | |
| `dream` | B (loc-night.js) | |

Маршрут ищет локацию по id; если id другой, сработают синонимы (`subway`, `rooftop`, `home`/`spalnya`, `sleep`/`hole`), но лучше взять id из таблицы.
