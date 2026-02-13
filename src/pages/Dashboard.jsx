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
  const [selectedCategory, setSelectedCategory] = useState(null);
   
  const [activeChaosRule, setActiveChaosRule] = useState("INITIALIZING...");
  const [chaosTimeLeft, setChaosTimeLeft] = useState(CHAOS_DURATION_SEC);
  const lastCycleRef = useRef(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);

  const formatTime = (seconds) => {
    if (seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (doc) => {
      const data = doc.data();
      setPlayerData(data);
      if (data?.activeGame?.startedAt) {
        const startTime = data.activeGame.startedAt.toDate().getTime();
        const now = Date.now();
        const remaining = GAME_DURATION_SEC - Math.floor((now - startTime) / 1000);
        setGameTimeLeft(remaining > 0 ? remaining : 0);
      } else {
        setGameTimeLeft(null);
      }
    });
    return () => unsub();
  }, [currentUser]);

  // --- 2. CHAOS RULE TIMER & SCORING (RESTORED) ---
  useEffect(() => {
    if (!currentUser?.uid) return;

    const syncChaosTimer = async () => {
        const now = Math.floor(Date.now() / 1000); 
        const currentCycleIndex = Math.floor(now / CHAOS_DURATION_SEC);
        
        // RESTORED: AWARD +1 POINT IF 10-MINUTE CYCLE COMPLETES
        if (lastCycleRef.current !== null && currentCycleIndex > lastCycleRef.current) {
            try {
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, { score: increment(1) });
                addLog("RULE SURVIVED: +1 SCORE");
            } catch (err) { console.error(err); }
        }

        lastCycleRef.current = currentCycleIndex;
        setChaosTimeLeft(CHAOS_DURATION_SEC - (now % CHAOS_DURATION_SEC));
        setActiveChaosRule(CHAOS_RULES[currentCycleIndex % CHAOS_RULES.length]);
    };
    syncChaosTimer();
    const timer = setInterval(syncChaosTimer, 1000);
    return () => clearInterval(timer);
  }, [currentUser]); // Added dependency to ensure user ref exists

  // --- 3. MISSION TIMER ---
  useEffect(() => {
    if (gameTimeLeft === null) return; 
    if (gameTimeLeft <= 0) { handleTimeSuccess(); return; }
    const gameTimer = setInterval(() => {
        setGameTimeLeft((prev) => {
            if (prev === null) return null;
            if (prev <= 1) { handleTimeSuccess(); return 0; }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(gameTimer);
  }, [gameTimeLeft]);

  // --- ACTIONS ---

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" });
    setSystemLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
  };

  const handleTimeSuccess = async () => {
    if (!playerData?.activeGame) return;
    if (loadingDice) return; 
    setLoadingDice(true);
    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            activeGame: null,
            completedGames: arrayUnion(playerData.activeGame.gameId),
            score: increment(1)
        });
        addLog(`MISSION SUCCESS: +1 SCORE`);
        alert(`TIME UP. MISSION COMPLETE.`);
    } catch (err) { console.error(err); } finally { setLoadingDice(false); }
  };

  const skipChaosRule = async () => {
    if (playerData.tokens < 2) { alert("INSUFFICIENT VISAS (TOKENS)."); return; }
    await updateDoc(doc(db, "users", currentUser.uid), { tokens: increment(-2) });
    addLog(`CHAOS RULE SKIPPED (-2 TOKENS)`);
    alert("RULE SKIPPED. COST: 2 TOKENS.");
  };

  const unlockCategory = async () => {
    if (playerData.tokens < 2) { alert("INSUFFICIENT VISAS TO UNLOCK."); return; }
    if(!window.confirm("Pay 2 Tokens to unlock this category?")) return;
    
    await updateDoc(doc(db, "users", currentUser.uid), { 
        tokens: increment(-2), 
        unlockedSameCategory: true 
    });
    addLog(`CATEGORY UNLOCKED (-2 TOKENS)`);
  };

  const startMission = async (category, level) => {
    if (playerData.lastPlayedCategory === category && !playerData.unlockedSameCategory) {
        alert("LOCKED. UNLOCK FIRST.");
        return;
    }
    setLoadingDice(true);
    try {
      const gameId = `${category}_${level}`;
      await updateDoc(doc(db, "users", currentUser.uid), {
          activeGame: { category, level, gameId, startedAt: serverTimestamp() },
          lastPlayedCategory: category,
          unlockedSameCategory: false
      });
      addLog(`STARTED: ${gameId}`);
      setSelectedCategory(null);
    } catch (err) { console.error(err); } finally { setLoadingDice(false); }
  };

  const quitGame = async () => {
      if(!window.confirm("Forfeit? No points will be awarded.")) return;
      setGameTimeLeft(null); 
      await updateDoc(doc(db, "users", currentUser.uid), { activeGame: null });
      addLog(`MISSION FORFEITED`);
  }

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if (!playerData) return <div className="loading-screen">INITIALIZING...</div>;

  const currentScore = playerData.score || 0;
  const isHeartLocked = playerData.lastPlayedCategory === "HEART" && !playerData.unlockedSameCategory;
  const isSpadeLocked = playerData.lastPlayedCategory === "SPADE" && !playerData.unlockedSameCategory;

  return (
    <div className="chaos-room-shell">
      <header className="chaos-header">
        <div className="system-status">
            <div className="blink-dot"></div><span>CHAOS ROOM // ONLINE</span>
        </div>
        <div className="header-stats">
            {(playerData.role === 'admin' || playerData.role === 'manager') && (
                <button onClick={() => navigate('/admin')} className="manager-btn">MANAGER PANEL</button>
            )}
            <div className="stat-box">SCORE: <span className="neon-green">{currentScore}</span></div>
            <div className="stat-box">ID: {currentUser.email.split('@')[0]}</div>
            <div className="stat-box">TOKENS: <span className="neon-gold">{playerData.tokens}</span></div>
            <button onClick={handleLogout} className="exit-btn">EXIT</button>
        </div>
      </header>

      <div className="chaos-rule-strip">
        <div className="rule-info">
            <span className="rule-label">CURRENT RULE</span>
            <span className="rule-name">{activeChaosRule}</span>
        </div>
        <div className="rule-actions">
            <span className="timer-text">T-MINUS: {formatTime(chaosTimeLeft)}</span>
            <button onClick={skipChaosRule} className="skip-btn">SKIP (-2 🪙)</button>
        </div>
      </div>

      <div className="borderland-layer">
        <div className="game-console">
            
            <div className="gateway-panel">
                <h2 className="panel-title">BORDERLAND PROTOCOL</h2>
                
                {playerData.activeGame ? (
                    <div className="active-mission-screen">
                          <div className="game-countdown">{formatTime(gameTimeLeft)}</div>
                          <h1 className="mission-title">{playerData.activeGame.gameId}</h1>
                          <h2 className="game-name">{GAME_DATABASE[playerData.activeGame.gameId]?.title || "UNKNOWN"}</h2>
                          <p className="game-desc">{GAME_DATABASE[playerData.activeGame.gameId]?.description}</p>
                          <div className="loc-display">LOC: {GAME_DATABASE[playerData.activeGame.gameId]?.location}</div>
                          <button onClick={quitGame} className="forfeit-btn">FORFEIT</button>
                    </div>
                ) : (
                    <div className="cards-wrapper">
                        <div className="suit-container">
                            {selectedCategory === 'HEART' ? (
                                <div className="level-grid">
                                    <p>SELECT DICE ROLL</p>
                                    <div className="dice-row">
                                        {[1,2,3,4,5,6].map(n => <button key={n} onClick={() => startMission('HEART', n)} className="dice-btn">{n}</button>)}
                                    </div>
                                    <button onClick={() => setSelectedCategory(null)} className="back-btn">CANCEL</button>
                                </div>
                            ) : (
                                <div className="card-wrapper">
                                    <button className="suit-card heart-card" onClick={() => setSelectedCategory('HEART')} disabled={isHeartLocked}>
                                        <div className="suit-icon">♥</div>
                                        <div className="suit-name">HEART</div>
                                        <div className="suit-type">SOCIAL / EMOTIONAL</div>
                                    </button>
                                    {isHeartLocked && (
                                        <div className="locked-overlay">
                                            <div className="lock-icon">🔒</div>
                                            <button onClick={unlockCategory} className="unlock-btn">UNLOCK (-2 🪙)</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="suit-container">
                            {selectedCategory === 'SPADE' ? (
                                <div className="level-grid">
                                    <p>SELECT DICE ROLL</p>
                                    <div className="dice-row">
                                        {[1,2,3,4,5,6].map(n => <button key={n} onClick={() => startMission('SPADE', n)} className="dice-btn">{n}</button>)}
                                    </div>
                                    <button onClick={() => setSelectedCategory(null)} className="back-btn">CANCEL</button>
                                </div>
                            ) : (
                                <div className="card-wrapper">
                                    <button className="suit-card spade-card" onClick={() => setSelectedCategory('SPADE')} disabled={isSpadeLocked}>
                                        <div className="suit-icon">♠</div>
                                        <div className="suit-name">SPADE</div>
                                        <div className="suit-type">LOGIC / INTELLECT</div>
                                    </button>
                                    {isSpadeLocked && (
                                        <div className="locked-overlay">
                                            <div className="lock-icon">🔒</div>
                                            <button onClick={unlockCategory} className="unlock-btn">UNLOCK (-2 🪙)</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="data-sidebar">
                <div className="sidebar-box">
                   <div className="box-header">LIVE RANKINGS <span className="blink">●</span></div>
                   <Leaderboard limitCount={10} />
                </div>

                <div className="sidebar-box">
                   <div className="box-header">MISSION HISTORY</div>
                   <div className="history-content">
                      <div className="history-row">
                         <span style={{color:'#ff0055', fontWeight:'bold'}}>♥</span>: {playerData.completedGames?.filter(g => g.startsWith('HEART')).map(g => g.split('_')[1]).join(', ') || '-'}
                      </div>
                      <div className="history-row">
                         <span style={{color:'#00ccff', fontWeight:'bold'}}>♠</span>: {playerData.completedGames?.filter(g => g.startsWith('SPADE')).map(g => g.split('_')[1]).join(', ') || '-'}
                      </div>
                   </div>
                </div>

                <div className="sidebar-box">
                    <div className="box-header">SYSTEM LOGS</div>
                    <div className="logs-container">
                        {systemLogs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
