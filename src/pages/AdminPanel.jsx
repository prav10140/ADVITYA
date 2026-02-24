// src/pages/AdminPanel.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { GAME_DATABASE } from "../gameConfig";
import "./AdminPanel.css"; 

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    });
    return () => unsub();
  }, []);

  // --- DYNAMIC OUTCOME VERIFICATION ---
  const applyOutcome = async (userId, gameData, outcome) => {
    if(!window.confirm(`Apply outcome: ${outcome.label}?`)) return;
    
    setLoading(true);
    try {
      let finalTokens = outcome.tokens || 0;

      // Handle custom wagers for Spade 5
      if (outcome.isWager) {
        const wagerInput = prompt("Enter the Token Wager amount:");
        if (!wagerInput || isNaN(wagerInput)) {
            alert("Invalid wager amount.");
            setLoading(false);
            return;
        }
        finalTokens = outcome.win ? parseInt(wagerInput) : -parseInt(wagerInput);
      }

      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        activeGame: null,
        completedGames: arrayUnion(gameData.gameId),
        score: increment(outcome.score), // +1 if win, +0 if loss
        tokens: increment(finalTokens)   // Adds or subtracts based on config
      });

    } catch (err) { alert("Error: " + err.message); } 
    finally { setLoading(false); }
  };

  const cancelGame = async (userId) => {
    if(!window.confirm("Cancel mission? No tokens or score will be affected.")) return;
    try { await updateDoc(doc(db, "users", userId), { activeGame: null }); } 
    catch (err) { alert(err.message); }
  };

  const adjustTokens = async (userId, amount) => {
    const reason = prompt("Reason for manual token adjustment?");
    if (!reason) return;
    try { await updateDoc(doc(db, "users", userId), { tokens: increment(amount) }); } 
    catch (err) { alert(err.message); }
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>MANAGER CONTROL TERMINAL</h1>
        <button onClick={() => navigate('/dashboard')} className="back-btn">RETURN TO DASHBOARD</button>
      </header>

      <div className="admin-content">
        <table className="admin-table">
          <thead>
            <tr>
              <th>PLAYER ID</th>
              <th>MISSION</th>
              <th>VERIFY OUTCOME (TOKENS)</th>
              <th>TOKENS</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              if (!user.activeGame) return null; // Only show active players for managers
              
              const gameDetails = GAME_DATABASE[user.activeGame.gameId];
              
              return (
              <tr key={user.id} className="row-active">
                <td className="id-col">
                    {user.email?.split('@')[0]}
                    <div className="score-sub">Score: {user.score || 0}</div>
                </td>

                <td className="mission-col">
                    <div className="mission-info">
                        <span className="m-id" style={{color: user.activeGame.category === 'HEART' ? '#ff0055' : '#00ccff'}}>
                            {user.activeGame.gameId}
                        </span>
                        <span className="m-cat">{gameDetails?.title || "Unknown"}</span>
                    </div>
                </td>

                <td className="actions-col">
                    {/* DYNAMIC BUTTONS GENERATED FROM gameConfig.js */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {gameDetails?.outcomes?.map((outcome, idx) => (
                            <button 
                                key={idx} 
                                className="btn-verify"
                                style={{
                                    background: outcome.tokens > 0 || outcome.win ? '#00ff41' : (outcome.tokens < 0 || outcome.win === false ? '#ff0055' : '#555'),
                                    color: outcome.tokens > 0 || outcome.win ? '#000' : '#fff'
                                }} 
                                onClick={() => applyOutcome(user.id, user.activeGame, outcome)}
                                disabled={loading}
                            >
                                {outcome.label}
                            </button>
                        ))}
                    </div>
                    <button className="btn-cancel" onClick={() => cancelGame(user.id)} style={{marginTop: '10px', width: '100%'}}>
                        ❌ CANCEL GAME
                    </button>
                </td>

                <td className="tokens-col">
                    <span style={{color:'#ffd700'}}>{user.tokens}</span>
                    <div className="token-btns">
                        <button onClick={() => adjustTokens(user.id, 1)} className="t-btn">+</button>
                        <button onClick={() => adjustTokens(user.id, -1)} className="t-btn">-</button>
                    </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}