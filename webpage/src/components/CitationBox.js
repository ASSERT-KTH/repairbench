import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CitationBox = () => {
  const [isCopied, setIsCopied] = useState(false);

  const citationText = `@techreport{repairbench,
  title={RepairBench: Leaderboard of Frontier Models for Program Repair}, 
  author={André Silva and Martin Monperrus},
  year={2024},
  url={https://arxiv.org/abs/2409.18952}, 
  number = {2409.18952},
  institution = {arXiv},
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(citationText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="citation-container">
      <p className="citation-message">If you use this work in your research, please cite:</p>
      <div className="citation-box">
        <button onClick={copyToClipboard} className="copy-button" title="Copy to clipboard">
          {isCopied ? '✓' : '⧉'}
        </button>
        <SyntaxHighlighter 
          language="latex"
          style={prism}
          customStyle={{
            backgroundColor: 'transparent',
            padding: 0,
            margin: 0,
            fontSize: 'inherit',
            lineHeight: 'inherit',
          }}
        >
          {citationText}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CitationBox;