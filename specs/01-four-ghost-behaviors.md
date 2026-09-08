# SPEC 01: Cuatro Fantasmas con Comportamientos e IA Únicas

**Estado:** Implemented 
**Fecha:** 2026-09-08  
**Depende de:** Ninguno  

**Objetivo:** Implementar cuatro fantasmas con personalidades e inteligencias artificiales diferenciadas (perseguidor agresivo, emboscador, flanqueador y tímido), velocidades personalizadas y posiciones iniciales dentro de la casa de fantasmas.

---

## 1. Alcance (Scope)

### Dentro del alcance (In Scope)
- Definición de 4 fantasmas con identidades y colores clásicos:
  - **Blinky (Rojo / `hunter`)**: Persigue agresiva y directamente la posición actual de Pac-Man.
  - **Pinky (Rosa / `ambusher`)**: Intenta emboscar a Pac-Man apuntando a 4 casillas por delante de la dirección actual de Pac-Man.
  - **Inky (Cian / `flanker`)**: Estrategia de flanqueo calculando una posición intermedia/vectorial entre Pac-Man y Blinky.
  - **Clyde (Naranja / `shy`)**: Persigue a Pac-Man si está a más de 8 casillas de distancia; si está a 8 o menos casillas, se retira a su esquina inferior izquierda.
- Velocidades diferenciadas por fantasma: Blinky ligeramente más rápido (`0.11` celdas/frame) frente al resto (`0.095` - `0.1` celdas/frame).
- Posicionamiento inicial de los 4 fantasmas dentro de la casa (*ghost pen*) en las coordenadas `(12,14)`, `(13,14)`, `(14,14)` y `(15,14)`.
- Detección de colisiones, reinicio de posiciones tras perder vida y renderizado visual para los 4 fantasmas.

### Fuera del alcance (Out of Scope)
- Modo asustado (*frightened*) con Power Pellets / píldoras de poder (se definirá en una spec separada de powerups).
- Cola de salida temporizada compleja para la casa de fantasmas (los fantasmas navegan y salen por la puerta de forma natural).
- Sistema de puntuación por comer fantasmas.

---

## 2. Modelo de Datos (Data Model)

### Configuración en `src/js/maze.js`
```javascript
const GHOST_STARTS = [
  { id: 'blinky', color: '#ff0000', kind: 'hunter',   x: 13, y: 14, speed: 0.11 },
  { id: 'pinky',  color: '#ffb8ff', kind: 'ambusher', x: 14, y: 14, speed: 0.095 },
  { id: 'inky',   color: '#00ffff', kind: 'flanker',  x: 12, y: 14, speed: 0.095 },
  { id: 'clyde',  color: '#ffb852', kind: 'shy',      x: 15, y: 14, speed: 0.095 },
];
```

### Estructura de Fantasma en `src/js/game.js`
```javascript
{
  id: string,
  kind: 'hunter' | 'ambusher' | 'flanker' | 'shy',
  color: string,
  x: number,
  y: number,
  dir: 'up' | 'down' | 'left' | 'right',
  speed: number
}
```

---

## 3. Plan de Implementación (Implementation Plan)

1. **Configuración de spawn (`src/js/maze.js`)**:
   - Actualizar `GHOST_STARTS` con las 4 definiciones completas (posiciones `x: 12..15, y: 14`, velocidades, tipos y colores).

2. **Lógica de IA y targeting (`src/js/game.js`)**:
   - Crear función pura `getGhostTargetTile(game, ghost)` que retorne `{ x, y }` objetivo según el tipo (`kind`):
     - `hunter`: Retorna `{ x: Math.round(pacman.x), y: Math.round(pacman.y) }`.
     - `ambusher`: Retorna la casilla a 4 posiciones adelante de la dirección de Pac-Man.
     - `flanker`: Calcula el punto reflejado a partir de la posición de Blinky y 2 casillas adelante de Pac-Man.
     - `shy`: Si la distancia Manhattan a Pac-Man > 8, persigue a Pac-Man; de lo contrario, apunta a la esquina `(0, 30)`.
   - Modificar `decideGhost(game, ghost)` para evaluar giros eligiendo la dirección no opuesta cuya distancia Manhattan al objetivo sea mínima.

3. **Ciclo de juego y colisiones (`src/js/game.js`)**:
   - Adaptar `createGame()` y `resetPositions()` para inicializar y restablecer los 4 fantasmas con sus propiedades individuales.
   - Mantener el loop de colisiones y decremento de vidas.

4. **Renderizado (`src/js/render.js`)**:
   - Asegurar que `drawGhost` utilice el color asignado a cada fantasma (`g.color`).

---

## 4. Criterios de Aceptación (Acceptance Criteria)

- [ ] Se instancian exactamente 4 fantasmas en el juego.
- [ ] Los 4 fantasmas inician dentro del pen en las columnas 12, 13, 14 y 15 de la fila 14.
- [ ] El fantasma rojo (Blinky) persigue directamente la casilla de Pac-Man y se desplaza ligeramente más rápido que los demás.
- [ ] El fantasma rosa (Pinky) se anticipa calculando su objetivo adelante de la dirección de Pac-Man.
- [ ] El fantasma cian (Inky) flanquea combinando la posición de Pac-Man y Blinky.
- [ ] El fantasma naranja (Clyde) persigue a Pac-Man a larga distancia y huye a su rincón cuando la distancia es <= 8 casillas.
- [ ] Cada fantasma se dibuja con su color representativo (Rojo, Rosa, Cian, Naranja).
- [ ] El contacto de Pac-Man con cualquiera de los 4 fantasmas reduce 1 vida y reinicia las posiciones correctamente.

---

## 5. Decisiones Tomadas y Descartadas (Decisions)

- **Tomada:** Comportamientos clásicos deterministas basados en casillas objetivo (*target tiles*) y distancia Manhattan, ya que proporcionan comportamientos reconocibles, limpios y testeables sin dependencias externas.
- **Tomada:** Blinky tiene mayor velocidad base para cumplir el requisito de persecución agresiva.
- **Descartada:** Modo asustado / *frightened* y temporizadores de cambio *Scatter/Chase*. Se dejan fuera para mantener la especificación enfocada y desacoplada del sistema de píldoras de poder.

---

## 6. Riesgos Identificados (Identified Risks)

- **Congestión en la puerta del pen:** Al iniciar 4 fantasmas en fila, podrían superponerse al cruzar la puerta `(13-14, 12)`. Dado que `isWall` permite el paso a los fantasmas a través de la puerta (tipo `3`) y el cálculo de distancia los orienta hacia arriba, cruzarán fluidamente.
