import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- Constants & Config ---
const GAME_WIDTH = 400;
const GAME_HEIGHT = 500;
const FPS = 60;
const GRAVITY = 0.4;
const JUMP_FORCE = -7;
const CLIMB_SPEED = 2;
const WALK_SPEED = 3;
const SNAPJAW_SPEED = 1.5;

// Colors
const COLORS = {
  BG: '#000000',
  VINE: '#00FF00',
  PLATFORM: '#FF00FF',
  JR: '#FFA500', // Orange
  PAPA: '#8B4513', // Brown
  SNAPJAW: '#0000FF', // Blue
  FRUIT: '#FFFF00', // Yellow
  TEXT: '#FFFFFF',
  WATER: '#000080'
};

// --- Game Logic ---

const DonkeyKongJr = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('TITLE'); // TITLE, PLAYING, PAUSED, GAMEOVER, LEVEL_COMPLETE
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('dkjr-highscore') || '0', 10));
  const [level, setLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Use refs for mutable game state to avoid closure staleness in the game loop
  const stateRef = useRef({
    jr: { x: 50, y: 430, dx: 0, dy: 0, w: 20, h: 20, state: 'IDLE', facing: 'RIGHT', onVine: false },
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Space: false },
    vines: [
      { x: 60, y1: 100, y2: 430 },
      { x: 120, y1: 100, y2: 350 },
      { x: 180, y1: 100, y2: 430 },
      { x: 260, y1: 100, y2: 250 },
      { x: 340, y1: 100, y2: 430 } 
    ],
    platforms: [
      { x: 0, y: 450, w: 100 },
      { x: 150, y: 450, w: 100 },
      { x: 300, y: 450, w: 100 },
      { x: 230, y: 250, w: 100 }, // Middle platform
      { x: 80, y: 350, w: 80 },
      { x: 0, y: 100, w: 400 } // Top (Cage level)
    ],
    enemies: [], // Array of Snapjaws
    fruits: [
      { x: 60, y: 150, active: true },
      { x: 180, y: 200, active: true },
      { x: 340, y: 120, active: true }
    ],
    key: { x: 180, y: 80, active: true }, // Key to save Papa
    papa: { x: 40, y: 60, w: 30, h: 30 },
    timer: 0,
    enemySpawnTimer: 0
  });

  // --- Input Handling ---
  const handleKeyDown = useCallback((e) => {
    if (stateRef.current.keys.hasOwnProperty(e.code) || e.code === 'Space') {
      stateRef.current.keys[e.code === 'Space' ? 'Space' : e.code] = true;
      e.preventDefault();
    }
    if (e.key === 'p' || e.key === 'P') togglePause();
  }, []);

  const handleKeyUp = useCallback((e) => {
    if (stateRef.current.keys.hasOwnProperty(e.code) || e.code === 'Space') {
      stateRef.current.keys[e.code === 'Space' ? 'Space' : e.code] = false;
    }
  }, []);

  const togglePause = () => {
    setGameState(prev => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  };

  const resetLevel = () => {
    const s = stateRef.current;
    s.jr = { x: 20, y: 430, dx: 0, dy: 0, w: 20, h: 20, state: 'IDLE', facing: 'RIGHT', onVine: false };
    s.enemies = [];
    s.fruits.forEach(f => f.active = true);
    s.key.active = true;
    s.timer = 0;
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    resetLevel();
    setGameState('PLAYING');
  };

  const toggleMute = () => setIsMuted(prev => !prev);

  // --- Game Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const gameLoop = () => {
      if (gameState === 'PLAYING') {
        update();
      }
      render(ctx);
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Start loop
    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, level]); // Re-bind if level or state changes fundamentally, though loop handles PAUSED internally

  // --- Update Logic ---
  const update = () => {
    const s = stateRef.current;
    const { keys, jr, vines, platforms } = s;

    // -- Player Movement --
    
    // Check if on vine
    let nearVine = null;
    vines.forEach(v => {
      if (Math.abs((jr.x + jr.w/2) - v.x) < 5 && jr.y >= v.y1 && jr.y <= v.y2 ) {
        nearVine = v;
      }
    });

    if (keys.ArrowUp && nearVine) {
      jr.onVine = true;
      jr.x = nearVine.x - jr.w/2; // Snap to vine
    }
    
    if (jr.onVine) {
      if (keys.ArrowUp) jr.y -= CLIMB_SPEED;
      if (keys.ArrowDown) jr.y += CLIMB_SPEED;
      // Dismount vine left/right
      if (keys.ArrowLeft) { jr.x -= 2; jr.onVine = false; }
      if (keys.ArrowRight) { jr.x += 2; jr.onVine = false; }
      
      // Check vine bounds
      if (nearVine) {
          if (jr.y < nearVine.y1) jr.y = nearVine.y1;
          if (jr.y > nearVine.y2) jr.y = nearVine.y2;
      } else {
          // If we clipped off the vine somehow
          jr.onVine = false;
      }
      jr.dy = 0; // suspend gravity
    } else {
      // Running
      if (keys.ArrowLeft) { jr.dx = -WALK_SPEED; jr.facing = 'LEFT'; }
      else if (keys.ArrowRight) { jr.dx = WALK_SPEED; jr.facing = 'RIGHT'; }
      else { jr.dx = 0; }

      // Jumping
      if (keys.Space && jr.grounded) {
        jr.dy = JUMP_FORCE;
        jr.grounded = false;
        // SFX here
      }

      // Physics
      jr.dy += GRAVITY;
      jr.x += jr.dx;
      jr.y += jr.dy;
    }

    // Platform Collisions
    jr.grounded = false;
    if (!jr.onVine) {
      platforms.forEach(p => {
        // Feet collision
        if (jr.dy >= 0 && 
            jr.y + jr.h <= p.y + jr.dy + 5 && // was above or just above
            jr.y + jr.h >= p.y - 5 && // is now at or below
            jr.x + jr.w > p.x && 
            jr.x < p.x + p.w) {
              jr.y = p.y - jr.h;
              jr.dy = 0;
              jr.grounded = true;
        }
      });
      // Floor collision
      if (jr.y + jr.h > GAME_HEIGHT) {
        jr.y = GAME_HEIGHT - jr.h;
        jr.dy = 0;
        jr.grounded = true;
      }
    }

    // Screen Bounds
    if (jr.x < 0) jr.x = 0;
    if (jr.x + jr.w > GAME_WIDTH) jr.x = GAME_WIDTH - jr.w;


    // -- Enemies AI (Snapjaws) --
    s.enemySpawnTimer++;
    if (s.enemySpawnTimer > 150 - (level * 10)) { // Spawn faster each level
      s.enemySpawnTimer = 0;
      // Spawn new enemy
      // Randomly pick a vine to spawn on top
      const spawnVine = vines[Math.floor(Math.random() * vines.length)];
      s.enemies.push({
        x: spawnVine.x - 10,
        y: spawnVine.y1,
        w: 20, 
        h: 15,
        type: 'SNAPJAW',
        vineIdx: vines.indexOf(spawnVine), // Track which vine
        dir: 1 // 1 = down, -1 = up
      });
    }

    s.enemies.forEach((en, idx) => {
        en.y += SNAPJAW_SPEED * en.dir;
        
        // Patrol bounds on vine
        const myVine = vines[en.vineIdx];
        if (en.y > myVine.y2) {
             // Reached bottom, maybe despawn or reverse? 
             // In DK Jr they fall off or go back up. Let's despawn for simplicity
             s.enemies.splice(idx, 1);
        }
        
        // Collision with player
        if (checkRectCollide(jr, en)) {
            handleDeath();
        }
    });

    // -- Fruit Mechanics --
    s.fruits.forEach(f => {
      // Check if Jr hits jumping fruit
      if (f.active && checkRectCollide(jr, {x: f.x, y: f.y, w: 20, h: 20})) {
        // Drop fruit
        f.falling = true;
        f.active = false; // Cannot be picked again
        addScore(100);
      }
      
      if (f.falling) {
        f.y += 5;
        // Kill enemies
        s.enemies.forEach((en, eIdx) => {
            if (checkRectCollide({x: f.x, y: f.y, w: 20, h: 20}, en)) {
                s.enemies.splice(eIdx, 1);
                addScore(200);
            }
        });
        if (f.y > GAME_HEIGHT) f.falling = false; // Remove
      }
    });

    // -- Objective (Key) --
    if (s.key.active && checkRectCollide(jr, {x: s.key.x, y: s.key.y, w: 20, h: 20})) {
        handleLevelComplete();
    }
  };

  const checkRectCollide = (r1, r2) => {
    return (
        r1.x < r2.x + r2.w &&
        r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h &&
        r1.y + r1.h > r2.y
    );
  };

  const handleDeath = () => {
     setLives(prev => {
         const newLives = prev - 1;
         if (newLives <= 0) {
             setGameState('GAMEOVER');
             if (score > highScore) {
                 setHighScore(score);
                 localStorage.setItem('dkjr-highscore', score);
             }
         } else {
             resetLevel();
         }
         return newLives;
     });
  };

  const handleLevelComplete = () => {
    addScore(500);
    setGameState('LEVEL_COMPLETE');
    setTimeout(() => {
        setLevel(prev => prev + 1);
        setGameState('PLAYING');
        resetLevel();
    }, 2000); // 2 sec delay
  };

  const addScore = (points) => {
    setScore(prev => prev + points);
  };


  // --- Render ---
  const render = (ctx) => {
    // Clear
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // -- Static BG --
    // Ground
    ctx.fillStyle = COLORS.WATER; 
    ctx.fillRect(0, GAME_HEIGHT - 10, GAME_WIDTH, 10); // Water at bottom?

    // Platforms
    ctx.fillStyle = COLORS.PLATFORM;
    stateRef.current.platforms.forEach(p => {
        ctx.fillRect(p.x, p.y, p.w, 10);
    });

    // Vines
    ctx.fillStyle = COLORS.VINE;
    stateRef.current.vines.forEach(v => {
        ctx.fillRect(v.x-2, v.y1, 4, v.y2 - v.y1);
    });

    // Cage
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(30, 50, 50, 50);

    if (gameState === 'TITLE') {
        drawCenteredText(ctx, "DONKEY KONG JR", 150, 30, COLORS.TEXT);
        drawCenteredText(ctx, "PRESS START", 250, 20, COLORS.TEXT);
        drawCenteredText(ctx, `HIGH SCORE: ${highScore}`, 350, 16, COLORS.TEXT);
        drawButtons(ctx);
        return;
    }

    if (gameState === 'GAMEOVER') {
        drawCenteredText(ctx, "GAME OVER", 200, 30, '#FF0000');
        drawCenteredText(ctx, `SCORE: ${score}`, 250, 20, COLORS.TEXT);
        drawCenteredText(ctx, "CLICK TO RESTART", 300, 16, COLORS.TEXT);
        return;
    }
    
    // -- Objects --

    // Papa (Donkey Kong)
    ctx.fillStyle = COLORS.PAPA;
    const { papa } = stateRef.current;
    ctx.fillRect(papa.x, papa.y, papa.w, papa.h);

    // Key
    if (stateRef.current.key.active) {
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(stateRef.current.key.x, stateRef.current.key.y, 15, 10);
    }

    // Fruits
    stateRef.current.fruits.forEach(f => {
        if (f.active || f.falling) {
            ctx.fillStyle = COLORS.FRUIT;
            ctx.beginPath();
            ctx.arc(f.x + 10, f.y + 10, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Enemies (Snapjaws)
    ctx.fillStyle = COLORS.SNAPJAW;
    stateRef.current.enemies.forEach(en => {
        ctx.save();
        ctx.translate(en.x + en.w/2, en.y + en.h/2);
        // Chomp animation
        const open = Math.floor(Date.now() / 200) % 2 === 0;
        if (open) {
             ctx.fillRect(-en.w/2, -en.h/2, en.w, en.h);
        } else {
             ctx.fillRect(-en.w/2, -en.h/2 + 2, en.w, en.h - 4);
        }
        ctx.restore();
    });

    // Junior (Player)
    const { jr } = stateRef.current;
    ctx.fillStyle = COLORS.JR;
    ctx.save();
    
    // Simple blinking if hit? Nah just simple sprite for now
    // Draw body
    ctx.fillRect(jr.x, jr.y, jr.w, jr.h);
    // Draw eyes to show direction
    ctx.fillStyle = '#000';
    if (jr.facing === 'RIGHT') ctx.fillRect(jr.x + 14, jr.y + 4, 2, 2);
    else ctx.fillRect(jr.x + 4, jr.y + 4, 2, 2);
    
    ctx.restore();

    // UI Overlay (Score)
    ctx.font = '16px monospace';
    ctx.fillStyle = '#FFF';
    ctx.fillText(`SCORE: ${score}`, 10, 20);
    ctx.fillText(`LIVES: ${lives}`, 10, 40);
    ctx.fillText(`LEVEL: ${level}`, 300, 20);
    
    if (gameState === 'PAUSED') {
         drawCenteredText(ctx, "PAUSED", 250, 30, '#FFFF00');
    }
    
    if (gameState === 'LEVEL_COMPLETE') {
         drawCenteredText(ctx, "LEVEL COMPLETED!", 250, 30, '#00FF00');
         drawCenteredText(ctx, "+500 PTS", 290, 20, '#00FF00');
    }
  };

  const drawCenteredText = (ctx, text, y, size, color) => {
    ctx.fillStyle = color;
    ctx.font = `${size}px 'Press Start 2P', monospace`; // Fallback to monospace
    ctx.textAlign = 'center';
    ctx.fillText(text, GAME_WIDTH / 2, y);
    ctx.textAlign = 'left'; // Reset
  };
  
  const drawButtons = (ctx) => {
      // Draw Start Button visual
      ctx.fillStyle = '#444';
      ctx.fillRect(GAME_WIDTH/2 - 50, 400, 100, 40);
      ctx.fillStyle = '#FFF';
      ctx.font = '16px monospace';
      ctx.fillText("START", GAME_WIDTH/2 - 25, 425);
  };

  // --- Click Handler for UI ---
  const handleCanvasClick = (e) => {
    if (gameState === 'TITLE' || gameState === 'GAMEOVER') {
      startGame();
    }
  };

  return (
    <div style={{
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      background: '#222', 
      padding: '20px', 
      borderRadius: '8px',
      color: 'white',
      fontFamily: 'monospace'
    }}>
      <div style={{marginBottom: '10px', display: 'flex', justifyContent: 'space-between', width: '400px'}}>
        <span>Donkey Kong Jr. React</span>
        <button onClick={toggleMute} style={{background: 'none', border: 'none', color: '#AAA', cursor: 'pointer'}}>
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      <canvas 
        ref={canvasRef} 
        width={GAME_WIDTH} 
        height={GAME_HEIGHT}
        onClick={handleCanvasClick}
        style={{
          border: '4px solid #555',
          borderRadius: '4px',
          background: '#000',
          cursor: (gameState === 'TITLE' || gameState === 'GAMEOVER') ? 'pointer' : 'default'
        }}
      />

      <div style={{marginTop: '10px', fontSize: '12px', color: '#888', textAlign: 'center'}}>
        CONTROLS:<br/>
        ARROWS: Move/Climb • SPACE: Jump • P: Pause
      </div>
    </div>
  );
};

export default DonkeyKongJr;
