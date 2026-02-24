// src/components/Leaderboard.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, limit, onSnapshot } from "firebase/firestore";

export default function Leaderboard({ limitCount = 10 }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    // Increased limit so staff members don't eat up the query quota
    const q = query(collection(db, "users"), limit(100)); 
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      
      snapshot.docs.forEach((doc) => {
        const userData = doc.data();
        
        // --- NEW: FILTER OUT ALL STAFF FROM LEADERBOARD ---
        if (userData.role === 'manager' || userData.role === 'superadmin' || userData.role === 'pending_manager') {
            return; // Skip this user
        }

        const currentScore = userData.score || 0; 

        data.push({
          id: doc.id,
          ...userData,
          displayScore: currentScore,
          displayName: userData.displayName || userData.email?.split('@')[0] || "Unknown"
        });
      });

      // Sort High to Low
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
              <td className="rank-col">{index === 0 ? "🥇" : index + 1}</td>
              <td className="player-col">
                <span className="player-name">{player.displayName}</span>
              </td>
              <td className="games-col" style={{color: player.displayScore < 0 ? 'red' : '#00ff41', fontWeight:'bold'}}>{player.displayScore}</td>
              <td className="tokens-col text-right"><span style={{color:'#ffd700'}}>{player.tokens}</span></td>
            </tr>
          ))}
          {leaders.length === 0 && (
             <tr><td colSpan="4" style={{textAlign:'center', color:'#555', padding:'10px'}}>NO PLAYERS YET</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}