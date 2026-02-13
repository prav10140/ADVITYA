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
  const [selectedCategory, setSelectedCategory] = useState(null); // Tracking manual level selection
   
  // LAYER 1: CHAOS ROOM STATE
  const [activeChaosRule, setActiveChaosRule] = useState("INITIALIZING...");
  const [chaosTimeLeft, setChaosTimeLeft] = useState(CHAOS_DURATION_SEC);
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

  // --- 2. CHAOS TIMER & RULE SCORE LOGIC ---
  useEffect(() => {
    if (!currentUser?.uid) return;

    const syncChaosTimer = async () => {
        const now = Math.floor(Date.now() / 1000); 
        const currentCycleIndex = Math.floor(now / CHAOS_DURATION_SEC);
        
        // Award point if 10-minute cycle changed while user was online
        if (lastCycleRef.current !== null && currentCycleIndex > lastCycleRef.current) {
            try {
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, { score: increment(1) });
                addLog("RULE SURVIVED: +1 SCORE");
            } catch (err) {
                console.error("Score sync error:", err);
            }
        }
        
        lastCycleRef.current = currentCycleIndex;
        const elapsedInCycle = now % CHAOS_DURATION_SEC;
        setChaosTimeLeft(CHAOS_DURATION_SEC - elapsedInCycle);
        setActiveChaosRule(CHAOS_RULES[currentCycleIndex % CHAOS_RULES.length]);
    };

    syncChaosTimer();
    const timer = setInterval(syncChaosTimer, 1000);
    return () => clearInterval(timer);
  }, [currentUser]); 

  // --- 3. MISSION TIMER LOGIC (AUTO-COMPLETE AT 0:00) ---
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
            score: increment(1)
        });
        
        addLog(`SURVIVAL COMPLETE: +1 SCORE AWARDED`);
        alert(`TIME UP. MISSION COMPLETE.`);

    } catch (err) {
        console.error("Auto-complete error:", err);
    } finally {
        setLoadingDice(false);
    }
  };

  const startMission = async (category, level) => {
    const lastCategory = playerData.lastPlayedCategory;
    if (lastCategory === category && !playerData.unlockedSameCategory) {
        alert("PROTOCOL VIOLATION: Alternate categories or use Tokens to bypass.");
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

  const skipChaosRule = async () => {
    if (playerData.tokens < 2) { alert("INSUFFICIENT VISAS."); return; }
    await updateDoc(doc(db, "users", currentUser.uid), { tokens: increment(-2) });
    addLog(`CHAOS RULE SKIPPED (-2 TOKENS)`);
  };

  const quitGame = async () => {
      if(window.confirm("Forfeit mission? Your record will not be updated.")) {
          await updateDoc(doc(db, "users", currentUser.uid), { activeGame: null });
          addLog("MISSION ABORTED");
      }
  }

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if (!playerData) return <div className="loading-screen">INITIALIZING ADVITYA OS...</div>;

  const currentScore = Math.max(
      playerData.score || 0, 
      playerData.completedGames ? playerData.completedGames.length : 0
  );

  return (
    <div className="chaos-room-shell">
      {/* HEADER: MATCHES IMAGE_D0761A.JPG */}
      <header className="chaos-header">
        <div className="system-status">
            <div className="blink-dot"></div>
            <span>CHAOS ROOM // ONLINE</span>
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

      {/* RULE STRIP: PINK HIGHLIGHT AS SEEN IN IMAGE_D0761A.JPG */}
      <div className="chaos-rule-strip">
        <div className="rule-info">
            <span className="current-rule-label">CURRENT RULE</span>
            <span className="rule-name">{activeChaosRule}</span>
        </div>
        <div className="rule-timer-container">
            <span className="timer-text">T-MINUS: {formatTime(chaosTimeLeft)}</span>
            <button onClick={skipChaosRule} className="skip-btn">SKIP (-2 🪙)</button>
        </div>
      </div>

      <div className="borderland-layer">
        <div className="game-console">
            
            {/* LEFT: BORDERLAND PROTOCOL PANEL */}
            <div className="gateway-panel">
                <h2 className="panel-title">BORDERLAND PROTOCOL</h2>
                
                {playerData.activeGame ? (
                    <div className="active-mission-screen">
                          <div className="game-countdown">{formatTime(gameTimeLeft)}</div>
                          <h1 className="mission-title">{playerData.activeGame.gameId}</h1>
                          <h2 className="game-name" style={{color: playerData.activeGame.category === 'HEART' ? '#ff0055' : '#00ccff'}}>
                             {GAME_DATABASE[playerData.activeGame.gameId]?.title || "UNKNOWN MISSION"}
                          </h2>
                          <p className="game-desc">{GAME_DATABASE[playerData.activeGame.gameId]?.description}</p>
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
                                    <span className="suit-subtitle">{cat === 'HEART' ? 'SOCIAL / EMOTIONAL' : 'LOGIC / INTELLECT'}</span>
                                    {playerData.lastPlayedCategory === cat && !playerData.unlockedSameCategory && <div className="lock-tag">LOCKED</div>}
                                 </button>
                              )}
                           </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* RIGHT: THREE-PART SIDEBAR MATCHING IMAGE_D071A2.JPG */}
            <div className="data-sidebar">
                
                <div className="sidebar-box ranking-box">
                   <div className="sidebar-header">LIVE RANKINGS <span className="blink">● LIVE</span></div>
                   <Leaderboard limitCount={8} />
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
