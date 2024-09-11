// src/App.js
import React from 'react';
import LeaderboardTable from './components/LeaderboardTable';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Live Leaderboard of Frontier LLMs for Program Repair</h1>
      <LeaderboardTable />
    </div>
  );
}

export default App;
