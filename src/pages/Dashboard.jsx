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
  const [selectedCategory, setSelectedCategory] = useState(null); // Tracking click for level selection
   
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

  useEffect(() => {
    if (gameTimeLeft === null) return; 
    if (gameTimeLeft <= 0) { handleTimeSuccess(); return; }
    const gameTimer = setInterval(() => {
        setGameTimeLeft((prev) => {
            if (prev <= 1) { handleTimeSuccess(); return 0; }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(gameTimer);
  }, [gameTimeLeft]);

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
        addLog(`SURVIVAL COMPLETE: ${completedGameId}`);
        alert(`TIME UP. MISSION COMPLETE.`);
    } catch (err) { console.error(err); } finally { setLoadingDice(false); }
  };

  // Start mission based on Manual Level Selection
  const startMission = async (category, level) => {
    const lastCategory = playerData.lastPlayedCategory;
    if (lastCategory === category && !playerData.unlockedSameCategory) {
        alert("PROTOCOL VIOLATION: Alternate categories or pay 2 tokens.");
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
    } catch (err) { console.error(err); } finally { setLoadingDice(false); }
  };

  const quitGame = async () => {
      if(!window.confirm("Give up? No rewards for quitters.")) return;
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { activeGame: null });
      addLog(`MISSION ABORTED`);
  }

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if (!playerData) return <div style={{background:'#000', color:'#0f0', height:'100vh', padding:'20px'}}>INITIALIZING...</div>;

  const currentScore = Math.max(playerData.score || 0, playerData.completedGames ? playerData.completedGames.length : 0);

  return (
    <div className="chaos-room-shell">
      <header className="chaos-header">
        <div className="system-status">
            <div className="blink-dot"></div><span>CHAOS ROOM // ONLINE</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
            {(playerData.role === 'admin' || playerData.role === 'manager') && (
                <button onClick={() => navigate('/admin')} style={{background: '#ff0055', color: '#fff', border: 'none', padding: '5px 15px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '0.8rem', boxShadow: '0 0 10px #ff0055'}}>MANAGER PANEL</button>
            )}
            <div style={{color: '#00ff41', fontFamily: 'Orbitron', fontSize:'1.2rem'}}>SCORE: {currentScore}</div>
            <div className="user-id">ID: {currentUser.email.split('@')[0]} | TOKENS: <span style={{color: '#ffd700'}}>{playerData.tokens}</span></div>
            <button onClick={handleLogout} style={{background:'transparent', border:'1px solid #0f0', color:'#0f0', cursor:'pointer'}}>EXIT</button>
        </div>
      </header>

      <div className="chaos-rule-strip">
        <div className="rule-display"><span className="rule-label">CURRENT RULE</span><span className="active-rule-text">{activeChaosRule}</span></div>
        <div className="rule-timer" style={{fontFamily:'monospace', fontSize:'1.2rem', color: chaosTimeLeft < 60 ? 'red' : '#0f0'}}>T-MINUS: {formatTime(chaosTimeLeft)}</div>
      </div>

      <div className="borderland-layer">
        <div className="game-console">
            <div className="gateway-panel">
                <h2 className="panel-title">BORDERLAND PROTOCOL</h2>
                
                {playerData.activeGame ? (
                    <div className="active-mission-screen">
                          <div style={{fontSize: '3rem', fontFamily: 'monospace', color: gameTimeLeft < 60 ? '#ff0000' : '#fff', border: '2px solid currentColor', padding: '10px 20px', marginBottom: '20px', textShadow: '0 0 10px currentColor'}}>{formatTime(gameTimeLeft)}</div>
                          <h1 style={{fontSize:'4rem', margin:0, color:'#fff'}}>{playerData.activeGame.gameId}</h1>
                          <h2 style={{color: playerData.activeGame.category === 'HEART' ? '#ff0055' : '#00ccff'}}>{GAME_DATABASE[playerData.activeGame.gameId]?.title || "UNKNOWN"}</h2>
                          <p style={{color:'#fff', maxWidth:'80%', fontSize:'1.1rem'}}>{GAME_DATABASE[playerData.activeGame.gameId]?.description}</p>
                          <div style={{marginTop:'20px', background:'#000', padding:'10px 20px', color:'#0f0', border:'1px solid #0f0'}}>LOC: {GAME_DATABASE[playerData.activeGame.gameId]?.location}</div>
                          <button onClick={quitGame} style={{marginTop:'20px', background:'#333', color:'#fff', border:'1px solid #555', padding:'10px', cursor:'pointer', fontFamily:'Orbitron'}}>FORFEIT</button>
                    </div>
                ) : (
                    <div className="cards-wrapper">
                        {['HEART', 'SPADE'].map(cat => (
                           <div key={cat} style={{position: 'relative', flex: 1}}>
                              {selectedCategory === cat ? (
                                 <div className="level-select-grid">
                                    <p style={{color: '#fff', marginBottom: '10px'}}>SELECT DICE LEVEL</p>
                                    {[1,2,3,4,5,6].map(num => (
                                       <button key={num} onClick={() => startMission(cat, num)} className="level-btn">{num}</button>
                                    ))}
                                    <button onClick={() => setSelectedCategory(null)} className="cancel-btn">BACK</button>
                                 </div>
                              ) : (
                                 <button className={`card-btn card-${cat.toLowerCase()}`} onClick={() => setSelectedCategory(cat)} disabled={loadingDice}>
                                    <div className="suit-icon" style={{color: cat === 'HEART' ? '#ff0055' : '#00ccff'}}>{cat === 'HEART' ? '♥' : '♠'}</div>
                                    <span style={{color:'#fff', fontSize:'1.5rem'}}>{cat}</span>
                                 </button>
                              )}
                              {playerData.lastPlayedCategory === cat && !playerData.unlockedSameCategory && <div className="locked-overlay"><span style={{color:'red'}}>LOCKED</span></div>}
                           </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="data-sidebar">
                <div className="sidebar-section">
                   <div className="sidebar-header">LIVE RANKINGS <span className="blink">● LIVE</span></div>
                   <Leaderboard limitCount={5} />
                </div>

                {/* NEW MISSION HISTORY SECTION */}
                <div className="sidebar-section">
                   <div className="sidebar-header">MISSION HISTORY</div>
                   <div className="history-list">
                      <div className="history-item">
                         <span style={{color: '#ff0055'}}>♥</span>: {playerData.completedGames?.filter(g => g.startsWith('HEART')).map(g => g.split('_')[1]).join(', ') || 'None'}
                      </div>
                      <div className="history-item">
                         <span style={{color: '#00ccff'}}>♠</span>: {playerData.completedGames?.filter(g => g.startsWith('SPADE')).map(g => g.split('_')[1]).join(', ') || 'None'}
                      </div>
                   </div>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-header">SYSTEM LOGS</div>
                    {systemLogs.map((log, i) => <div key={i} className="log-entry">{log}</div>)}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
