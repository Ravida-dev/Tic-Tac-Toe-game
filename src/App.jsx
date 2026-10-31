import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import './App.css';

export default function App() {
  const [board, setBoard] = useState(Array(9).fill(''));
  const [isXTurn, setIsXTurn] = useState(true);
  const [gameMode, setGameMode] = useState('pvp'); // 'pvp' or 'ai'
  
  // Player Names & Scores
  const [playerXName, setPlayerXName] = useState('Ravida');
  const [playerOName, setPlayerOName] = useState('Fatima');
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
  
  // Match History & Leaderboard state
  const [matchHistory, setMatchHistory] = useState([]);
  const [winningLine, setWinningLine] = useState([]);
  const [leaderboard, setLeaderboard] = useState([
    { playerName: 'Ravida', wins: 2 },
    { playerName: 'Fatima', wins: 0 }
  ]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
  const [isStarted, setIsStarted] = useState(false);

  // Fetch Global Leaderboard from Backend
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/scores');
      const data = await res.json();
      if (data.success && data.topPlayers.length > 0) {
        setLeaderboard(data.topPlayers);
      }
    } catch (err) {
      console.log('Using local leaderboard fallback');
    }
  };

  const saveScoreToBackend = async (winnerName) => {
    // Update local state immediately for instant feedback
    setLeaderboard(prev => {
      const existing = prev.find(p => p.playerName === winnerName);
      if (existing) {
        return prev.map(p => p.playerName === winnerName ? { ...p, wins: p.wins + 1 } : p)
                   .sort((a, b) => b.wins - a.wins);
      } else {
        return [...prev, { playerName: winnerName, wins: 1 }]
                   .sort((a, b) => b.wins - a.wins);
      }
    });

    try {
      await fetch('http://localhost:5000/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: winnerName, wins: 1 })
      });
    } catch (err) {
      console.log('Error syncing score to backend');
    }
  };

  // Audio effects using Web Audio API
  const playSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'click') {
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'win') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        setTimeout(() => osc.frequency.setValueAtTime(659.25, audioCtx.currentTime), 100);
        setTimeout(() => osc.frequency.setValueAtTime(783.99, audioCtx.currentTime), 200);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {}
  };

  const checkWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: [a, b, c] };
      }
    }
    return { winner: null, line: [] };
  };

  const result = checkWinner(board);
  const winner = result.winner;
  const line = result.line;
  const isDraw = !winner && board.every((cell) => cell !== '');

  useEffect(() => {
    if (winner) {
      setWinningLine(line);
      playSound('win');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      
      const winnerName = winner === 'X' ? playerXName : playerOName;
      setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }));
      setMatchHistory((prev) => [`🏆 ${winnerName} (${winner}) won`, ...prev.slice(0, 4)]);
      
      saveScoreToBackend(winnerName);
    } else if (isDraw) {
      setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
      setMatchHistory((prev) => [`🤝 Match Draw`, ...prev.slice(0, 4)]);
    }
  }, [winner, isDraw]);

  useEffect(() => {
    if (gameMode === 'ai' && !isXTurn && !winner && !isDraw) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isXTurn, board, gameMode, winner, isDraw]);

  const makeAIMove = () => {
    const emptyIndices = board.map((val, idx) => (val === '' ? idx : null)).filter(val => val !== null);
    if (emptyIndices.length === 0 || winner) return;

    let move = findBestMove(board, 'O');
    if (move === null) move = findBestMove(board, 'X');
    if (move === null) {
      move = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    const newBoard = [...board];
    newBoard[move] = 'O';
    setBoard(newBoard);
    setIsXTurn(true);
    playSound('click');
  };

  const findBestMove = (currentBoard, player) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      const vals = [currentBoard[a], currentBoard[b], currentBoard[c]];
      if (vals.filter(v => v === player).length === 2 && vals.includes('')) {
        if (currentBoard[a] === '') return a;
        if (currentBoard[b] === '') return b;
        if (currentBoard[c] === '') return c;
      }
    }
    return null;
  };

  const handleClick = (index) => {
    if (board[index] !== '' || winner) return;
    if (gameMode === 'ai' && !isXTurn) return;

    playSound('click');
    const newBoard = [...board];
    newBoard[index] = isXTurn ? 'X' : 'O';
    setBoard(newBoard);
    setIsXTurn(!isXTurn);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(''));
    setIsXTurn(true);
    setWinningLine([]);
  };

  let status;
  const activeName = isXTurn ? playerXName : playerOName;
  if (winner) {
    status = `🎉 ${winner === 'X' ? playerXName : playerOName} Wins!`;
  } else if (isDraw) {
    status = `🤝 Match Draw!`;
  } else {
    status = `Turn: ${activeName} (${isXTurn ? 'X' : 'O'})`;
  }

  if (!isStarted) {
    return (
      <div className="container">
        <div className="card setup-card">
          <h1>✨ Cyber Neon Tic Tac Toe ✨</h1>
          <p className="subtitle">Full-Stack MERN Edition</p>
          
          <div className="input-group">
            <label>Player X Name:</label>
            <input 
              type="text" 
              value={playerXName} 
              onChange={(e) => setPlayerXName(e.target.value)} 
            />
          </div>

          <div className="input-group">
            <label>Game Mode:</label>
            <div className="mode-selector">
              <button 
                className={gameMode === 'pvp' ? 'mode-btn active' : 'mode-btn'} 
                onClick={() => { setGameMode('pvp'); setPlayerOName('Fatima'); }}
              >
                vs Friend 👥
              </button>
              <button 
                className={gameMode === 'ai' ? 'mode-btn active' : 'mode-btn'} 
                onClick={() => { setGameMode('ai'); setPlayerOName('Cyber Bot 🤖'); }}
              >
                vs Smart AI 🤖
              </button>
            </div>
          </div>

          {gameMode === 'pvp' && (
            <div className="input-group">
              <label>Player O Name:</label>
              <input 
                type="text" 
                value={playerOName} 
                onChange={(e) => setPlayerOName(e.target.value)} 
              />
            </div>
          )}

          <button className="start-btn" onClick={() => setIsStarted(true)}>
            Start Battle 🚀
          </button>

          <button className="leaderboard-toggle-btn" onClick={() => setShowLeaderboard(true)}>
            🏆 View Global Leaderboard
          </button>
        </div>

        {showLeaderboard && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h2>Global Leaderboard 🏆</h2>
              {leaderboard.length === 0 ? (
                <p className="no-scores">No scores saved yet.</p>
              ) : (
                <ul>
                  {leaderboard.map((item, idx) => (
                    <li key={idx}>
                      <span>{idx + 1}. {item.playerName}</span>
                      <strong>{item.wins} Wins</strong>
                    </li>
                  ))}
                </ul>
              )}
              <button className="close-btn" onClick={() => setShowLeaderboard(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header-row">
          <h1>⚡ Neo Arena ⚡</h1>
          <div>
            <button className="back-setup-btn" onClick={() => setShowLeaderboard(true)}>🏆</button>
            <button className="back-setup-btn" onClick={() => setIsStarted(false)} style={{marginLeft: '5px'}}>⚙️</button>
          </div>
        </div>

        <div className="scoreboard">
          <div className="score-box x-score">
            <span>{playerXName} (X)</span>
            <strong>{scores.X}</strong>
          </div>
          <div className="score-box draw-score">
            <span>Draws</span>
            <strong>{scores.draws}</strong>
          </div>
          <div className="score-box o-score">
            <span>{playerOName} (O)</span>
            <strong>{scores.O}</strong>
          </div>
        </div>

        <div className="status-box">
          <span>{status}</span>
        </div>

        <div className="board">
          {board.map((cell, index) => {
            const isWinningCell = winningLine.includes(index);
            return (
              <button 
                key={index} 
                className={`cell ${cell === 'X' ? 'x' : cell === 'O' ? 'o' : ''} ${isWinningCell ? 'winning-cell' : ''}`}
                onClick={() => handleClick(index)}
              >
                {cell}
              </button>
            );
          })}
        </div>

        <div className="action-buttons">
          <button className="reset-btn" onClick={resetGame}>
            🔄 Play Again
          </button>
        </div>

        {matchHistory.length > 0 && (
          <div className="history-box">
            <h4>📜 Recent Matches</h4>
            <ul>
              {matchHistory.map((log, i) => (
                <li key={i}>{log}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showLeaderboard && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Global Leaderboard 🏆</h2>
            {leaderboard.length === 0 ? (
              <p className="no-scores">No scores saved yet.</p>
            ) : (
              <ul>
                {leaderboard.map((item, idx) => (
                  <li key={idx}>
                    <span>{idx + 1}. {item.playerName}</span>
                    <strong>{item.wins} Wins</strong>
                  </li>
                ))}
              </ul>
            )}
            <button className="close-btn" onClick={() => setShowLeaderboard(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}