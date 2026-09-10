# SPEC 03: Power Pellets y Modo Asustado (Frightened Mode)

**Estado:** Implemented  
**Fecha:** 2026-09-10  
**Depende de:** SPEC 01, SPEC 02  

**Objetivo:** Implementar las cuatro Power Pellets en las esquinas del laberinto para permitir a Pac-Man activar el modo asustado, ralentizar a los fantasmas, devorarlos con puntuación progresiva y retornar sus ojos a la casa.

---

## 1. Alcance (Scope)

### Dentro del alcance (In Scope)
- **Definición de Power Pellets en el laberinto:**
  - 4 píldoras de poder situadas en las esquinas clásicas: `(1, 3)`, `(26, 3)`, `(1, 23)` y `(26, 23)`.
  - Representadas con el carácter `'o'` en `MAZE_STR` y parseadas con el valor de celda `4`.
  - Contabilizadas en `dotsRemaining` para la condición de victoria.
- **Consumo y puntuación de Power Pellet:**
  - Otorga 50 puntos al ser comida por Pac-Man.
  - Activa o reinicia el temporizador de modo asustado a 360 frames (~6 segundos a 60 fps).
  - Reinicia la racha de fantasmas devorados (`ghostsEatenStreak = 0`).
- **Comportamiento en Modo Asustado (`frightened`):**
  - Todo fantasma activo invierte inmediatamente su dirección de avance (giro de 180° si es transitable).
  - La velocidad de movimiento de los fantasmas asustados se reduce al 50% de su velocidad base (`~0.05` celdas/frame).
  - En cada intersección, el fantasma asustado elige una dirección válida de forma aleatoria (sin retroceder sobre su paso).
- **Señales visuales y animación:**
  - Las Power Pellets se dibujan con un radio mayor que los dots normales (radio ~5-6 px) y una animación de pulso/parpadeo.
  - Durante el modo asustado, los fantasmas toman color azul oscuro arcade (`#2121ff`).
  - Durante los últimos 120 frames (~2 segundos), los fantasmas parpadean alternando entre azul y blanco (`#ffffff`) para advertir que el efecto terminará.
- **Mecánica de devorar fantasmas y estado de ojos (`eaten`):**
  - Colisión Pac-Man vs fantasma `frightened`: Pac-Man no sufre daño y devora al fantasma.
  - Puntuación progresiva por racha en la misma píldora: 200 pts (1º), 400 pts (2º), 800 pts (3º) y 1600 pts (4º).
  - El fantasma devorado pasa al estado `'eaten'`, renderizándose únicamente como un par de ojos.
  - En estado `'eaten'`, la velocidad aumenta (ej. `0.2` celdas/frame) y navega hacia la puerta de la casa `(13, 12)` o `(14, 12)`, permitiendo el paso hacia abajo (`down`) a través de la puerta para reingresar a la casa.
  - Al alcanzar el interior de la casa `(y >= 14)`, se regenera su cuerpo y se reincorpora al ciclo de salida (SPEC 02).
- **Restauración y fin de efecto:**
  - Al agotarse el temporizador (`frightenedTimer === 0`), los fantasmas que permanezcan en `frightened` regresan a su color original, velocidad normal y estado `active` con sus respectivas personalidades de IA.

### Fuera del alcance (Out of Scope)
- Efectos de sonido y pistas de audio.
- Pausa/congelamiento momentáneo de frames (*freeze frame*) al devorar un fantasma.
- Frutas o items de bonificación secundarios.

---

## 2. Modelo de Datos (Data Model)

### Modificaciones en `src/js/maze.js`
```javascript
// Valor de celda: 4 = power pellet
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' ) return 4;
  return 0;
}
```

Ubicaciones en `MAZE_STR`:
- Fila 3: Columnas 1 y 26 reemplazan `.` por `o`.
- Fila 23: Columnas 1 y 26 reemplazan `.` por `o`.

### Modificaciones en el Estado de Juego (`src/js/game.js`)
```javascript
// Propiedades en objeto retornado por createGame()
{
  ...
  frightenedTimer: 0,       // Cuenta regresiva de frames para el modo asustado
  ghostsEatenStreak: 0,     // Conteo de fantasmas comidos en el ciclo actual (0 a 4)
  ...
}

// Estructura de cada fantasma
{
  id: string,
  kind: 'hunter' | 'ambusher' | 'flanker' | 'shy',
  color: string,
  x: number,
  y: number,
  dir: 'up' | 'down' | 'left' | 'right',
  speed: number,
  baseSpeed: number,        // Velocidad nominal para restaurar tras modo asustado
  state: 'waiting' | 'exiting' | 'active' | 'frightened' | 'eaten',
  timer: number
}
```

---

## 3. Plan de Implementación (Implementation Plan)

1. **Configuración de celdas en `src/js/maze.js`**:
   - Agregar el token `'o'` en las 4 esquinas de `MAZE_STR`.
   - Actualizar `parseTile` para retornar `4` al encontrar `'o'`.
2. **Estado global del modo asustado en `src/js/game.js`**:
   - Almacenar `baseSpeed` en cada fantasma al inicializar la partida.
   - En `movePacman`, si la celda es `4` (Power Pellet):
     - Limpiar celda a `0`.
     - Sumar 50 puntos y decrementar `dotsRemaining`.
     - Establecer `game.frightenedTimer = 360` y `game.ghostsEatenStreak = 0`.
     - Para cada fantasma en estado `'active'`, cambiar su estado a `'frightened'`, reducir su velocidad a `g.baseSpeed * 0.5` e invertir su dirección actual si la casilla opuesta no es muro.
3. **Lógica de movimiento e IA de fantasmas asustados y devorados en `src/js/game.js`**:
   - Fantasmas en `'frightened'`: en cada intersección seleccionar aleatoriamente entre las direcciones posibles excepto la opuesta a la actual.
   - Fantasmas en `'eaten'`: objetivo fijo en la entrada/interior de la casa `(13, 14)` a velocidad aumentada (`0.2`). Permitir cruzar la puerta del pen hacia abajo (`isWall` debe permitir `dir === 'down'` si `actor === 'ghost_eaten'`). Al llegar al interior de la casa, volver al estado `'exiting'`.
   - Decrementar `game.frightenedTimer` cada frame. Cuando llegue a `0`, restaurar a velocidad `baseSpeed`, estado `'active'` y color original a todos los fantasmas que continúen en `'frightened'`.
4. **Colisiones y puntuación progresiva en `src/js/game.js`**:
   - En el bucle de colisiones de `update(game)`:
     - Si colisiona con fantasma en `'frightened'`:
       - Incrementar `game.ghostsEatenStreak++`.
       - Sumar puntuación progresiva: `200 * Math.pow(2, game.ghostsEatenStreak - 1)` (200, 400, 800, 1600).
       - Cambiar estado del fantasma a `'eaten'`.
     - Si colisiona con fantasma en `'eaten'`: ignorar colisión (no causa daño).
     - Si colisiona con fantasma en `'active'`: Pac-Man pierde una vida y se reinician posiciones.
5. **Renderizado visual en `src/js/render.js`**:
   - Dibujar Power Pellets (celda `4`) con radio mayor y variación de radio / parpadeo dependiente del `frame`.
   - Dibujar fantasmas en `'frightened'`: cuerpo azul (`#2121ff`), y si `frightenedTimer < 120`, alternar con blanco (`#ffffff`) según `Math.floor(frame / 10) % 2 === 0`. Ojos simplificados (blancos con pupilas azules).
   - Dibujar fantasmas en `'eaten'`: omitir cuerpo y falda; dibujar únicamente las pupilas y globos oculares apuntando hacia la dirección de avance.

---

## 4. Criterios de Aceptación (Acceptance Criteria)

- [x] Las 4 Power Pellets existen en `(1, 3)`, `(26, 3)`, `(1, 23)` y `(26, 23)` y se dibujan con mayor tamaño y animación intermitente.
- [x] Comer una Power Pellet incrementa el marcador en 50 puntos y decrementa `dotsRemaining`.
- [x] Comer una Power Pellet inicia `frightenedTimer = 360` y coloca a los fantasmas activos en estado `'frightened'`.
- [x] Los fantasmas asustados reducen su velocidad a la mitad e invierten su sentido de marcha si es posible.
- [x] En las intersecciones, los fantasmas asustados eligen una dirección aleatoria válida sin dar marcha atrás directa.
- [x] Durante los últimos 120 frames (~2 segundos), los fantasmas asustados parpadean alternando entre azul y blanco.
- [x] Colisionar con un fantasma asustado otorga puntos progresivos (200, 400, 800, 1600) y no resta vidas a Pac-Man.
- [x] El fantasma devorado se convierte en ojos (`'eaten'`), viaja de regreso al interior de la casa y renace recuperando su cuerpo.
- [x] Al finalizar los 360 frames, los fantasmas asustados que no fueron comidos retornan a su velocidad base, color y comportamiento normal de IA.
- [x] Si Pac-Man pierde una vida contra un fantasma activo, se cancela el modo asustado y se restablecen las posiciones.

---

## 5. Decisiones Tomadas y Descartadas (Decisions)

- **Duración de 6 segundos con parpadeo final de 2 segundos:** Proporciona una ventana de oportunidad justa y predecible para el jugador idéntica a la fórmula arcade.
- **Giros aleatorios en intersecciones:** Descartado el cálculo euclidiano de escape porque frecuentemente atrapa a los fantasmas en esquinas cerradas; la selección aleatoria produce el comportamiento clásico de evasión impredecible.
- **Retorno de ojos a la casa:** Descartada la eliminación o congelamiento estático; el ciclo de retorno dinámico en estado de ojos respeta la mecánica fundamental de Pac-Man.
- **Puntuación exponencial (200 -> 1600):** Se descartó la puntuación fija para premiar la habilidad del jugador de encadenar capturas en una misma racha.

---

## 6. Riesgos Identificados (Risks)

- **Paso a través de la puerta del pen:** La regla unidireccional de la SPEC 02 bloquea el movimiento hacia abajo en la fila 12. La función de validación de muros debe permitir expresamente a los fantasmas en estado `'eaten'` descender por la puerta para alcanzar el interior de la casa.
- **Cálculo de victoria (`dotsRemaining`):** Se debe garantizar que el conteo inicial en `createGame` sume tanto las celdas de tipo `2` (dots) como las de tipo `4` (power pellets), evitando que el juego quede bloqueado sin poder ganar.
