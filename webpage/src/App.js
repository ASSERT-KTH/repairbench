// src/App.js
import React, { useEffect } from 'react';
import ReactGA from 'react-ga4';
import LeaderboardTable from './components/LeaderboardTable';
import './App.css';

const MEASUREMENT_ID = 'G-DLB9F9YV03';

function App() {
  useEffect(() => {
    ReactGA.initialize(MEASUREMENT_ID);
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  }, []);

  return (
    <div className="App">
      <h1>RepairBench: Live Leaderboard of Frontier LLMs for Program Repair</h1>
      <LeaderboardTable />
    </div>
  );
}

export default App;
