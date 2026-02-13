// src/components/Leaderboard.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, limit, onSnapshot } from "firebase/firestore";

export default function Leaderboard({ limitCount = 10 }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    // Query users
    const q = query(collection(db, "users"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const userData = doc.data();
        
        // --- SCORE CALCULATION FIX ---
        // 1. Count past games (Array Length)
        const gamesCount = userData.completedGames ? userData.completedGames.length : 0;
        // 2. Get the new 'score' field (Integer)
        const rawScore = userData.score || 0;
        
        // Use the higher number so no one's score drops to 0
        const finalScore = Math.max(gamesCount, rawScore); 

        return {
          id: doc.id,
          ...userData,
          displayScore: finalScore,
          displayName: userData.displayName || userData.email?.split('@')[0] || "Unknown"
        };
      });

      // SORT BY SCORE (High to Low)
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
              
              {/* RANK */}
              <td className="rank-col">
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
              </td>
              
              {/* NAME */}
              <td className="player-col">
                <span className="player-name">
                  {player.displayName}
                </span>
                {player.role === 'manager' && (
                  <span className="badge-admin">MGR</span>
                )}
              </td>

              {/* SCORE */}
              <td className="games-col" style={{color:'#00ff41', fontWeight:'bold', fontSize:'1.1rem'}}>
                {player.displayScore}
              </td>

              {/* TOKENS */}
              <td className="tokens-col text-right">
                <span className="token-value">
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