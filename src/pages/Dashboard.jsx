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

      // Only sync timer if activeGame exists in DB
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

  // --- 2. CHAOS RULE TIMER (VISUAL ONLY - NO FREE POINTS) ---
  useEffect(() => {
    const syncChaosTimer = async () => {
        const now = Math.floor(Date.now() / 1000); 
        const currentCycleIndex = Math.floor(now / CHAOS_DURATION_SEC);
        lastCycleRef.current = currentCycleIndex;

        const elapsedInCycle = now % CHAOS_DURATION_SEC;
        setChaosTimeLeft(CHAOS_DURATION_SEC - elapsedInCycle);
        setActiveChaosRule(CHAOS_RULES[currentCycleIndex % CHAOS_RULES.length]);
    };

    syncChaosTimer();
    const timer = setInterval(syncChaosTimer, 1000);
    return () => clearInterval(timer);
  }, []); 

  // --- 3. MISSION TIMER LOGIC ---
  useEffect(() => {
    // Safety check: If timer is null, DO NOT run logic
    if (gameTimeLeft === null) return; 

    if (gameTimeLeft <= 0) {
        handleTimeSuccess();
        return;
    }

    const gameTimer = setInterval(() => {
        setGameTimeLeft((prev) => {
            // Safety: If it became null mid-interval (due to forfeit), stop.
            if (prev === null) return null;

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

  const handleTimeSuccess = async () => {
    // CRITICAL: Double check activeGame exists before awarding points
    if (!playerData?.activeGame) return;
    if (loadingDice) return; 
    setLoadingDice(true);

    try {
        const userRef = doc(db, "users", currentUser.uid);
        const completedGameId = playerData.activeGame.gameId;

        await updateDoc(userRef, {
            activeGame: null,
            completedGames: arrayUnion(completedGameId),
            score: increment(1) // +1 Only on Time Success
        });
        
        addLog(`MISSION SUCCESS: +1 SCORE AWARDED`);
        alert(`TIME UP. MISSION COMPLETE.`);

    } catch (err) {
        console.error("Auto-complete error:", err);
    } finally {
        setLoadingDice(false);
    }
  };

  // --- START GAME (MANUAL DICE) ---
  const startMission = async (category, level) => {
    const lastCategory = playerData.lastPlayedCategory;
    if (lastCategory === category && !playerData.unlockedSameCategory) {
        alert("PROTOCOL VIOLATION: Alternate categories or use Tokens.");
        return;
    }

    setLoadingDice(true);
    try {
      const gameId = `${category}_${level}`;
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
          activeGame: { category, level, gameId, startedAt: serverTimestamp() },
          lastPlayedCategory: category,
          unlockedSameCategory: false
      });
      addLog(`ENTERING BORDERLAND: ${gameId}`);
      setSelectedCategory(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDice(false);
    }
  };

  // --- PENALTY: DEDUCT POINT FOR SKIPPING RULE ---
  const skipChaosRule = async () => {
    if (playerData.score < 1) { 
        alert("INSUFFICIENT SCORE TO SKIP."); 
        return; 
    }
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { 
        score: increment(-1) // CUTTING POINT (-1)
    });
    addLog(`CHAOS RULE SKIPPED (-1 SCORE POINT)`);
    alert("RULE BYPASSED. PENALTY: -1 SCORE POINT.");
  };

  // --- FORFEIT GAME (FIXED: NO POINTS AWARDED) ---
  const quitGame = async () => {
      if(!window.confirm("Give up? No rewards for quitters.")) return;
      
      // 1. KILL TIMER IMMEDIATELY (Fixes race condition bug)
      setGameTimeLeft(null);
      
      // 2. OPTIMISTIC UPDATE (Stops handleTimeSuccess from firing)
      setPlayerData(prev => ({...prev, activeGame: null}));

      // 3. DATABASE UPDATE (Clear game, NO Score Increment)
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { activeGame: null });
      
      addLog(`MISSION ABORTED (0 POINTS)`);
  }

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if (!playerData) return <div className="loading-screen">INITIALIZING ADVITYA OS...</div>;

  // STRICT SCORE DISPLAY (Shows negatives if they skip too much)
  const currentScore = playerData.score || 0;

  return (
    <div className="chaos-room-shell">
      <header className="chaos-header">
        <div className="system-status">
            <div className="blink-dot"></div><span>CHAOS ROOM // ONLINE</span>
        </div>
        <div className="header-stats">
            {(playerData.role === 'admin' || playerData.role === 'manager') && (
                <button onClick={() => navigate('/admin')} className="manager-panel-btn">MANAGER PANEL</button>
            )}
            <div className="stat-box">SCORE: {currentScore}</div>
            <div className="stat-box">ID: {currentUser.email.split('@')[0]}</div>
            <div className="stat-box">TOKENS: <span className="token-text">{playerData.tokens}</span></div>
            <button onClick={handleLogout} className="exit-btn">EXIT</button>
        </div>
      </header>

      <div className="chaos-rule-strip">
        <div className="rule-info">
            <span className="current-rule-label">CURRENT RULE</span>
            <span className="rule-name">{activeChaosRule}</span>
        </div>
        <div className="rule-timer-container">
            <span className="timer-text">T-MINUS: {formatTime(chaosTimeLeft)}</span>
            <button onClick={skipChaosRule} className="skip-btn">SKIP (-1 🏆)</button>
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
                          <h2 className="game-name" style={{color: playerData.activeGame.category === 'HEART' ? '#ff0055' : '#00ccff'}}>
                             {GAME_DATABASE[playerData.activeGame.gameId]?.title || "UNKNOWN MISSION"}
                          </h2>
                          <div className="loc-display">LOC: {GAME_DATABASE[playerData.activeGame.gameId]?.location}</div>
                          <button onClick={quitGame} className="forfeit-btn">FORFEIT MISSION</button>
                    </div>
                ) : (
                    <div className="cards-wrapper">
                        {['HEART', 'SPADE'].map(cat => (
                           <div key={cat} className="suit-container">
                              {selectedCategory === cat ? (
                                 <div className="level-grid-overlay">
                                    <p className="dice-instruction">INPUT PHYSICAL DICE RESULT</p>
                                    <div className="dice-numbers">
                                        {[1,2,3,4,5,6].map(num => (
                                           <button key={num} onClick={() => startMission(cat, num)} className="dice-btn">{num}</button>
                                        ))}
                                    </div>
                                    <button onClick={() => setSelectedCategory(null)} className="back-btn">CANCEL</button>
                                 </div>
                              ) : (
                                 <button className={`suit-card ${cat.toLowerCase()}`} onClick={() => setSelectedCategory(cat)} disabled={loadingDice}>
                                    <div className="suit-symbol" style={{color: cat === 'HEART' ? '#ff0055' : '#00ccff'}}>{cat === 'HEART' ? '♥' : '♠'}</div>
                                    <span className="suit-label">{cat}</span>
                                    {playerData.lastPlayedCategory === cat && !playerData.unlockedSameCategory && <div className="lock-tag">LOCKED</div>}
                                 </button>
                              )}
                           </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="data-sidebar">
                <div className="sidebar-box ranking-box">
                   <div className="sidebar-header">LIVE RANKINGS <span className="blink">● LIVE</span></div>
                   <Leaderboard limitCount={10} />
                </div>

                <div className="sidebar-box history-box">
                   <div className="sidebar-header">MISSION HISTORY</div>
                   <div className="history-content">
                      <div className="history-item">
                         <span className="icon-pink">♥</span>: {playerData.completedGames?.filter(g => g.startsWith('HEART')).map(g => g.split('_')[1]).join(', ') || 'None'}
                      </div>
                      <div className="history-item">
                         <span className="icon-blue">♠</span>: {playerData.completedGames?.filter(g => g.startsWith('SPADE')).map(g => g.split('_')[1]).join(', ') || 'None'}
                      </div>
                   </div>
                </div>

                <div className="sidebar-box logs-box">
                    <div className="sidebar-header">SYSTEM LOGS</div>
                    <div className="logs-container">
                        {systemLogs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                    </div>
                </div>
            </div>
        </div>
      </div>
      <footer className="chaos-footer">
        <div className="ticker-text">
            WARNING: VISA EXPIRY IMMINENT // CURRENT RULE: {activeChaosRule} // PENALTY FOR FAILURE: INCREMENTAL // TRUST NO ONE // 
        </div>
      </footer>
    </div>
  );
}
