import React from 'react';
import './Affiliation.css';

const Affiliation = () => {
  return (
    <div className="affiliation">
      <div className="authors">André Silva and Martin Monperrus</div>
      <div className="institution">KTH Royal Institute of Technology</div>
      <div className="email">{'{andreans, monperrus}@kth.se'}</div>
    </div>
  );
};

export default Affiliation;
