// src/App.js
import React, { useEffect } from 'react';
import ReactGA from 'react-ga4';
import LeaderboardTable from './components/LeaderboardTable';
import Affiliation from './components/Affiliation';
import './App.css';

const MEASUREMENT_ID = 'G-DLB9F9YV03';

function App() {
  useEffect(() => {
    ReactGA.initialize(MEASUREMENT_ID);
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <div className="App-header-content">
          <img src="/logo.png" alt="RepairBench logo" className="App-logo" /> {/* Improved alt text for accessibility */}
          <h1>RepairBench: Leaderboard of Frontier Models for Program Repair</h1>
        </div>
      </header>
      <main>
        <Affiliation />
        <LeaderboardTable />
      </main>
      <footer>
        <p className="footer-text">&copy; {new Date().getFullYear()} KTH Royal Institute of Technology. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
