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
    const [crashError, setCrashError] = useState(null);
    const [gameState, setGameState] = useState('TITLE'); 
    const [isMuted, setIsMuted] = useState(false);
  
    // Mutable Game State (All logic here to avoid re-render loop issues)
    const stateRef = useRef({
      score: 0,
      lives: 3,
      level: 1,
      highScore: 0,
      jr: { x: 50, y: 430, dx: 0, dy: 0, w: 20, h: 20, state: 'IDLE', facing: 'RIGHT', onVine: false },
      keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Space: false },
      vines: [],
      platforms: [],
      enemies: [],
      fruits: [],
      key: { x: 0, y: 0, active: false },
      papa: { x: 0, y: 0, w: 0, h: 0 },
      timer: 0,
      enemySpawnTimer: 0
    });
  
    // Init Safe Storage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('dkjr-highscore');
            if (saved) stateRef.current.highScore = parseInt(saved, 10);
        } catch (e) { console.warn("Local storage blocked", e); }
        
        initLevel(1);
    }, []);
  
    const initLevel = (lvl) => {
        const s = stateRef.current;
        s.level = lvl;
        s.vines = [
            { x: 60, y1: 100, y2: 430 },
            { x: 120, y1: 100, y2: 350 },
            { x: 180, y1: 100, y2: 430 },
            { x: 260, y1: 100, y2: 250 },
            { x: 340, y1: 100, y2: 430 } 
        ];
        s.platforms = [
            { x: 0, y: 450, w: 100 },
            { x: 150, y: 450, w: 100 },
            { x: 300, y: 450, w: 100 },
            { x: 230, y: 250, w: 100 },
            { x: 80, y: 350, w: 80 },
            { x: 0, y: 100, w: 400 }
        ];
        s.fruits = [
            { x: 60, y: 150, active: true },
            { x: 180, y: 200, active: true },
            { x: 340, y: 120, active: true }
        ];
        s.key = { x: 180, y: 80, active: true };
        s.papa = { x: 40, y: 60, w: 30, h: 30 };
        resetRound();
    };

    const resetRound = () => {
         const s = stateRef.current;
         s.jr = { x: 20, y: 430, dx: 0, dy: 0, w: 20, h: 20, state: 'IDLE', facing: 'RIGHT', onVine: false };
         s.enemies = [];
         s.timer = 0;
    };
  
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
  
    const startGame = () => {
      const s = stateRef.current;
      s.score = 0;
      s.lives = 3;
      initLevel(1);
      setGameState('PLAYING');
    };
  
    const toggleMute = () => setIsMuted(prev => !prev);
  
    // --- Game Loop ---
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          setCrashError("Canvas context not supported");
          return;
      }

      let animationFrameId;
  
      const gameLoop = () => {
        try {
            if (gameState === 'PLAYING') {
              update();
            }
            render(ctx);
            animationFrameId = requestAnimationFrame(gameLoop);
        } catch (err) {
            console.error(err);
            setCrashError(err.message);
        }
      };
  
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      // Perform initial render immediately
      render(ctx);
      animationFrameId = requestAnimationFrame(gameLoop);
  
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        cancelAnimationFrame(animationFrameId);
      };
    }, [gameState]); // Removed level from deps to avoid re-init bugs
  
    // --- Update Logic ---
    const update = () => {
      const s = stateRef.current;
      const { keys, jr } = s;
  
      // -- Player Movement --
      let nearVine = null;
      s.vines.forEach(v => {
        if (Math.abs((jr.x + jr.w/2) - v.x) < 5 && jr.y >= v.y1 && jr.y <= v.y2 ) {
          nearVine = v;
        }
      });
  
      if (keys.ArrowUp && nearVine) {
        jr.onVine = true;
        jr.x = nearVine.x - jr.w/2;
      }
      
      if (jr.onVine) {
        if (keys.ArrowUp) jr.y -= CLIMB_SPEED;
        if (keys.ArrowDown) jr.y += CLIMB_SPEED;
        if (keys.ArrowLeft) { jr.x -= 2; jr.onVine = false; }
        if (keys.ArrowRight) { jr.x += 2; jr.onVine = false; }
        
        if (nearVine) {
            if (jr.y < nearVine.y1) jr.y = nearVine.y1;
            if (jr.y > nearVine.y2) jr.y = nearVine.y2;
        } else {
            jr.onVine = false;
        }
        jr.dy = 0; 
      } else {
        if (keys.ArrowLeft) { jr.dx = -WALK_SPEED; jr.facing = 'LEFT'; }
        else if (keys.ArrowRight) { jr.dx = WALK_SPEED; jr.facing = 'RIGHT'; }
        else { jr.dx = 0; }
  
        if (keys.Space && jr.grounded) {
          jr.dy = JUMP_FORCE;
          jr.grounded = false;
        }
  
        jr.dy += GRAVITY;
        jr.x += jr.dx;
        jr.y += jr.dy;
      }
  
      // Platform Collisions
      jr.grounded = false;
      if (!jr.onVine) {
        s.platforms.forEach(p => {
          if (jr.dy >= 0 && 
              jr.y + jr.h <= p.y + jr.dy + 5 && 
              jr.y + jr.h >= p.y - 5 && 
              jr.x + jr.w > p.x && 
              jr.x < p.x + p.w) {
                jr.y = p.y - jr.h;
                jr.dy = 0;
                jr.grounded = true;
          }
        });
        if (jr.y + jr.h > GAME_HEIGHT) {
          jr.y = GAME_HEIGHT - jr.h;
          jr.dy = 0;
          jr.grounded = true;
        }
      }
  
      if (jr.x < 0) jr.x = 0;
      if (jr.x + jr.w > GAME_WIDTH) jr.x = GAME_WIDTH - jr.w;
  
  
      // -- Enemies AI (Snapjaws) --
      s.enemySpawnTimer++;
      if (s.enemySpawnTimer > 150 - (s.level * 10)) { 
        s.enemySpawnTimer = 0;
        const spawnVine = s.vines[Math.floor(Math.random() * s.vines.length)];
        s.enemies.push({
          x: spawnVine.x - 10,
          y: spawnVine.y1,
          w: 20, 
          h: 15,
          type: 'SNAPJAW',
          vineIdx: s.vines.indexOf(spawnVine),
          dir: 1
        });
      }
  
      s.enemies.forEach((en, idx) => {
          en.y += SNAPJAW_SPEED * en.dir;
          const myVine = s.vines[en.vineIdx];
          if (!myVine || en.y > myVine.y2 + 20) {
               s.enemies.splice(idx, 1); // Despawn
          } else if (checkRectCollide(jr, en)) {
              handleDeath();
          }
      });
  
      // -- Fruit Mechanics --
      s.fruits.forEach(f => {
        if (f.active && checkRectCollide(jr, {x: f.x, y: f.y, w: 20, h: 20})) {
          f.falling = true;
          f.active = false;
          addScore(100);
        }
        
        if (f.falling) {
          f.y += 5;
          s.enemies.forEach((en, eIdx) => {
              if (checkRectCollide({x: f.x, y: f.y, w: 20, h: 20}, en)) {
                  s.enemies.splice(eIdx, 1);
                  addScore(200);
              }
          });
          if (f.y > GAME_HEIGHT) f.falling = false; 
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
       const s = stateRef.current;
       s.lives -= 1;
       if (s.lives <= 0) {
           setGameState('GAMEOVER');
           if (s.score > s.highScore) {
               s.highScore = s.score;
               try { localStorage.setItem('dkjr-highscore', s.score); } catch(e){}
           }
       } else {
           resetRound();
       }
    };
  
    const handleLevelComplete = () => {
      addScore(500);
      setGameState('LEVEL_COMPLETE');
      setTimeout(() => {
          const s = stateRef.current;
          s.level += 1;
          resetRound();
          setGameState('PLAYING');
      }, 2000); 
    };
  
    const addScore = (points) => {
      stateRef.current.score += points;
    };
  
    // --- Render ---
    const render = (ctx) => {
      const s = stateRef.current;
      
      // Force Black Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  
      // -- Static BG --
      ctx.fillStyle = COLORS.WATER; 
      ctx.fillRect(0, GAME_HEIGHT - 10, GAME_WIDTH, 10);
  
      ctx.fillStyle = COLORS.PLATFORM;
      s.platforms.forEach(p => {
          ctx.fillRect(p.x, p.y, p.w, 10);
      });
  
      ctx.fillStyle = COLORS.VINE;
      s.vines.forEach(v => {
          ctx.fillRect(v.x-2, v.y1, 4, v.y2 - v.y1);
      });
  
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeRect(30, 50, 50, 50); // Cage
  
      if (gameState === 'TITLE') {
          drawCenteredText(ctx, "DONKEY KONG JR", 150, 30, COLORS.TEXT);
          drawCenteredText(ctx, "PRESS START", 250, 20, COLORS.TEXT);
          drawCenteredText(ctx, `HIGH SCORE: ${s.highScore}`, 350, 16, COLORS.TEXT);
          drawButtons(ctx);
          return;
      }
  
      if (gameState === 'GAMEOVER') {
          drawCenteredText(ctx, "GAME OVER", 200, 30, '#FF0000');
          drawCenteredText(ctx, `SCORE: ${s.score}`, 250, 20, COLORS.TEXT);
          drawCenteredText(ctx, "CLICK TO RESTART", 300, 16, COLORS.TEXT);
          return;
      }
      
      ctx.fillStyle = COLORS.PAPA;
      ctx.fillRect(s.papa.x, s.papa.y, s.papa.w, s.papa.h);
  
      if (s.key.active) {
          ctx.fillStyle = '#FFFF00';
          ctx.fillRect(s.key.x, s.key.y, 15, 10);
      }
  
      s.fruits.forEach(f => {
          if (f.active || f.falling) {
              ctx.fillStyle = COLORS.FRUIT;
              ctx.beginPath();
              ctx.arc(f.x + 10, f.y + 10, 8, 0, Math.PI * 2);
              ctx.fill();
          }
      });
  
      ctx.fillStyle = COLORS.SNAPJAW;
      s.enemies.forEach(en => {
          ctx.save();
          ctx.translate(en.x + en.w/2, en.y + en.h/2);
          const open = Math.floor(Date.now() / 200) % 2 === 0;
          if (open) ctx.fillRect(-en.w/2, -en.h/2, en.w, en.h);
          else ctx.fillRect(-en.w/2, -en.h/2 + 2, en.w, en.h - 4);
          ctx.restore();
      });
  
      // Junior
      const { jr } = s;
      ctx.fillStyle = COLORS.JR;
      ctx.save();
      ctx.fillRect(jr.x, jr.y, jr.w, jr.h);
      ctx.fillStyle = '#000';
      if (jr.facing === 'RIGHT') ctx.fillRect(jr.x + 14, jr.y + 4, 2, 2);
      else ctx.fillRect(jr.x + 4, jr.y + 4, 2, 2);
      ctx.restore();
  
      // UI
      ctx.font = '16px monospace';
      ctx.fillStyle = '#FFF';
      ctx.fillText(`SCORE: ${s.score}`, 10, 20);
      ctx.fillText(`LIVES: ${s.lives}`, 10, 40);
      ctx.fillText(`LEVEL: ${s.level}`, 300, 20);
      
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
      ctx.font = `${size}px monospace`; // Fallback to safe font
      ctx.textAlign = 'center';
      ctx.fillText(text, GAME_WIDTH / 2, y);
      ctx.textAlign = 'left'; 
    };
    
    const drawButtons = (ctx) => {
        ctx.fillStyle = '#444';
        ctx.fillRect(GAME_WIDTH/2 - 50, 400, 100, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = '16px monospace';
        ctx.fillText("START", GAME_WIDTH/2 - 25, 425);
    };
  
    const handleCanvasClick = (e) => {
      if (gameState === 'TITLE' || gameState === 'GAMEOVER') {
        startGame();
      }
    };
  
    if (crashError) {
        return <div style={{color: 'red', border:'1px solid red', padding:10}}>Game Error: {crashError}</div>;
    }

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
            display: 'block',
            border: '4px solid #555',
            borderRadius: '4px',
            background: '#000',
            cursor: (gameState === 'TITLE' || gameState === 'GAMEOVER') ? 'pointer' : 'default',
            width: `${GAME_WIDTH}px`,
            height: `${GAME_HEIGHT}px`
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
