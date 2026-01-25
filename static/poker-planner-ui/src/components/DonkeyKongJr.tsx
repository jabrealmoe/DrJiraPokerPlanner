import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- Constants & Config ---
const GAME_WIDTH = 400;
const GAME_HEIGHT = 500;
const GRAVITY = 0.4;
const JUMP_FORCE = -7;
const CLIMB_SPEED = 2;
const WALK_SPEED = 3;
const SNAPJAW_SPEED = 1.5;

// --- Interfaces ---
interface SpriteMap {
    [key: string]: number[][];
}

interface Entity {
    x: number;
    y: number;
    w: number;
    h: number;
    dx?: number;
    dy?: number;
    state?: string;
    facing?: 'LEFT' | 'RIGHT';
    onVine?: boolean;
    grounded?: boolean;
    active?: boolean;
    falling?: boolean;
    type?: string;
    vineIdx?: number;
    dir?: number;
    frame?: number;
}

interface GameState {
    score: number;
    lives: number;
    level: number;
    highScore: number;
    jr: Entity;
    keys: { [key: string]: boolean };
    vines: { x: number; y1: number; y2: number }[];
    platforms: { x: number; y: number; w: number }[];
    enemies: Entity[];
    fruits: Entity[];
    key: Entity;
    papa: Entity;
    timer: number;
    enemySpawnTimer: number;
}

// --- Pixel Art Sprites (Simplified 8-bit style) ---
// 0=Transparent, 1=Outline/Dark, 2=Skin/Light, 3=MainColor
const SPRITE_MAPS: SpriteMap = {
  // Junior (Walk/Stand)
  JR_IDLE: [
    [0,0,0,3,3,3,3,3,0,0],
    [0,0,3,2,2,2,3,3,3,0],
    [0,0,3,2,1,2,2,3,3,0], // Eyes
    [0,0,3,3,3,2,2,3,3,0],
    [0,3,3,3,3,3,3,3,3,0], // Body
    [0,3,3,1,1,3,1,1,3,0],
    [0,0,3,3,3,3,3,3,0,0],
    [0,0,3,2,0,0,2,3,0,0], // Legs
    [0,3,3,0,0,0,0,3,3,0]
  ],
  JR_CLIMB: [
     [0,0,0,3,3,3,3,0,0,0],
     [0,0,3,2,2,2,3,3,0,0],
     [0,3,3,3,2,2,3,3,3,0],
     [3,3,2,2,3,3,2,2,3,3], // Arms up
     [0,0,3,3,3,3,3,3,0,0],
     [0,0,3,1,1,1,1,3,0,0],
     [0,0,3,2,0,0,2,3,0,0],
     [0,0,3,3,0,0,3,3,0,0]
  ],
  SNAPJAW: [
     [0,0,1,1,1,1,1,0,0],
     [0,1,4,4,4,4,4,1,0],
     [1,4,1,5,4,1,5,4,1], // Eyes
     [1,4,4,4,4,4,4,4,1],
     [0,1,6,6,6,6,6,1,0], // Teeth
     [0,0,1,1,1,1,1,0,0]
  ],
  FRUIT: [
      [0,0,7,7,7,0,0],
      [0,7,7,7,7,7,0],
      [7,7,7,7,7,7,7],
      [7,7,7,7,7,7,7],
      [0,7,7,7,7,7,0],
      [0,0,7,7,7,0,0],
      [0,0,0,1,0,0,0] // Stem
  ],
  KEY: [
      [0,8,8,8,0],
      [8,0,0,0,8],
      [0,8,8,8,0], // Head
      [0,0,8,0,0],
      [0,0,8,0,0],
      [0,0,8,8,0], // Teeth
      [0,0,8,0,0]
  ]
};

const PALETTE: { [key: number]: string } = {
    1: '#000000', // Outline
    2: '#FFDAB9', // Skin
    3: '#FFA500', // Orange (Jr)
    4: '#0000FF', // Blue (Snapjaw)
    5: '#FFFF00', // Yellow (Eyes)
    6: '#FFFFFF', // Teeth
    7: '#FF0000', // Red Fruit
    8: '#FFD700'  // Gold Key
};

const COLORS = {
  BG: '#000000',
  VINE: '#00FF00',
  PLATFORM: '#FF00FF',
  PAPA: '#8B4513', // Brown
  TEXT: '#FFFFFF',
  WATER: '#000080'
};

const DonkeyKongJr: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [crashError, setCrashError] = useState<string | null>(null);
    const [gameState, setGameState] = useState<'TITLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'LEVEL_COMPLETE'>('TITLE'); 
    const [isMuted, setIsMuted] = useState(false);
  
    // Mutable Game State
    const stateRef = useRef<GameState>({
      score: 0,
      lives: 3,
      level: 1,
      highScore: 0,
      jr: { x: 50, y: 430, dx: 0, dy: 0, w: 24, h: 24, state: 'IDLE', facing: 'RIGHT', onVine: false },
      keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Space: false },
      vines: [] as { x: number; y1: number; y2: number }[],
      platforms: [] as { x: number; y: number; w: number }[],
      enemies: [] as Entity[],
      fruits: [] as Entity[],
      key: { x: 0, y: 0, active: false, w: 0, h: 0 },
      papa: { x: 0, y: 0, w: 40, h: 40 },
      timer: 0,
      enemySpawnTimer: 0
    });
  
    useEffect(() => {
        try {
            const saved = localStorage.getItem('dkjr-highscore');
            if (saved) stateRef.current.highScore = parseInt(saved, 10);
        } catch (e) {
            console.warn("Storage blocked", e);
        }
        initLevel(1);
    }, []);
  
    const initLevel = (lvl: number) => {
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
            { x: 60, y: 150, active: true, w: 20, h: 20 },
            { x: 180, y: 200, active: true, w: 20, h: 20 },
            { x: 340, y: 120, active: true, w: 20, h: 20 }
        ];
        s.key = { x: 180, y: 80, active: true, w: 20, h: 20 };
        s.papa = { x: 40, y: 60, w: 40, h: 40 };
        resetRound();
    };

    const resetRound = () => {
         const s = stateRef.current;
         s.jr = { x: 20, y: 430, dx: 0, dy: 0, w: 24, h: 24, state: 'IDLE', facing: 'RIGHT', onVine: false };
         s.enemies = [];
         s.timer = 0;
    };
  
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (stateRef.current.keys.hasOwnProperty(e.code) || e.code === 'Space') {
          stateRef.current.keys[e.code === 'Space' ? 'Space' : e.code] = true;
          e.preventDefault();
        }
        if (e.key === 'p' || e.key === 'P') togglePause();
    }, []);
  
    const handleKeyUp = useCallback((e: KeyboardEvent) => {
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
      playSound('START');
    };
  
    const toggleMute = () => setIsMuted(prev => !prev);
  
    const playSound = (type: string) => {
        if (isMuted) return;
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'JUMP') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(300, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } 
        else if (type === 'STEP') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        }
        else if (type === 'FRUIT') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(900, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
        else if (type === 'DEATH') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
        else if (type === 'LEVEL_COMPLETE') {
            osc.type = 'square';
            [440, 554, 659, 880].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'square';
                o.connect(g);
                g.connect(ctx.destination);
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.1, now + i*0.1);
                g.gain.linearRampToValueAtTime(0, now + i*0.1 + 0.1);
                o.start(now + i*0.1);
                o.stop(now + i*0.1 + 0.1);
            });
        }
        else if (type === 'START') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        }
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return; 

      ctx.imageSmoothingEnabled = false; 

      let animationFrameId: number;
  
      const gameLoop = () => {
        try {
            if (gameState === 'PLAYING') update();
            render(ctx);
            animationFrameId = requestAnimationFrame(gameLoop);
        } catch (err: any) {
            setCrashError(err.message);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      render(ctx);
      animationFrameId = requestAnimationFrame(gameLoop);
  
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        cancelAnimationFrame(animationFrameId);
      };
    }, [gameState]);
  
    const update = () => {
      const s = stateRef.current;
      const { keys, jr } = s;
  
      let nearVine: { x: number; y1: number; y2: number } | null = null;
      s.vines.forEach(v => {
        if (Math.abs((jr.x + jr.w/2) - v.x) < 8 && jr.y >= v.y1 && jr.y <= v.y2 ) {
          nearVine = v;
        }
      });
  
      if (keys.ArrowUp && nearVine) {
        jr.onVine = true;
        jr.x = (nearVine as { x: number }).x - jr.w/2;
      }
      
      if (jr.onVine) {
        if (keys.ArrowUp) { jr.y -= CLIMB_SPEED; if(s.timer % 10 === 0) playSound('STEP'); }
        if (keys.ArrowDown) { jr.y += CLIMB_SPEED; if(s.timer % 10 === 0) playSound('STEP'); }
        if (keys.ArrowLeft) { jr.x -= 2; jr.onVine = false; }
        if (keys.ArrowRight) { jr.x += 2; jr.onVine = false; }
        
        if (nearVine) {
            if (jr.y < (nearVine as { y1: number }).y1) jr.y = (nearVine as { y1: number }).y1;
            if (jr.y > (nearVine as { y2: number }).y2) jr.y = (nearVine as { y2: number }).y2;
        } else jr.onVine = false;
        jr.dy = 0; 
      } else {
        if (keys.ArrowLeft) { 
            jr.dx = -WALK_SPEED; 
            jr.facing = 'LEFT';
            if (jr.grounded && s.timer % 15 === 0) playSound('STEP');
        }
        else if (keys.ArrowRight) { 
            jr.dx = WALK_SPEED; 
            jr.facing = 'RIGHT'; 
            if (jr.grounded && s.timer % 15 === 0) playSound('STEP');
        }
        else jr.dx = 0;
  
        if (keys.Space && jr.grounded) {
          jr.dy = JUMP_FORCE;
          jr.grounded = false;
          playSound('JUMP');
        }
  
        jr.dy = (jr.dy || 0) + GRAVITY;
        jr.x += jr.dx || 0;
        jr.y += jr.dy;
      }
  
      // Collisions
      jr.grounded = false;
      if (!jr.onVine) {
        s.platforms.forEach(p => {
            // @ts-ignore
          if ((jr.dy || 0) >= 0 && jr.y + jr.h <= p.y + (jr.dy || 0) + 8 && jr.y + jr.h >= p.y - 5 && jr.x + jr.w > p.x && jr.x < p.x + p.w) {
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
  
      // Enemies
      s.enemySpawnTimer++;
      if (s.enemySpawnTimer > 150 - (s.level * 10)) { 
        s.enemySpawnTimer = 0;
        const spawnVine = s.vines[Math.floor(Math.random() * s.vines.length)];
        s.enemies.push({
          x: spawnVine.x - 12,
          y: spawnVine.y1,
          w: 24, h: 18,
          dir: 1,
          vineIdx: s.vines.indexOf(spawnVine),
          frame: 0
        });
      }
  
      s.enemies.forEach((en, idx) => {
          en.y += SNAPJAW_SPEED * (en.dir || 1);
          if (en.frame !== undefined) en.frame++;
          const myVine = s.vines[en.vineIdx || 0];
          if (!myVine || en.y > myVine.y2 + 20) s.enemies.splice(idx, 1);
          else if (checkRectCollide(jr, en)) handleDeath();
      });
  
      // Fruits
      s.fruits.forEach(f => {
        if (f.active && checkRectCollide(jr, {x: f.x, y: f.y, w: 20, h: 20})) {
          f.falling = true;
          f.active = false;
          addScore(100);
          playSound('FRUIT');
        }
        if (f.falling) {
          f.y += 5;
          s.enemies.forEach((en, eIdx) => {
              // @ts-ignore
            if (checkRectCollide({x: f.x, y: f.y, w: 20, h: 20}, en)) {
                  s.enemies.splice(eIdx, 1);
                  addScore(200);
                  playSound('JUMP'); 
              }
          });
          if (f.y > GAME_HEIGHT) f.falling = false; 
        }
      });
  
      if (s.key.active && checkRectCollide(jr, {x: s.key.x, y: s.key.y, w: 20, h: 20})) {
          handleLevelComplete();
      }
    };
  
    const checkRectCollide = (r1: {x:number, y:number, w:number, h:number} | Entity, r2: {x:number, y:number, w:number, h:number} | Entity) => {
      return (r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y);
    };
  
    const handleDeath = () => {
       playSound('DEATH');
       const s = stateRef.current;
       s.lives -= 1;
       if (s.lives <= 0) {
           setGameState('GAMEOVER');
           if (s.score > s.highScore) try { localStorage.setItem('dkjr-highscore', s.score.toString()); } catch(e){}
       } else resetRound();
    };
  
    const handleLevelComplete = () => {
      addScore(500);
      playSound('LEVEL_COMPLETE');
      setGameState('LEVEL_COMPLETE');
      setTimeout(() => {
          stateRef.current.level += 1;
          resetRound();
          setGameState('PLAYING');
      }, 2000); 
    };
  
    const addScore = (points: number) => stateRef.current.score += points;
  
    // --- Render ---
    const drawSprite = (ctx: CanvasRenderingContext2D, spriteMap: number[][], x: number, y: number, scale = 2.5, facingRight = true) => {
        ctx.save();
        ctx.translate(x, y);
        if (!facingRight) {
            ctx.translate(spriteMap[0].length * scale, 0); 
            ctx.scale(-1, 1);
        }
        
        for (let r = 0; r < spriteMap.length; r++) {
            for (let c = 0; c < spriteMap[r].length; c++) {
                const colorCode = spriteMap[r][c];
                if (colorCode !== 0) {
                    ctx.fillStyle = PALETTE[colorCode] || '#FFF';
                    ctx.fillRect(c * scale, r * scale, scale, scale);
                }
            }
        }
        ctx.restore();
    };

    const render = (ctx: CanvasRenderingContext2D) => {
      const s = stateRef.current;
      
      // Black Background with Jungle Gradient
      var gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      gradient.addColorStop(0, "#000000");
      gradient.addColorStop(1, "#1a0f00");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  
      // Vines
      ctx.fillStyle = COLORS.VINE;
      s.vines.forEach(v => {
          ctx.fillRect(v.x-1, v.y1, 2, v.y2 - v.y1);
          // Vine nodes
          for(let vy=v.y1; vy<v.y2; vy+=20) ctx.fillRect(v.x-4, vy, 8, 2);
      });

      // Platforms
      s.platforms.forEach(p => {
          ctx.fillStyle = '#C71585';
          ctx.fillRect(p.x, p.y, p.w, 10);
          ctx.beginPath(); // Decorative pattern
          ctx.strokeStyle = '#FF69B4';
          ctx.moveTo(p.x, p.y+2); ctx.lineTo(p.x+p.w, p.y+2);
          ctx.stroke();
      });
  
      // Cage
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 50, 60, 50);
      
      // Papa (Big Box for now, or scaled sprite)
      ctx.fillStyle = COLORS.PAPA;
      ctx.fillRect(s.papa.x, s.papa.y, s.papa.w, s.papa.h);
      // Give papa some eyes
      ctx.fillStyle = '#FFF'; 
      ctx.fillRect(s.papa.x+10, s.papa.y+10, 5,5); 
      ctx.fillRect(s.papa.x+25, s.papa.y+10, 5,5);

      if (gameState === 'TITLE') {
          drawCenteredText(ctx, "DONKEY KONG JR", 150, 24, '#00ffff');
          drawCenteredText(ctx, "PRESS START", 250, 16, '#fff');
          return;
      }
      if (gameState === 'GAMEOVER') {
          drawCenteredText(ctx, "GAME OVER", 250, 30, '#ff0000');
          return;
      }
      
      // Key
      if (s.key.active) drawSprite(ctx, SPRITE_MAPS.KEY, s.key.x, s.key.y, 2);
  
      // Fruits
      s.fruits.forEach(f => {
          if (f.active || f.falling) drawSprite(ctx, SPRITE_MAPS.FRUIT, f.x, f.y, 3);
      });
  
      // Enemies
      s.enemies.forEach(en => {
          // Animate jaws?
          drawSprite(ctx, SPRITE_MAPS.SNAPJAW, en.x, en.y, 2.5);
      });
  
      // Junior
      const jrSprite = s.jr.onVine ? SPRITE_MAPS.JR_CLIMB : SPRITE_MAPS.JR_IDLE;
      drawSprite(ctx, jrSprite, s.jr.x, s.jr.y, 2.5, s.jr.facing === 'RIGHT');
      
      // UI
      ctx.fillStyle='#FFF'; ctx.font='14px monospace';
      ctx.fillText(`SCORE:${s.score}`, 10, 20);
      ctx.fillText(`LIVES:${s.lives}`, 320, 20);
    };
  
    const drawCenteredText = (ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string) => {
      ctx.fillStyle = color;
      ctx.font = `${size}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(text, GAME_WIDTH / 2, y);
      ctx.textAlign = 'left';
    };
    
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (gameState === 'TITLE' || gameState === 'GAMEOVER') startGame();
    };
  
    if (crashError) {
        return <div style={{color: 'red', border:'1px solid red', padding:10}}>Game Error: {crashError}</div>;
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        background: '#111', padding: '16px', borderRadius: '12px',
        maxWidth: '100%', boxSizing: 'border-box'
      }}>
        <div style={{marginBottom: '10px', display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '400px', color:'#eee'}}>
          <span style={{fontFamily:'monospace', fontWeight:'bold', color:'#00ffff'}}>DK Jr. Arcade</span>
          <button onClick={toggleMute} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize:'1.2rem'}}>
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
  
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '400px',
            aspectRatio: '0.8', 
            display: 'flex',
            justifyContent: 'center',
            background: '#000',
            border: '4px solid #444',
            borderRadius: '4px',
            overflow: 'hidden'
        }}>
           <canvas 
             ref={canvasRef} 
             width={GAME_WIDTH} 
             height={GAME_HEIGHT}
             onClick={handleCanvasClick}
             style={{
               width: '100%',
               height: '100%',
               objectFit: 'contain' 
             }}
           />
        </div>
  
        <div style={{marginTop: '12px', fontSize: '11px', color: '#888', textAlign: 'center', fontFamily: 'monospace'}}>
          ARROWS: Move • SPACE: Jump • P: Pause
        </div>
      </div>
    );
  };

export default DonkeyKongJr;
