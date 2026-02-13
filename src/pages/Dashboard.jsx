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

const CHAOS_DURATION_SEC = 600; 
const GAME_DURATION_SEC = 600;  
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

  useEffect(() => {
    if (!currentUser?.uid) return;
    const syncChaosTimer = async () => {
        const now = Math.floor(Date.now() / 1000); 
        const currentCycleIndex = Math.floor(now / CHAOS_DURATION_SEC);
        if (lastCycleRef.current !== null && currentCycleIndex > lastCycleRef.current) {
            try {
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, { score: increment(1) });
                addLog("RULE SURVIVED: +1 SCORE");
            } catch (err) { console.error(err); }
        }
        lastCycleRef.current = currentCycleIndex;
        const elapsedInCycle = now % CHAOS_DURATION_SEC;
        const remaining = CHAOS_DURATION_SEC - elapsedInCycle;
        setChaosTimeLeft(remaining);
        setActiveChaosRule(CHAOS_RULES[currentCycleIndex % CHAOS_RULES.length]);
    };
    syncChaosTimer();
    const timer = setInterval(syncChaosTimer, 1000);
    return () => clearInterval(timer);
  }, [currentUser]); 

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
  };

  const startMission = async (category, level) => {
    if (playerData.lastPlayedCategory === category && !playerData.unlockedSameCategory) {
        alert("PROTOCOL VIOLATION: Alternate categories.");
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
      setSelectedCategory(null);
    } catch (err) { console.error(err); } finally { setLoadingDice(false); }
  };

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if (!playerData) return <div className="loading">INITIALIZING...</div>;

  const currentScore = Math.max(playerData.score || 0, playerData.completedGames?.length || 0);

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
        <div className="rule-timer">T-MINUS: {formatTime(chaosTimeLeft)}</div>
      </div>

      <div className="borderland-layer">
        <div className="game-console">
            <div className="gateway-panel">
                <h2 className="panel-title">BORDERLAND PROTOCOL</h2>
                
                {playerData.activeGame ? (
                    <div className="active-mission-screen">
                          <div className="game-countdown">{formatTime(gameTimeLeft)}</div>
                          <h1 className="mission-title">{playerData.activeGame.gameId}</h1>
                          <h2 className="game-name">{GAME_DATABASE[playerData.activeGame.gameId]?.title}</h2>
                          <div className="loc-display">LOC: {GAME_DATABASE[playerData.activeGame.gameId]?.location}</div>
                    </div>
                ) : (
                    <div className="cards-wrapper">
                        {['HEART', 'SPADE'].map(cat => (
                           <div key={cat} className="suit-selection-container">
                              {selectedCategory === cat ? (
                                 <div className="level-grid-overlay">
                                    <p>SELECT DICE LEVEL</p>
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
                                    {playerData.lastPlayedCategory === cat && !playerData.unlockedSameCategory && <div className="lock-text">LOCKED</div>}
                                 </button>
                              )}
                           </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="data-sidebar">
                <div className="sidebar-container ranking-box">
                   <div className="sidebar-label">LIVE RANKINGS <span className="blink">● LIVE</span></div>
                   <Leaderboard limitCount={10} />
                </div>

                <div className="sidebar-container history-box">
                   <div className="sidebar-label">MISSION HISTORY</div>
                   <div className="history-content">
                      <div className="history-line"><span className="heart-icon">♥</span>: {playerData.completedGames?.filter(g => g.startsWith('HEART')).map(g => g.split('_')[1]).join(', ') || 'None'}</div>
                      <div className="history-line"><span className="spade-icon">♠</span>: {playerData.completedGames?.filter(g => g.startsWith('SPADE')).map(g => g.split('_')[1]).join(', ') || 'None'}</div>
                   </div>
                </div>

                <div className="sidebar-container logs-box">
                    <div className="sidebar-label">SYSTEM LOGS</div>
                    <div className="logs-scroll">
                        {systemLogs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
