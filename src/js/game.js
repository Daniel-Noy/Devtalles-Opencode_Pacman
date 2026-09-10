// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightenedTimer: 0,
    ghostsEatenStreak: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      id: g.id,
      kind: g.kind,
      color: g.color,
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: g.speed,
      baseSpeed: g.speed,
      state: g.releaseTimer === 0 ? 'exiting' : 'waiting',
      timer: g.releaseTimer,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1), y por puerta (3) si no es hacia arriba
function isWall( grid, x, y, actor, dir ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) {
    if ( actor === 'pacman' ) return true;
    if ( actor === 'ghost_eaten' && dir === 'down' ) return false;
    if ( dir !== 'up' ) return true;
  }
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor, dir );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      game.frightenedTimer = 360;
      game.ghostsEatenStreak = 0;
      for ( const g of game.ghosts ) {
        if ( g.state === 'active' || g.state === 'frightened' ) {
          g.state = 'frightened';
          g.speed = g.baseSpeed * 0.5;
          const opp = OPPOSITE[ g.dir ];
          if ( opp && canMove( grid, Math.round( g.x ), Math.round( g.y ), opp, 'ghost' ) ) {
            g.dir = opp;
          }
        }
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function getGhostTargetTile( game, ghost ) {
  if ( ghost.state === 'eaten' ) {
    return { x: 13, y: 14 };
  }

  const pacman = game.pacman;
  const px = Math.round( pacman.x );
  const py = Math.round( pacman.y );
  const pDir = DIRS[ pacman.dir ] || { x: 0, y: 0 };

  switch ( ghost.kind ) {
    case 'hunter':
      return { x: px, y: py };

    case 'ambusher':
      return {
        x: px + pDir.x * 4,
        y: py + pDir.y * 4,
      };

    case 'flanker': {
      const blinky = game.ghosts.find( ( g ) => g.kind === 'hunter' ) || ghost;
      const aheadX = px + pDir.x * 2;
      const aheadY = py + pDir.y * 2;
      const bx = Math.round( blinky.x );
      const by = Math.round( blinky.y );
      return {
        x: 2 * aheadX - bx,
        y: 2 * aheadY - by,
      };
    }

    case 'shy': {
      const dist = Math.abs( ghost.x - pacman.x ) + Math.abs( ghost.y - pacman.y );
      if ( dist > 8 ) {
        return { x: px, y: py };
      }
      return { x: 0, y: 30 };
    }

    default:
      return { x: px, y: py };
  }
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const actor = g.state === 'eaten' ? 'ghost_eaten' : 'ghost';
  const gx = Math.round( g.x );
  const gy = Math.round( g.y );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, gx, gy, dir, actor )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  if ( g.state === 'frightened' ) {
    const randomIndex = Math.floor( Math.random() * choices.length );
    g.dir = choices[ randomIndex ];
    return;
  }

  const target = getGhostTargetTile( game, g );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = gx + d.x;
    const ny = gy + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveWaitingGhost( g ) {
  g.timer--;
  if ( g.timer <= 0 ) {
    g.state = 'exiting';
    return;
  }

  const speed = g.speed * 0.5;
  if ( g.dir === 'up' ) {
    g.y -= speed;
    if ( g.y <= 13.5 ) {
      g.y = 13.5;
      g.dir = 'down';
    }
  } else {
    g.y += speed;
    if ( g.y >= 14.5 ) {
      g.y = 14.5;
      g.dir = 'up';
    }
  }
}

function moveExitingGhost( game, g ) {
  const targetX = g.x <= 13.5 ? 13 : 14;

  if ( Math.abs( g.x - targetX ) > 1e-3 ) {
    if ( Math.abs( g.y - 14 ) > 1e-3 ) {
      const dy = 14 - g.y;
      const stepY = Math.sign( dy ) * Math.min( g.speed, Math.abs( dy ) );
      g.y += stepY;
      g.dir = stepY > 0 ? 'down' : 'up';
      return;
    }
    g.y = 14;
    const dx = targetX - g.x;
    const stepX = Math.sign( dx ) * Math.min( g.speed, Math.abs( dx ) );
    g.x += stepX;
    g.dir = stepX > 0 ? 'right' : 'left';
    return;
  }

  g.x = targetX;
  g.dir = 'up';
  g.y -= g.speed;

  if ( g.y <= 11 ) {
    g.y = 11;
    g.state = 'active';
    decideGhost( game, g );
  }
}

function moveGhost( game, g ) {
  if ( g.state === 'waiting' ) {
    moveWaitingGhost( g );
    return;
  }
  if ( g.state === 'exiting' ) {
    moveExitingGhost( game, g );
    return;
  }

  const actor = g.state === 'eaten' ? 'ghost_eaten' : 'ghost';
  const grid = game.grid;
  const width = grid[ 0 ].length;
  let remaining = g.speed;

  while ( remaining > 0 ) {
    const d = DIRS[ g.dir ];
    let distToNextTile;
    let nextTile;

    if ( d.x !== 0 ) {
      nextTile = d.x > 0 ? Math.floor( g.x + 1 ) : Math.ceil( g.x - 1 );
      distToNextTile = Math.abs( nextTile - g.x );
    } else {
      nextTile = d.y > 0 ? Math.floor( g.y + 1 ) : Math.ceil( g.y - 1 );
      distToNextTile = Math.abs( nextTile - g.y );
    }

    if ( distToNextTile <= remaining + 1e-5 ) {
      if ( d.x !== 0 ) {
        g.x = nextTile;
        g.y = Math.round( g.y );
      } else {
        g.y = nextTile;
        g.x = Math.round( g.x );
      }
      wrapTunnel( g, width );
      remaining = Math.max( 0, remaining - distToNextTile );

      if ( g.state === 'eaten' && g.y >= 14 && g.x >= 12 && g.x <= 15 ) {
        g.y = 14;
        g.x = Math.round( g.x );
        g.state = 'exiting';
        g.speed = g.baseSpeed;
        return;
      }

      decideGhost( game, g );

      if ( !canMove( grid, g.x, g.y, g.dir, actor ) ) {
        break;
      }
    } else {
      g.x += d.x * remaining;
      g.y += d.y * remaining;
      wrapTunnel( g, width );

      if ( g.state === 'eaten' && g.y >= 14 && g.x >= 12 && g.x <= 15 ) {
        g.y = 14;
        g.x = Math.round( g.x );
        g.state = 'exiting';
        g.speed = g.baseSpeed;
        return;
      }

      remaining = 0;
    }
  }
}

function resetPositions( game ) {
  game.frightenedTimer = 0;
  game.ghostsEatenStreak = 0;
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    const start = GHOST_STARTS[ i ];
    g.x = start.x;
    g.y = start.y;
    g.dir = 'up';
    g.speed = start.speed;
    g.baseSpeed = start.speed;
    g.state = start.releaseTimer === 0 ? 'exiting' : 'waiting';
    g.timer = start.releaseTimer;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  if ( game.frightenedTimer > 0 ) {
    game.frightenedTimer--;
    if ( game.frightenedTimer === 0 ) {
      for ( const g of game.ghosts ) {
        if ( g.state === 'frightened' ) {
          g.state = 'active';
          g.speed = g.baseSpeed;
        }
      }
    }
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      if ( g.state === 'frightened' ) {
        game.ghostsEatenStreak++;
        const points = 200 * Math.pow( 2, game.ghostsEatenStreak - 1 );
        game.score += points;
        g.state = 'eaten';
        g.speed = 0.2;
        decideGhost( game, g );
      } else if ( g.state !== 'eaten' ) {
        game.lives--;
        if ( game.lives <= 0 ) {
          game.state = 'lost';
          return;
        }
        resetPositions( game );
        break;
      }
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.getGhostTargetTile = getGhostTargetTile;
