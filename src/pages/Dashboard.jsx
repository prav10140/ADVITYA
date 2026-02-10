// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, auth } from "../firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { GAME_DATABASE } from "../gameConfig"; 
import "./Dashboard.css"; 

// --- CONFIGURATION ---
const CHAOS_DURATION_SEC = 600; // 10 Minutes
const GAME_DURATION_SEC = 600;  // 10 Minutes

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loadingDice, setLoadingDice] = useState(false);
  
  // LAYER 1: CHAOS ROOM STATE
  const [activeChaosRule, setActiveChaosRule] = useState("SIT-STAND");
  const [chaosTimeLeft, setChaosTimeLeft] = useState(CHAOS_DURATION_SEC);
  
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

    // A. Listen to Database
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (doc) => {
      const data = doc.data();
      setPlayerData(data);

      // Check if there is an active game to sync timer
      if (data?.activeGame?.startedAt) {
        // Calculate how much time has passed since server start time
        const startTime = data.activeGame.startedAt.toDate().getTime(); // Firebase Timestamp to JS Date
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

  // --- 2. CHAOS TIMER LOGIC ---
  useEffect(() => {
    // Determine Rules
    const rules = ["FLOOR IS LAVA", "SIT-STAND", "COMPLETE SILENCE", "SLOW MOTION", "ONE HAND ONLY"];
    
    const timer = setInterval(() => {
        setChaosTimeLeft((prev) => {
            if (prev <= 1) {
                // Time is up, switch rule and reset timer
                const randomRule = rules[Math.floor(Math.random() * rules.length)];
                setActiveChaosRule(randomRule);
                addLog(`CHAOS EVENT: ${randomRule} ACTIVE`);
                return CHAOS_DURATION_SEC; // Reset to 10 mins
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // --- 3. GAME TIMER LOGIC ---
  useEffect(() => {
    if (gameTimeLeft === null) return; // No game active

    if (gameTimeLeft <= 0) {
        handleGameExpiry();
        return;
    }

    const gameTimer = setInterval(() => {
        setGameTimeLeft((prev) => {
            if (prev <= 1) {
                handleGameExpiry();
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

  // EXPIRE GAME (When timer hits 0)
  const handleGameExpiry = async () => {
    if (!playerData?.activeGame) return;
    
    // Clear the active game in DB
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
        activeGame: null
    });
    
    addLog(`MISSION FAILED: TIME EXPIRED`);
    alert("TIME IS UP. GAME OVER.");
  };

  // ROLL DICE (Enter Layer 2)
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
                startedAt: serverTimestamp() // This timestamp drives the timer
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

  // SKIP CHAOS RULE (-2 Tokens)
  const skipChaosRule = async () => {
    if (playerData.tokens < 2) {
        alert("INSUFFICIENT VISAS."); 
        return;
    }
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { tokens: increment(-2) });
    addLog(`CHAOS RULE SKIPPED (-2 TOKENS)`);
    alert("RULE BYPASSED. IMMUNE FOR THIS PHASE.");
  };

  // UNLOCK CATEGORY LOCK (-2 Tokens)
  const unlockCategory = async () => {
    if (playerData.tokens < 2) return alert("INSUFFICIENT VISAS.");
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
        tokens: increment(-2),
        unlockedSameCategory: true
    });
    addLog(`CATEGORY LOCK OVERRIDDEN (-2 TOKENS)`);
  };

  // QUIT GAME MANUAL
  const quitGame = async () => {
      const confirm = window.confirm("Give up? There are no rewards for quitters.");
      if(confirm) handleGameExpiry();
  }

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  if (!playerData) return <div style={{background:'#000', color:'#0f0', height:'100vh', padding:'20px'}}>INITIALIZING CHAOS OS...</div>;

  return (
    <div className="chaos-room-shell">
      
      {/* HEADER */}
      <header className="chaos-header">
        <div className="system-status">
            <div className="blink-dot"></div>
            <span>CHAOS ROOM // ONLINE</span>
        </div>
        <div className="user-id">
            ID: {currentUser.email.split('@')[0]} | TOKENS: <span style={{color: '#ffd700'}}>{playerData.tokens}</span>
        </div>
        <button onClick={handleLogout} style={{background:'transparent', border:'1px solid #0f0', color:'#0f0', cursor:'pointer'}}>EXIT</button>
      </header>

      {/* LAYER 1: CHAOS RULE BANNER (10 MIN TIMER) */}
      <div className="chaos-rule-strip">
        <div className="rule-display">
            <span className="rule-label">CURRENT RULE</span>
            <span className="active-rule-text">{activeChaosRule}</span>
        </div>
        
        {/* RULE TIMER */}
        <div className="rule-timer" style={{fontFamily:'monospace', fontSize:'1.2rem', color: chaosTimeLeft < 60 ? 'red' : '#0f0'}}>
            T-MINUS: {formatTime(chaosTimeLeft)}
        </div>

        <button onClick={skipChaosRule} className="skip-btn">
            SKIP (-2 🪙)
        </button>
      </div>

      {/* LAYER 2: BORDERLAND INTERFACE */}
      <div className="borderland-layer">
        <div className="game-console">
            
            {/* LEFT PANEL: The Gateway */}
            <div className="gateway-panel">
                <h2 className="panel-title">BORDERLAND PROTOCOL</h2>
                
                {playerData.activeGame ? (
                    // ACTIVE GAME SCREEN
                    <div className="active-mission-screen">
                         
                         {/* GAME COUNTDOWN TIMER */}
                         <div style={{
                             fontSize: '3rem', 
                             fontFamily: 'monospace', 
                             color: gameTimeLeft < 60 ? '#ff0000' : '#fff',
                             border: '2px solid currentColor',
                             padding: '10px 20px',
                             marginBottom: '20px',
                             textShadow: '0 0 10px currentColor'
                         }}>
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

                         <button 
                            onClick={quitGame}
                            style={{marginTop:'20px', background:'#333', color:'#fff', border:'none', padding:'10px', cursor:'pointer'}}
                         >
                             FORFEIT GAME
                         </button>
                    </div>
                ) : (
                    // SELECTION SCREEN
                    <div className="cards-wrapper">
                        
                        {/* HEART CARD */}
                        <div style={{position: 'relative', flex: 1}}>
                            <button 
                                className="card-btn card-heart"
                                onClick={() => rollDice("HEART")}
                                disabled={loadingDice}
                                style={{width: '100%', height: '100%'}}
                            >
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

                        {/* SPADE CARD */}
                        <div style={{position: 'relative', flex: 1}}>
                            <button 
                                className="card-btn card-spade"
                                onClick={() => rollDice("SPADE")}
                                disabled={loadingDice}
                                style={{width: '100%', height: '100%'}}
                            >
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

            {/* RIGHT PANEL: System Logs */}
            <div className="data-sidebar">
                <div style={{borderBottom:'1px solid #0f0', marginBottom:'10px'}}>SYSTEM LOGS</div>
                {systemLogs.map((log, i) => (
                    <div key={i} className="log-entry">{log}</div>
                ))}
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
