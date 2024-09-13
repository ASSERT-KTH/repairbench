// src/components/Footer.js
import React from 'react';
import { FaGithub } from 'react-icons/fa';
import { SiArxiv } from 'react-icons/si';
import './Footer.css'; // Add some basic CSS styling

const Footer = () => {
  return (
    <div className="footer">
      <a href="https://arxiv.org" target="_blank" rel="noopener noreferrer">
        <SiArxiv className="footer-icon" />
      </a>
      <a href="https://github.com/ASSERT-KTH/frontier-models-apr-leaderboard" target="_blank" rel="noopener noreferrer">
        <FaGithub className="footer-icon" />
      </a>
    </div>
  );
};

export default Footer;