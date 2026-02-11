// src/components/Leaderboard.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export default function Leaderboard({ limitCount = 10 }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    // Query: Sort by Tokens (High to Low)
    const q = query(
      collection(db, "users"),
      orderBy("tokens", "desc"),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const userData = doc.data();
        return {
          id: doc.id,
          ...userData,
          // Calculate games played safely
          gamesPlayed: userData.completedGames ? userData.completedGames.length : 0,
          // Fallback if no display name
          displayName: userData.displayName || userData.email?.split('@')[0] || "Unknown"
        };
      });
      setLeaders(data);
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
            <th className="games-col">GAMES</th>
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
              
              {/* PLAYER NAME */}
              <td className="player-col">
                <span className="player-name">
                  {player.displayName}
                </span>
                {player.role === 'manager' && (
                  <span className="badge-admin">MGR</span>
                )}
              </td>

              {/* GAMES PLAYED */}
              <td className="games-col">
                {player.gamesPlayed}
              </td>

              {/* TOKENS */}
              <td className="tokens-col text-right">
                <span className="token-value">
                  {player.tokens}
                </span>
              </td>
            </tr>
          ))}
          
          {/* Empty State filler */}
          {leaders.length === 0 && (
             <tr>
               <td colSpan="4" style={{textAlign:'center', padding:'20px', color:'#555'}}>
                 SCANNING NETWORK...
               </td>
             </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
