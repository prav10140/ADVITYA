// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, auth } from "../firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { GAME_DATABASE } from "../gameConfig"; 
import "./Dashboard.css"; 

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loadingDice, setLoadingDice] = useState(false);
  
  // LAYER 1: CHAOS ROOM STATE
  const [activeChaosRule, setActiveChaosRule] = useState("SIT-STAND");
  const [chaosPenalty, setChaosPenalty] = useState(1); // Starts at -1, then -3, -5...
  
  // LOGS
  const [systemLogs, setSystemLogs] = useState([]);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    if (!currentUser?.uid) return;

    // A. Listen to Database
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (doc) => {
      setPlayerData(doc.data());
    });

    // B. Chaos Rule Rotator (Changes every 5 minutes in real life, or static for now)
    const rules = ["FLOOR IS LAVA", "SIT-STAND", "COMPLETE SILENCE", "SLOW MOTION"];
    const ruleInterval = setInterval(() => {
        const randomRule = rules[Math.floor(Math.random() * rules.length)];
        setActiveChaosRule(randomRule);
        addLog(`CHAOS EVENT: ${randomRule} ACTIVE`);
    }, 60000); // Changes every 60 seconds for demo

    return () => { unsub(); clearInterval(ruleInterval); };
  }, [currentUser]);

  // Helper to add logs
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
  };

  // --- 2. GAMEPLAY LOGIC ---

  // ROLL DICE (Enter Layer 2)
  const rollDice = async (category) => {
    // ALTERNATING RULE CHECK
    const lastCategory = playerData.lastPlayedCategory; // We need to store this in DB
    
    // If attempting to play the same category twice in a row (and hasn't paid to unlock)
    if (lastCategory === category && !playerData.unlockedSameCategory) {
        alert("PROTOCOL VIOLATION: You must alternate categories (Heart ↔ Spade). Pay 2 tokens to bypass.");
        return;
    }

    setLoadingDice(true);
    setTimeout(async () => {
      try {
        // Generate Level (User gets to choose difficulty in your doc, but dice is cooler. 
        // Let's stick to Dice for randomness, or we can make them choose. 
        // Logic: Dice decides difficulty 1-6)
        const level = Math.floor(Math.random() * 6) + 1;
        const gameId = `${category}_${level}`;
        const userRef = doc(db, "users", currentUser.uid);

        await updateDoc(userRef, {
            activeGame: {
                category, level, gameId,
                startedAt: serverTimestamp()
            },
            lastPlayedCategory: category,
            unlockedSameCategory: false // Reset the unlock flag
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
    await updateDoc(userRef, {
        tokens: increment(-2)
    });
    addLog(`CHAOS RULE SKIPPED (-2 TOKENS)`);
    alert("RULE BYPASSED. YOU ARE IMMUNE FOR THIS PHASE.");
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

      {/* LAYER 1: CHAOS RULE BANNER (Always Active) */}
      <div className="chaos-rule-strip">
        <div className="rule-display">
            <span className="rule-label">CURRENT RULE</span>
            <span className="active-rule-text">{activeChaosRule}</span>
        </div>
        <button onClick={skipChaosRule} className="skip-btn">
            SKIP RULE (-2 🪙)
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
                         <h1 style={{fontSize:'4rem', margin:0, color:'#fff'}}>LEVEL {playerData.activeGame.level}</h1>
                         <h2 style={{color: playerData.activeGame.category === 'HEART' ? '#ff0055' : '#00ccff', textShadow:'0 0 10px currentColor'}}>
                            {GAME_DATABASE[playerData.activeGame.gameId]?.title || "UNKNOWN"}
                         </h2>
                         <p style={{color:'#fff', maxWidth:'80%'}}>
                            {GAME_DATABASE[playerData.activeGame.gameId]?.description}
                         </p>
                         <div style={{marginTop:'20px', background:'#000', padding:'10px 20px', color:'#0f0', border:'1px solid #0f0'}}>
                            LOC: {GAME_DATABASE[playerData.activeGame.gameId]?.location}
                         </div>
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
                            
                            {/* LOCK OVERLAY (If played Heart last) */}
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
                             
                            {/* LOCK OVERLAY (If played Spade last) */}
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