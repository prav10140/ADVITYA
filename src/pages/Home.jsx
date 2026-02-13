// src/pages/Home.jsx
import { useNavigate } from "react-router-dom";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-wrapper"> {/* Wrap in a class for styling */}
      <nav className="navbar">
        <div className="nav-logo">GFG Student Chapter Present</div>
        <button onClick={() => navigate("/login")} className="nav-btn">LOGIN</button>
      </nav>

      <section className="hero-section">
        <h1 className="glitch-title">CHAOS ROOM</h1>
        <p className="hero-subtitle">WELCOME TO THE BORDERLAND</p>
        <button onClick={() => navigate("/login")} className="hero-cta">ENTER THE GAME</button>
      </section>

      <section className="about-section">
        <div className="content-container">
          <h2 className="section-title">THE PROTOCOL</h2>
          <p style={{fontSize: '1.2rem', lineHeight: '1.8', color: '#ccc'}}>
            The world has paused. To survive, you must clear games, earn visas, and outlast your opponents.
            <br/><br/>
            <strong>RULE 1:</strong> Participate to earn Tokens.<br/>
            <strong>RULE 2:</strong> Lose, and your visa expires.<br/>
            <strong>RULE 3:</strong> Trust no one.
          </p>
        </div>
      </section>

      <section className="suits-section">
        <div className="content-container">
          <h2 className="section-title">GAME CATEGORIES</h2>
          <div className="suits-grid">
            <div className="suit-card">
              <div className="suit-icon" style={{color: '#00ccff'}}>♠</div>
              <h3>SPADE</h3>
              <p>Physical. Strength. Endurance.</p>
            </div>
            <div className="suit-card">
              <div className="suit-icon" style={{color: '#ff0055'}}>♥</div>
              <h3>HEART</h3>
              <p>Psychological. Trust. Betrayal.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <p>ADVITYA TECHNICAL FEST // SYSTEM ONLINE</p>
      </footer>
    </div>
  );
}
