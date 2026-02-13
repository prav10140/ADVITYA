// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db, auth } from "../firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, increment, arrayUnion } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { GAME_DATABASE } from "../gameConfig"; 
import Leaderboard from "../components/Leaderboard"; 
import "./Dashboard.css"; 

// --- CONFIGURATION ---
const CHAOS_DURATION_SEC = 600; // 10 Minutes per Rule
const GAME_DURATION_SEC = 600;  // 10 Minutes per Mission
const CHAOS_RULES = ["FLOOR IS LAVA", "SIT-STAND", "COMPLETE SILENCE", "SLOW MOTION", "ONE HAND ONLY"];

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loadingDice, setLoadingDice] = useState(false);
   
  // LAYER 1: CHAOS ROOM STATE
  const [activeChaosRule, setActiveChaosRule] = useState("INITIALIZING...");
  const [chaosTimeLeft, setChaosTimeLeft] = useState(CHAOS_DURATION_SEC);
  
  // TRACKING RULE CYCLES
  const lastCycleRef = useRef(null);
   
  // ACTIVE GAME TIMER STATE
  const [gameTimeLeft, setGameTimeLeft] = useState(null);
   
  // LOGS
  const [systemLogs, setSystemLogs] = useState([]);

  // --- HELPER: FORMAT TIME (MM:SS) ---
  const formatTime = (seconds) => {
    if (seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- 1. INITIALIZATION & DATA SYNC ---
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (doc) => {
      const data = doc.data();
      setPlayerData(data);

      if (data?.activeGame?.startedAt) {
        const startTime = data.activeGame.startedAt.toDate().getTime();
        const now = Date.now();
        const elapsedSec = Math.floor((now - startTime) / 1000);
        const remaining = GAME_DURATION_SEC - elapsedSec;
        setGameTimeLeft(remaining > 0 ? remaining : 0);
      } else {
        setGameTimeLeft(null);
      }
    });

    return () => unsub();
  }, [currentUser]);

  // --- 2. CHAOS TIMER LOGIC (POINTS REMOVED FROM HERE) ---
  useEffect(() => {
    const syncChaosTimer = async () => {
        const now = Math.floor(Date.now() / 1000); 
        const currentCycleIndex = Math.floor(now / CHAOS_DURATION_SEC);
        
        // We only update the visual rule and timer now. 
        // Points are no longer awarded for just letting the chaos timer run.
        
        lastCycleRef.current = currentCycleIndex;

        const elapsedInCycle = now % CHAOS_DURATION_SEC;
        const remaining = CHAOS_DURATION_SEC - elapsedInCycle;
        const ruleIndex = currentCycleIndex % CHAOS_RULES.length;
        
        setChaosTimeLeft(remaining);
        setActiveChaosRule(CHAOS_RULES[ruleIndex]);
    };

    syncChaosTimer();
    const timer = setInterval(syncChaosTimer, 1000);
    return () => clearInterval(timer);
  }, []); 

  // --- 3. GAME TIMER LOGIC ---
  useEffect(() => {
    if (gameTimeLeft === null) return; 

    if (gameTimeLeft <= 0) {
        handleTimeSuccess();
        return;
    }

    const gameTimer = setInterval(() => {
        setGameTimeLeft((prev) => {
            if (prev <= 1) {
                handleTimeSuccess();
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(gameTimer);
  }, [gameTimeLeft]);

  // --- ACTIONS ---

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
  };

  // AWARD POINT ONLY ON MISSION COMPLETION
  const handleTimeSuccess = async () => {
    if (!playerData?.activeGame) return;
    if (loadingDice) return; 
    setLoadingDice(true);

    try {
        const userRef = doc(db, "users", currentUser.uid);
        const completedGameId = playerData.activeGame.gameId;

        await updateDoc(userRef, {
            activeGame: null,
            completedGames: arrayUnion(completedGameId),
            score: increment(1) // +1 POINT FOR COMPLETING THE MISSION TIME
        });
        
        addLog(`MISSION SUCCESS: +1 SCORE AWARDED`);
        alert(`TIME UP. MISSION COMPLETE.\n\nReward: +1 Score`);

    } catch (err) {
        console.error("Auto-complete error:", err);
    } finally {
        setLoadingDice(false);
    }
  };

  const rollDice = async (category) => {
    const lastCategory = playerData.lastPlayedCategory;
    if (lastCategory === category && !playerData.unlockedSameCategory) {
        alert("PROTOCOL VIOLATION: You must alternate categories. Pay 2 tokens to bypass.");
        return;
    }
    setLoadingDice(true);
    setTimeout(async () => {
      try {
        const level = Math.floor(Math.random() * 6) + 1;
        const gameId = `${category}_${level}`;
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            activeGame: {
                category, level, gameId,
                startedAt: serverTimestamp()
            },
            lastPlayedCategory: category,
            unlockedSameCategory: false
        });
        addLog(`ENTERING BORDERLAND: ${category} LEVEL ${level}`);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDice(false);
      }
    }, 2000);
  };

  // PENALTY: DEDUCT POINT FOR SKIPPING
  const skipChaosRule = async () => {
    if (playerData.score < 1) { 
        alert("INSUFFICIENT SCORE TO SKIP."); 
        return; 
    }
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { 
        score: increment(-1) // CUTTING POINT FOR SKIPPING
    });
    addLog(`CHAOS RULE SKIPPED (-1 SCORE POINT)`);
    alert("RULE BYPASSED. PENALTY: -1 SCORE POINT.");
  };

  const unlockCategory = async () => {
    if (playerData.tokens < 2) return alert("INSUFFICIENT VISAS.");
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { tokens: increment(-2), unlockedSameCategory: true });
    addLog(`CATEGORY LOCK OVERRIDDEN (-2 TOKENS)`);
  };

  const quitGame = async () => {
      if(!window.confirm("Give up? No rewards for quitters.")) return;
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { activeGame: null });
      addLog(`MISSION ABORTED`);
  }

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if (!playerData) return <div style={{background:'#000', color:'#0f0', height:'100vh', padding:'20px'}}>INITIALIZING CHAOS OS...</div>;

  const currentScore = playerData.score || 0;

  return (
    <div className="chaos-room-shell">
      <header className="chaos-header">
        <div className="system-status">
            <div className="blink-dot"></div><span>CHAOS ROOM // ONLINE</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
            {(playerData.role === 'admin' || playerData.role === 'manager') && (
                <button onClick={() => navigate('/admin')} style={{background: '#ff0055', color: '#fff', border: 'none', padding: '5px 15px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '0.8rem', boxShadow: '0 0 10px #ff0055'}}>
                    MANAGER PANEL
                </button>
            )}
            
            <div style={{color: '#00ff41', fontFamily: 'Orbitron', marginRight:'10px', fontSize:'1.2rem', textShadow:'0 0 10px #00ff41'}}>
                SCORE: {currentScore}
            </div>

            <div className="user-id">ID: {currentUser.email.split('@')[0]} | TOKENS: <span style={{color: '#ffd700'}}>{playerData.tokens}</span></div>
            <button onClick={handleLogout} style={{background:'transparent', border:'1px solid #0f0', color:'#0f0', cursor:'pointer'}}>EXIT</button>
        </div>
      </header>

      <div className="chaos-rule-strip">
        <div className="rule-display"><span className="rule-label">CURRENT RULE</span><span className="active-rule-text">{activeChaosRule}</span></div>
        <div className="rule-timer" style={{fontFamily:'monospace', fontSize:'1.2rem', color: chaosTimeLeft < 60 ? 'red' : '#0f0'}}>T-MINUS: {formatTime(chaosTimeLeft)}</div>
        <button onClick={skipChaosRule} className="skip-btn">SKIP (-1 🏆)</button>
      </div>

      <div className="borderland-layer">
        <div className="game-console">
            <div className="gateway-panel">
                <h2 className="panel-title">BORDERLAND PROTOCOL</h2>
                {playerData.activeGame ? (
                    <div className="active-mission-screen">
                          <div style={{fontSize: '3rem', fontFamily: 'monospace', color: gameTimeLeft < 60 ? '#ff0000' : '#fff', border: '2px solid currentColor', padding: '10px 20px', marginBottom: '20px', textShadow: '0 0 10px currentColor'}}>
                              {formatTime(gameTimeLeft)}
                          </div>
                          <h1 style={{fontSize:'4rem', margin:0, color:'#fff'}}>LEVEL {playerData.activeGame.level}</h1>
                          <h2 style={{color: playerData.activeGame.category === 'HEART' ? '#ff0055' : '#00ccff', textShadow:'0 0 10px currentColor'}}>
                             {GAME_DATABASE[playerData.activeGame.gameId]?.title || "UNKNOWN"}
                          </h2>
                          <p style={{color:'#fff', maxWidth:'80%', fontSize:'1.1rem'}}>
                             {GAME_DATABASE[playerData.activeGame.gameId]?.description}
                          </p>
                          <div style={{marginTop:'20px', background:'#000', padding:'10px 20px', color:'#0f0', border:'1px solid #0f0'}}>
                             LOC: {GAME_DATABASE[playerData.activeGame.gameId]?.location}
                          </div>
                          <div style={{marginTop:'30px', color:'#888', fontStyle:'italic', fontSize:'0.9rem'}}>
                              SURVIVE UNTIL TIMER REACHES 00:00 TO COMPLETE
                          </div>
                          <button onClick={quitGame} style={{marginTop:'20px', background:'#333', color:'#fff', border:'1px solid #555', padding:'10px', cursor:'pointer', fontFamily:'Orbitron'}}>
                              FORFEIT
                          </button>
                    </div>
                ) : (
                    <div className="cards-wrapper">
                        <div style={{position: 'relative', flex: 1}}>
                            <button className="card-btn card-heart" onClick={() => rollDice("HEART")} disabled={loadingDice} style={{width: '100%', height: '100%'}}>
                                <div className="suit-icon" style={{color: '#ff0055'}}>♥</div>
                                <span style={{color:'#fff', fontSize:'1.5rem'}}>HEART</span>
                                <div style={{fontSize:'0.7rem', color:'#888'}}>SOCIAL / EMOTIONAL</div>
                            </button>
                            {playerData.lastPlayedCategory === "HEART" && !playerData.unlockedSameCategory && (
                                <div className="locked-overlay">
                                    <span style={{color:'red', fontWeight:'bold'}}>LOCKED</span>
                                    <div style={{fontSize:'0.8rem', color:'#ccc'}}>Must play Spade next</div>
                                    <button className="unlock-btn" onClick={unlockCategory}>UNLOCK (-2 🪙)</button>
                                </div>
                            )}
                        </div>
                        <div style={{position: 'relative', flex: 1}}>
                            <button className="card-btn card-spade" onClick={() => rollDice("SPADE")} disabled={loadingDice} style={{width: '100%', height: '100%'}}>
                                <div className="suit-icon" style={{color: '#00ccff'}}>♠</div>
                                <span style={{color:'#fff', fontSize:'1.5rem'}}>SPADE</span>
                                <div style={{fontSize:'0.7rem', color:'#888'}}>LOGIC / INTELLECT</div>
                            </button>
                            {playerData.lastPlayedCategory === "SPADE" && !playerData.unlockedSameCategory && (
                                <div className="locked-overlay">
                                    <span style={{color:'#00ccff', fontWeight:'bold'}}>LOCKED</span>
                                    <div style={{fontSize:'0.8rem', color:'#ccc'}}>Must play Heart next</div>
                                    <button className="unlock-btn" onClick={unlockCategory}>UNLOCK (-2 🪙)</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div className="data-sidebar">
                <div style={{marginBottom:'20px'}}>
                   <div style={{borderBottom:'1px solid #0f0', marginBottom:'10px', display:'flex', justifyContent:'space-between', color:'#0f0'}}>
                       <span>LIVE RANKINGS</span><span className="blink">● LIVE</span>
                   </div>
                   <Leaderboard limitCount={10} />
                </div>
                <div style={{borderTop:'1px dashed #333', paddingTop:'10px'}}>
                    <div style={{color:'#888', marginBottom:'5px', fontSize:'0.8rem'}}>SYSTEM LOGS</div>
                    {systemLogs.map((log, i) => <div key={i} className="log-entry">{log}</div>)}
                </div>
            </div>
        </div>
      </div>
      <footer className="chaos-footer">
        <div className="ticker-text">WARNING: VISA EXPIRY IMMINENT // CURRENT RULE: {activeChaosRule} // PENALTY FOR FAILURE: INCREMENTAL // TRUST NO ONE // </div>
      </footer>
    </div>
  );
}
