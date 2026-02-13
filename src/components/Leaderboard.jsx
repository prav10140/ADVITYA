// src/components/Leaderboard.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, limit, onSnapshot } from "firebase/firestore";

export default function Leaderboard({ limitCount = 10 }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    // Query all users to determine rankings
    const q = query(collection(db, "users"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const userData = doc.data();
        
        // --- SCORE LOGIC UPDATED ---
        // We now use the 'score' field directly so that point deductions 
        // from skipping rules are reflected in the live rankings.
        const currentScore = userData.score || 0;

        return {
          id: doc.id,
          ...userData,
          displayScore: currentScore,
          displayName: userData.displayName || userData.email?.split('@')[0] || "Unknown"
        };
      });

      // SORT BY SCORE (Highest to Lowest)
      data.sort((a, b) => b.displayScore - a.displayScore);

      setLeaders(data.slice(0, limitCount));
    });
    return unsubscribe;
  }, [limitCount]);

  return (
    <div className="leaderboard-container">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th className="rank-col">#</th>
            <th className="player-col">PLAYER</th>
            <th className="games-col" style={{color:'#00ff41', textDecoration:'underline'}}>SCORE</th>
            <th className="tokens-col text-right">VISA</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((player, index) => (
            <tr key={player.id} className={index === 0 ? "top-rank" : ""}>
              
              {/* RANK DISPLAY WITH EMOJIS FOR TOP 3 */}
              <td className="rank-col">
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
              </td>
              
              {/* PLAYER IDENTITY */}
              <td className="player-col">
                <span className="player-name">
                  {player.displayName}
                </span>
                {player.role === 'manager' && (
                  <span className="badge-admin" style={{ marginLeft: '8px', fontSize: '0.6rem', color: '#ff0055', border: '1px solid #ff0055', padding: '1px 4px' }}>MGR</span>
                )}
              </td>

              {/* LIVE SCORE (Affected by completions and skips) */}
              <td className="games-col" style={{color:'#00ff41', fontWeight:'bold', fontSize:'1.1rem'}}>
                {player.displayScore}
              </td>

              {/* TOKEN/VISA BALANCE */}
              <td className="tokens-col text-right">
                <span className="token-value" style={{ color: '#ffd700' }}>
                  {player.tokens}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
