import React, { useState, useEffect } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './PatchViewer.css';

const PatchViewer = ({ model, benchmark, onClose }) => {
  const [bugs, setBugs] = useState([]);
  const [currentBugIndex, setCurrentBugIndex] = useState(0);
  const [patchContent, setPatchContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [targetDiff, setTargetDiff] = useState('');

  useEffect(() => {
    const fetchBugs = async () => {
      try {
        const response = await fetch(`./results/${model}/${benchmark}/patches/`);
        const bugList = await response.json();
        setBugs(bugList);
        if (bugList.length > 0) {
          loadBugContent(bugList[0]);
        }
      } catch (error) {
        console.error('Failed to fetch bug list:', error);
      }
    };

    fetchBugs();
  }, [model, benchmark]);

  const loadBugContent = async (bugId) => {
    try {
      const promptResponse = await fetch(`./results/${model}/${benchmark}/patches/${bugId}/prompt.txt`);
      const promptText = await promptResponse.text();
      setPrompt(promptText);

      const targetResponse = await fetch(`./results/${model}/${benchmark}/patches/${bugId}/target.diff`);
      const targetText = await targetResponse.text();
      setTargetDiff(targetText);

      const patchTypes = ['exact_match', 'ast_match', 'plausible', 'compilable', 'non_compilable'];
      for (const type of patchTypes) {
        const patchResponse = await fetch(`./results/${model}/${benchmark}/patches/${bugId}/${type}/0.diff`);
        if (patchResponse.ok) {
          const patchText = await patchResponse.text();
          setPatchContent(patchText);
          break;
        }
      }
    } catch (error) {
      console.error('Failed to fetch bug content:', error);
    }
  };

  const handleNextBug = () => {
    const nextIndex = (currentBugIndex + 1) % bugs.length;
    setCurrentBugIndex(nextIndex);
    loadBugContent(bugs[nextIndex]);
  };

  const handlePrevBug = () => {
    const prevIndex = (currentBugIndex - 1 + bugs.length) % bugs.length;
    setCurrentBugIndex(prevIndex);
    loadBugContent(bugs[prevIndex]);
  };

  return (
    <div className="patch-viewer-overlay">
      <div className="patch-viewer-content">
        <h2>Patches for {model} - {benchmark}</h2>
        <button onClick={onClose}>Close</button>
        {bugs.length > 0 && (
          <>
            <div className="patch-navigation">
              <button onClick={handlePrevBug}>Previous</button>
              <span>{currentBugIndex + 1} / {bugs.length}</span>
              <button onClick={handleNextBug}>Next</button>
            </div>
            <h3>Prompt:</h3>
            <SyntaxHighlighter language="plaintext" style={github}>
              {prompt}
            </SyntaxHighlighter>
            <h3>Generated Patch:</h3>
            <SyntaxHighlighter language="diff" style={github}>
              {patchContent}
            </SyntaxHighlighter>
            <h3>Target Diff:</h3>
            <SyntaxHighlighter language="diff" style={github}>
              {targetDiff}
            </SyntaxHighlighter>
          </>
        )}
      </div>
    </div>
  );
};

export default PatchViewer;