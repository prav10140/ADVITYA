import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./AdminPanel.css"; // We will create this CSS next

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- 1. FETCH ALL USERS ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userList);
    });
    return () => unsub();
  }, []);

  // --- 2. MANAGER ACTIONS ---

  // ACTION: Mark Game as Complete (Awards Point)
  const markGameComplete = async (userId, gameData) => {
    if(!window.confirm(`Confirm completion for ${gameData.gameId}?`)) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        activeGame: null,
        completedGames: arrayUnion(gameData.gameId),
        score: increment(1) // <--- CRITICAL FIX: THIS SUMS THE POINTS
      });
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ACTION: Cancel/Forfeit Game (No Point)
  const cancelGame = async (userId) => {
    if(!window.confirm("Cancel this active mission?")) return;
    try {
      await updateDoc(doc(db, "users", userId), {
        activeGame: null
      });
    } catch (err) {
      alert(err.message);
    }
  };

  // ACTION: Add/Remove Tokens (Manual Adjustment)
  const adjustTokens = async (userId, amount) => {
    const reason = prompt("Reason for adjustment?");
    if (!reason) return;
    try {
      await updateDoc(doc(db, "users", userId), {
        tokens: increment(amount)
      });
    } catch (err) {
      alert(err.message);
    }
  };

  // --- FILTER: Only show users with Active Games or recent activity ---
  // You can remove the filter to see everyone, but this is better for live management
  const activePlayers = users.filter(u => u.activeGame || u.role === 'manager');

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>MANAGER CONTROL TERMINAL</h1>
        <button onClick={() => navigate('/dashboard')} className="back-btn">RETURN TO CHAOS ROOM</button>
      </header>

      <div className="admin-content">
        <table className="admin-table">
          <thead>
            <tr>
              <th>PLAYER ID</th>
              <th>STATUS</th>
              <th>CURRENT MISSION</th>
              <th>ACTIONS</th>
              <th>TOKENS</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={user.activeGame ? "row-active" : ""}>
                <td className="id-col">
                    {user.email?.split('@')[0]}
                    {user.role === 'manager' && <span className="tag-mgr">MGR</span>}
                    <div className="score-sub">Score: {user.score || 0}</div>
                </td>
                
                <td className="status-col">
                    {user.activeGame ? <span className="status-live">● ACTIVE</span> : <span className="status-idle">IDLE</span>}
                </td>

                <td className="mission-col">
                    {user.activeGame ? (
                        <div className="mission-info">
                            <span className="m-id">{user.activeGame.gameId}</span>
                            <span className="m-cat">{user.activeGame.category}</span>
                            <span className="m-lvl">LVL {user.activeGame.level}</span>
                        </div>
                    ) : "---"}
                </td>

                <td className="actions-col">
                    {user.activeGame && (
                        <div className="action-buttons">
                            <button 
                                className="btn-verify" 
                                onClick={() => markGameComplete(user.id, user.activeGame)}
                                disabled={loading}
                            >
                                ✅ VERIFY (+1)
                            </button>
                            <button 
                                className="btn-cancel" 
                                onClick={() => cancelGame(user.id)}
                            >
                                ❌ REVOKE
                            </button>
                        </div>
                    )}
                </td>

                <td className="tokens-col">
                    <span style={{color:'#ffd700'}}>{user.tokens}</span>
                    <div className="token-btns">
                        <button onClick={() => adjustTokens(user.id, 5)} className="t-btn">+</button>
                        <button onClick={() => adjustTokens(user.id, -5)} className="t-btn">-</button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
