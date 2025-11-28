import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Paper,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
} from "@mui/icons-material";
import axios from "axios";
import { useUser } from "../UserContext";
import Confetti from "react-confetti";
import successSound from "../assets/sounds/success.mp3";
import failSound from "../assets/sounds/fail.mp3";
import victorySound from "../assets/sounds/victory.mp3";

const BaseballGame = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const { user } = useUser();
  const userId = user?.id;
  const userDocId = `user:${userId}`;

  // Game state
  const [gameMode, setGameMode] = useState(null); // 'single-inning', 'full-game', 'multiplayer'
  const [currentGame, setCurrentGame] = useState(null);
  const [innings, setInnings] = useState(1);
  const [totalInnings, setTotalInnings] = useState(9);
  const [isTopOfInning, setIsTopOfInning] = useState(true);
  const [outs, setOuts] = useState(0);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [runners, setRunners] = useState({
    first: false,
    second: false,
    third: false,
  });
  const [streak, setStreak] = useState(0);
  const [gameBestStreak, setGameBestStreak] = useState(0); // Best streak in current game
  const [allTimeBestStreak, setAllTimeBestStreak] = useState(0); // All-time best streak from DB

  // Multiplayer state
  const [players, setPlayers] = useState([]);
  const [player2, setPlayer2] = useState(null);
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [selectedInnings, setSelectedInnings] = useState(9); // New state for innings selection

  // UI state
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(true);
  const [lastHit, setLastHit] = useState(null);
  const [runsThisPlay, setRunsThisPlay] = useState(0);
  const [userStats, setUserStats] = useState(null);
  const [isMuted, setIsMuted] = useState(false); // Mute state

  const successAudioRef = useRef(null);
  const failAudioRef = useRef(null);
  const victoryAudioRef = useRef(null);

  // Hit types for the physical toy targets
  const hitTypes = [
    {
      id: "home-run",
      name: "HOME RUN",
      bases: 4,
      color: "#ff4444",
      emoji: "💥",
    },
    { id: "triple", name: "TRIPLE", bases: 3, color: "#ff8800", emoji: "🔥" },
    { id: "double", name: "DOUBLE", bases: 2, color: "#ffaa00", emoji: "⚡" },
    { id: "single", name: "SINGLE", bases: 1, color: "#88cc00", emoji: "✓" },
  ];

  const fetchUserStats = useCallback(async () => {
    try {
      const statsResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "baseball_stats",
          user_id: userDocId,
        },
      });

      if (statsResp.data.docs.length > 0) {
        setUserStats(statsResp.data.docs[0]);
        setAllTimeBestStreak(statsResp.data.docs[0].bestStreak || 0);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  }, [COUCHDB_BASE, userDocId]);

  const fetchAvailableProfiles = useCallback(async () => {
    try {
      const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "user" },
      });
      setAvailableProfiles(resp.data.docs.filter((p) => p._id !== userDocId));
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  }, [COUCHDB_BASE, userDocId]);

  useEffect(() => {
    if (userId) {
      fetchUserStats();
      fetchAvailableProfiles();
    }
  }, [userId, fetchUserStats, fetchAvailableProfiles]);

  const startGame = async (mode) => {
    setGameMode(mode);
    setShowModeSelect(false);

    const gameId = `baseball_game:${Date.now()}`;
    const newGame = {
      _id: gameId,
      type: "baseball_game",
      user_id: userDocId,
      mode: mode,
      started_at: new Date().toISOString(),
      plays: [],
      status: "active",
    };

    if (mode === "multiplayer" && player2) {
      newGame.player2_id = `user:${player2}`;
      newGame.player1_name = user.name;
      newGame.player2_name = availableProfiles.find(
        (p) => p._id === `user:${player2}`
      )?.name;
      // Player 1 (user) is Away, Player 2 is Home
      setPlayers([user.name, newGame.player2_name]);
    }

    try {
      await axios.put(`${COUCHDB_BASE}/${gameId}`, newGame);
      setCurrentGame(newGame);
    } catch (error) {
      console.error("Error starting game:", error);
    }

    // Reset game state
    setInnings(1);
    setIsTopOfInning(true);
    setOuts(0);
    setScore({ home: 0, away: 0 });
    setRunners({ first: false, second: false, third: false });
    setStreak(0);
    setGameBestStreak(0); // Reset game best streak
    setShowGameOver(false);

    if (mode === "single-inning") {
      setTotalInnings(1);
    } else {
      setTotalInnings(selectedInnings);
    }
  };

  const advanceRunners = useCallback(
    (bases) => {
      let runs = 0;
      let newRunners = { ...runners };

      // Process runners from third base backwards
      for (let i = 0; i < bases; i++) {
        if (newRunners.third) {
          runs++;
          newRunners.third = false;
        }
        if (newRunners.second) {
          newRunners.third = true;
          newRunners.second = false;
        }
        if (newRunners.first) {
          newRunners.second = true;
          newRunners.first = false;
        }
      }

      // Place the batter
      if (bases === 1) {
        newRunners.first = true;
      } else if (bases === 2) {
        newRunners.second = true;
      } else if (bases === 3) {
        newRunners.third = true;
      } else if (bases === 4) {
        // Home run - all runners score plus the batter
        if (newRunners.third) runs++;
        if (newRunners.second) runs++;
        if (newRunners.first) runs++;
        runs++; // The batter scores
        newRunners = { first: false, second: false, third: false };
      }

      setRunners(newRunners);
      return runs;
    },
    [runners]
  );

  const playSound = (audioRef) => {
    if (!isMuted && audioRef.current) {
      audioRef.current.play();
    }
  };

  const handleHit = async (hitType) => {
    if (!currentGame) return;

    const runs = advanceRunners(hitType.bases);
    setRunsThisPlay(runs);
    setLastHit(hitType);

    const newStreak = streak + 1;
    setStreak(newStreak);

    // Update game best streak if current streak is higher
    if (newStreak > gameBestStreak) {
      setGameBestStreak(newStreak);
    }

    // Update score
    const newScore = { ...score };
    if (gameMode === "multiplayer") {
      if (isTopOfInning) {
        newScore.away += runs;
      } else {
        newScore.home += runs;
      }
    } else {
      newScore.home += runs;
    }
    setScore(newScore);

    // Record the play
    try {
      const gameResp = await axios.get(`${COUCHDB_BASE}/${currentGame._id}`);
      const gameDoc = gameResp.data;

      const play = {
        timestamp: new Date().toISOString(),
        type: hitType.id,
        bases: hitType.bases,
        runs: runs,
        inning: innings,
        isTopOfInning: isTopOfInning,
        outs: outs,
        streak: newStreak,
        // Track which player made the play in multiplayer
        player_id:
          gameMode === "multiplayer"
            ? isTopOfInning
              ? userDocId
              : `user:${player2}`
            : userDocId,
        player_name:
          gameMode === "multiplayer"
            ? isTopOfInning
              ? user.name
              : players[1]
            : user.name,
      };

      gameDoc.plays.push(play);
      await axios.put(`${COUCHDB_BASE}/${currentGame._id}`, gameDoc);
      setCurrentGame(gameDoc);
    } catch (error) {
      console.error("Error recording play:", error);
    }

    // Play sounds and effects
    if (hitType.bases >= 2) {
      playSound(successAudioRef);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    } else {
      playSound(successAudioRef);
    }

    // Clear the last hit display after a moment
    setTimeout(() => {
      setLastHit(null);
      setRunsThisPlay(0);
    }, 1500);
  };

  const handleOut = async () => {
    if (!currentGame) return;

    playSound(failAudioRef);

    // Reset current streak (game best streak is already tracked)
    setStreak(0);

    const newOuts = outs + 1;
    setOuts(newOuts);

    // Record the out
    try {
      const gameResp = await axios.get(`${COUCHDB_BASE}/${currentGame._id}`);
      const gameDoc = gameResp.data;

      const play = {
        timestamp: new Date().toISOString(),
        type: "out",
        bases: 0,
        runs: 0,
        inning: innings,
        isTopOfInning: isTopOfInning,
        outs: newOuts,
        // Track which player made the play in multiplayer
        player_id:
          gameMode === "multiplayer"
            ? isTopOfInning
              ? userDocId
              : `user:${player2}`
            : userDocId,
        player_name:
          gameMode === "multiplayer"
            ? isTopOfInning
              ? user.name
              : players[1]
            : user.name,
      };

      gameDoc.plays.push(play);
      await axios.put(`${COUCHDB_BASE}/${currentGame._id}`, gameDoc);
      setCurrentGame(gameDoc);
    } catch (error) {
      console.error("Error recording out:", error);
    }

    // Check for end of half-inning
    if (newOuts >= 3) {
      await endHalfInning();
    }
  };

  const endHalfInning = async () => {
    // Clear runners and outs
    setRunners({ first: false, second: false, third: false });
    setOuts(0);

    if (gameMode === "single-inning") {
      // Single inning mode - game over after 3 outs
      await endGame();
      return;
    }

    if (gameMode === "multiplayer") {
      if (isTopOfInning) {
        // Switch to bottom of inning (home team bats)
        setIsTopOfInning(false);
      } else {
        // End of full inning - check if game should end
        if (innings >= totalInnings) {
          await endGame();
          return;
        }
        // Next inning - back to top (away team bats)
        setInnings((prev) => prev + 1);
        setIsTopOfInning(true);
      }
    } else {
      // Full game single player - just track innings
      if (innings >= totalInnings) {
        await endGame();
        return;
      }
      setInnings((prev) => prev + 1);
    }
  };

  const endGame = async () => {
    if (!currentGame) return;

    try {
      const gameResp = await axios.get(`${COUCHDB_BASE}/${currentGame._id}`);
      const gameDoc = gameResp.data;

      // Use the higher of current streak or game best streak
      const finalGameBestStreak = Math.max(gameBestStreak, streak);

      gameDoc.status = "completed";
      gameDoc.ended_at = new Date().toISOString();
      gameDoc.final_score = score;
      gameDoc.total_runs =
        score.home + (gameMode === "multiplayer" ? score.away : 0);
      gameDoc.best_streak = finalGameBestStreak;

      // Add winner info for multiplayer
      if (gameMode === "multiplayer") {
        if (score.away > score.home) {
          gameDoc.winner_id = userDocId;
          gameDoc.winner_name = user.name;
        } else if (score.home > score.away) {
          gameDoc.winner_id = `user:${player2}`;
          gameDoc.winner_name = players[1];
        } else {
          gameDoc.winner_id = null; // Tie
          gameDoc.winner_name = "Tie";
        }
      }

      await axios.put(`${COUCHDB_BASE}/${currentGame._id}`, gameDoc);

      // Update game best streak state for display
      setGameBestStreak(finalGameBestStreak);

      // Update stats for the current user
      await updateUserStats(gameDoc, userDocId, userId);

      // Update stats for player 2 in multiplayer
      if (gameMode === "multiplayer" && player2) {
        await updateUserStats(gameDoc, `user:${player2}`, player2);
      }

      setShowGameOver(true);
      playSound(victoryAudioRef);
    } catch (error) {
      console.error("Error ending game:", error);
    }
  };

  const updateUserStats = async (gameDoc, targetUserDocId, targetUserId) => {
    try {
      let statsDoc;
      const statsResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "baseball_stats",
          user_id: targetUserDocId,
        },
      });

      if (statsResp.data.docs.length > 0) {
        statsDoc = statsResp.data.docs[0];
      } else {
        statsDoc = {
          _id: `baseball_stats:${targetUserId}`,
          type: "baseball_stats",
          user_id: targetUserDocId,
          totalGames: 0,
          totalRuns: 0,
          totalHits: 0,
          totalOuts: 0,
          homeRuns: 0,
          triples: 0,
          doubles: 0,
          singles: 0,
          bestStreak: 0,
          highScore: 0,
          bestSingleInning: 0,
          // New multiplayer stats
          multiplayerGames: 0,
          multiplayerWins: 0,
          multiplayerLosses: 0,
          multiplayerTies: 0,
        };
      }

      // For multiplayer, filter plays by the target player
      const isMultiplayer = gameDoc.mode === "multiplayer";
      const allPlays = gameDoc.plays || [];

      // Filter plays for this specific player in multiplayer, or all plays in single player
      const playerPlays = isMultiplayer
        ? allPlays.filter((p) => p.player_id === targetUserDocId)
        : allPlays;

      const hits = playerPlays.filter((p) => p.type !== "out");
      const homeRuns = playerPlays.filter((p) => p.type === "home-run").length;
      const triples = playerPlays.filter((p) => p.type === "triple").length;
      const doubles = playerPlays.filter((p) => p.type === "double").length;
      const singles = playerPlays.filter((p) => p.type === "single").length;
      const outsCount = playerPlays.filter((p) => p.type === "out").length;
      const runsScored = playerPlays.reduce((sum, p) => sum + (p.runs || 0), 0);

      statsDoc.totalGames = (statsDoc.totalGames || 0) + 1;
      statsDoc.totalRuns = (statsDoc.totalRuns || 0) + runsScored;
      statsDoc.totalHits = (statsDoc.totalHits || 0) + hits.length;
      statsDoc.totalOuts = (statsDoc.totalOuts || 0) + outsCount;
      statsDoc.homeRuns = (statsDoc.homeRuns || 0) + homeRuns;
      statsDoc.triples = (statsDoc.triples || 0) + triples;
      statsDoc.doubles = (statsDoc.doubles || 0) + doubles;
      statsDoc.singles = (statsDoc.singles || 0) + singles;

      // Calculate best streak from this player's plays
      const gameBestStreak = Math.max(
        ...playerPlays.map((p) => p.streak || 0),
        0
      );
      if (gameBestStreak > (statsDoc.bestStreak || 0)) {
        statsDoc.bestStreak = gameBestStreak;
      }

      if (runsScored > (statsDoc.highScore || 0)) {
        statsDoc.highScore = runsScored;
      }

      if (
        gameDoc.mode === "single-inning" &&
        runsScored > (statsDoc.bestSingleInning || 0)
      ) {
        statsDoc.bestSingleInning = runsScored;
      }

      // Update multiplayer-specific stats
      if (isMultiplayer) {
        statsDoc.multiplayerGames = (statsDoc.multiplayerGames || 0) + 1;

        if (gameDoc.winner_id === targetUserDocId) {
          statsDoc.multiplayerWins = (statsDoc.multiplayerWins || 0) + 1;
        } else if (gameDoc.winner_id === null) {
          statsDoc.multiplayerTies = (statsDoc.multiplayerTies || 0) + 1;
        } else {
          statsDoc.multiplayerLosses = (statsDoc.multiplayerLosses || 0) + 1;
        }
      }

      await axios.put(`${COUCHDB_BASE}/${statsDoc._id}`, statsDoc);

      // Only update local state if this is the current user
      if (targetUserDocId === userDocId) {
        setUserStats(statsDoc);
      }
    } catch (error) {
      console.error("Error updating user stats:", error);
    }
  };

  const resetGame = () => {
    setCurrentGame(null);
    setShowModeSelect(true);
    setShowGameOver(false);
    setGameMode(null);
  };

  // Render the baseball diamond with runners
  const renderDiamond = () => (
    <Box
      sx={{
        position: "relative",
        width: "300px",
        height: "300px",
        margin: "20px auto",
      }}
    >
      {/* Baseball diamond shape */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "200px",
          height: "200px",
          transform: "translate(-50%, -50%) rotate(45deg)",
          backgroundColor: "#8B4513",
          border: "4px solid #654321",
        }}
      />

      {/* Grass */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "160px",
          height: "160px",
          transform: "translate(-50%, -50%) rotate(45deg)",
          backgroundColor: "#2d5016",
        }}
      />

      {/* Home plate */}
      <Box
        sx={{
          position: "absolute",
          bottom: "30px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "30px",
          height: "30px",
          backgroundColor: "white",
          border: "2px solid #333",
          clipPath: "polygon(50% 0%, 100% 25%, 100% 100%, 0% 100%, 0% 25%)",
        }}
      />

      {/* First base */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          right: "30px",
          transform: "translateY(-50%)",
          width: "25px",
          height: "25px",
          backgroundColor: runners.first ? "#FFD700" : "white",
          border: "2px solid #333",
          boxShadow: runners.first ? "0 0 15px #FFD700" : "none",
          transition: "all 0.3s ease",
        }}
      />

      {/* Second base */}
      <Box
        sx={{
          position: "absolute",
          top: "30px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "25px",
          height: "25px",
          backgroundColor: runners.second ? "#FFD700" : "white",
          border: "2px solid #333",
          boxShadow: runners.second ? "0 0 15px #FFD700" : "none",
          transition: "all 0.3s ease",
        }}
      />

      {/* Third base */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "30px",
          transform: "translateY(-50%)",
          width: "25px",
          height: "25px",
          backgroundColor: runners.third ? "#FFD700" : "white",
          border: "2px solid #333",
          boxShadow: runners.third ? "0 0 15px #FFD700" : "none",
          transition: "all 0.3s ease",
        }}
      />

      {/* Runner indicators */}
      {runners.first && (
        <Typography
          sx={{
            position: "absolute",
            top: "50%",
            right: "5px",
            transform: "translateY(-50%)",
            fontSize: "20px",
          }}
        >
          🏃
        </Typography>
      )}
      {runners.second && (
        <Typography
          sx={{
            position: "absolute",
            top: "5px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "20px",
          }}
        >
          🏃
        </Typography>
      )}
      {runners.third && (
        <Typography
          sx={{
            position: "absolute",
            top: "50%",
            left: "5px",
            transform: "translateY(-50%)",
            fontSize: "20px",
          }}
        >
          🏃
        </Typography>
      )}
    </Box>
  );

  // Render outs indicator
  const renderOuts = () => (
    <Box sx={{ display: "flex", justifyContent: "center", gap: 1, my: 2 }}>
      <Typography variant="h6" sx={{ mr: 2 }}>
        OUTS:
      </Typography>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            backgroundColor: i < outs ? "#ff4444" : "#ddd",
            border: "2px solid #333",
            transition: "background-color 0.3s ease",
          }}
        />
      ))}
    </Box>
  );

  // Mode selection dialog
  if (showModeSelect) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography
          variant="h3"
          align="center"
          gutterBottom
          sx={{ color: "#0066cc", fontWeight: "bold" }}
        >
          ⚾ Pro Pitch Baseball ⚾
        </Typography>

        {userStats && (
          <Paper sx={{ p: 2, mb: 3, backgroundColor: "#f5f5f5" }}>
            <Typography variant="h6" align="center" gutterBottom>
              🏆 Your Records 🏆
            </Typography>
            <Grid container spacing={2} justifyContent="center">
              <Grid item>
                <Chip
                  label={`High Score: ${userStats.highScore || 0}`}
                  color="primary"
                />
              </Grid>
              <Grid item>
                <Chip
                  label={`Best Streak: ${userStats.bestStreak || 0}`}
                  color="secondary"
                />
              </Grid>
              <Grid item>
                <Chip
                  label={`Best Single Inning: ${
                    userStats.bestSingleInning || 0
                  }`}
                  color="success"
                />
              </Grid>
              <Grid item>
                <Chip
                  label={`Total Games: ${userStats.totalGames || 0}`}
                  color="info"
                />
              </Grid>
            </Grid>
          </Paper>
        )}

        <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                textAlign: "center",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-5px)",
                  boxShadow: 6,
                },
                backgroundColor: "#e3f2fd",
              }}
              onClick={() => startGame("single-inning")}
            >
              <Typography variant="h4" sx={{ mb: 2 }}>
                🎯
              </Typography>
              <Typography variant="h5" gutterBottom>
                Single Inning
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Score as many runs as you can before getting 3 outs! Perfect for
                quick games.
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                textAlign: "center",
                backgroundColor: "#e8f5e9",
              }}
            >
              <Typography variant="h4" sx={{ mb: 2 }}>
                🏟️
              </Typography>
              <Typography variant="h5" gutterBottom>
                Full Game
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Play a complete game! Track your runs across all innings.
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Number of Innings</InputLabel>
                <Select
                  value={selectedInnings}
                  onChange={(e) => setSelectedInnings(e.target.value)}
                  label="Number of Innings"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <MenuItem key={num} value={num}>
                      {num} {num === 1 ? "Inning" : "Innings"}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                color="success"
                onClick={() => startGame("full-game")}
                fullWidth
              >
                Start Game
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                textAlign: "center",
                backgroundColor: "#fce4ec",
              }}
            >
              <Typography variant="h4" sx={{ mb: 2 }}>
                👥
              </Typography>
              <Typography variant="h5" gutterBottom>
                Multiplayer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Play against a friend! Take turns batting.
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Select Opponent</InputLabel>
                <Select
                  value={player2 || ""}
                  onChange={(e) => setPlayer2(e.target.value)}
                  label="Select Opponent"
                >
                  {availableProfiles.map((profile) => (
                    <MenuItem
                      key={profile._id}
                      value={profile._id.replace("user:", "")}
                    >
                      {profile.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => startGame("multiplayer")}
                disabled={!player2}
                fullWidth
              >
                Start Game
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <audio ref={successAudioRef} src={successSound} />
      <audio ref={failAudioRef} src={failSound} />
      <audio ref={victoryAudioRef} src={victorySound} />

      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
        />
      )}

      {/* Header with title and mute button */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          mb: 2,
        }}
      >
        <Typography
          variant="h3"
          align="center"
          sx={{ color: "#0066cc", fontWeight: "bold" }}
        >
          ⚾ Pro Pitch Baseball ⚾
        </Typography>
        <Tooltip title={isMuted ? "Unmute Sound" : "Mute Sound"}>
          <IconButton
            onClick={() => setIsMuted(!isMuted)}
            sx={{
              position: "absolute",
              right: 0,
              backgroundColor: isMuted ? "#ffebee" : "#e8f5e9",
              "&:hover": {
                backgroundColor: isMuted ? "#ffcdd2" : "#c8e6c9",
              },
            }}
          >
            {isMuted ? (
              <VolumeOffIcon color="error" />
            ) : (
              <VolumeUpIcon color="success" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Scoreboard */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: "#1a1a2e" }}>
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          {gameMode === "multiplayer" ? (
            <>
              <Grid item xs={4} textAlign="center">
                <Typography
                  variant="h6"
                  sx={{ color: isTopOfInning ? "#FFD700" : "#888" }}
                >
                  {players[0]} (Away)
                </Typography>
                <Typography
                  variant="h3"
                  sx={{ color: "#fff", fontWeight: "bold" }}
                >
                  {score.away}
                </Typography>
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Typography variant="body1" sx={{ color: "#888" }}>
                  {isTopOfInning ? "▲" : "▼"} Inning {innings}
                </Typography>
                <Typography variant="h5" sx={{ color: "#FFD700" }}>
                  {isTopOfInning ? players[0] : players[1]}'s Turn
                </Typography>
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Typography
                  variant="h6"
                  sx={{ color: !isTopOfInning ? "#FFD700" : "#888" }}
                >
                  {players[1]} (Home)
                </Typography>
                <Typography
                  variant="h3"
                  sx={{ color: "#fff", fontWeight: "bold" }}
                >
                  {score.home}
                </Typography>
              </Grid>
            </>
          ) : (
            <>
              <Grid item xs={4} textAlign="center">
                <Typography variant="body1" sx={{ color: "#888" }}>
                  {gameMode === "single-inning"
                    ? "Single Inning Mode"
                    : `Inning ${innings} of ${totalInnings}`}
                </Typography>
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Typography variant="h6" sx={{ color: "#FFD700" }}>
                  SCORE
                </Typography>
                <Typography
                  variant="h2"
                  sx={{ color: "#fff", fontWeight: "bold" }}
                >
                  {score.home}
                </Typography>
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Typography variant="body1" sx={{ color: "#888" }}>
                  Streak:{" "}
                  <span style={{ color: "#88cc00", fontWeight: "bold" }}>
                    {streak}
                  </span>
                </Typography>
                <Typography variant="body2" sx={{ color: "#aaa" }}>
                  Game Best: {gameBestStreak}
                </Typography>
                <Typography variant="body2" sx={{ color: "#FFD700" }}>
                  All-Time: {allTimeBestStreak}
                </Typography>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Outs indicator */}
      {renderOuts()}

      {/* Last hit feedback */}
      {lastHit && (
        <Box
          sx={{
            textAlign: "center",
            py: 2,
            backgroundColor: lastHit.color,
            borderRadius: 2,
            mb: 2,
            animation: "pulse 0.5s ease-in-out",
          }}
        >
          <Typography variant="h4" sx={{ color: "white", fontWeight: "bold" }}>
            {lastHit.emoji} {lastHit.name}! {lastHit.emoji}
          </Typography>
          {runsThisPlay > 0 && (
            <Typography variant="h5" sx={{ color: "white" }}>
              {runsThisPlay} RUN{runsThisPlay > 1 ? "S" : ""} SCORED! 🎉
            </Typography>
          )}
        </Box>
      )}

      {/* Baseball Diamond */}
      {renderDiamond()}

      {/* Hit buttons */}
      <Typography variant="h6" align="center" sx={{ mb: 2, color: "#666" }}>
        Tap the zone you hit:
      </Typography>

      <Grid container spacing={2} justifyContent="center" sx={{ mb: 3 }}>
        {hitTypes.map((hit) => (
          <Grid item key={hit.id} xs={6} sm={3}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => handleHit(hit)}
              sx={{
                py: 3,
                backgroundColor: hit.color,
                fontSize: "1.1rem",
                fontWeight: "bold",
                "&:hover": {
                  backgroundColor: hit.color,
                  opacity: 0.9,
                  transform: "scale(1.05)",
                },
                transition: "transform 0.2s",
              }}
            >
              {hit.emoji} {hit.name}
            </Button>
          </Grid>
        ))}
      </Grid>

      {/* Miss/Out button */}
      <Box textAlign="center" sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="error"
          onClick={handleOut}
          sx={{
            py: 2,
            px: 6,
            fontSize: "1.2rem",
            fontWeight: "bold",
          }}
        >
          ❌ MISS / OUT
        </Button>
      </Box>

      {/* End game button */}
      <Box textAlign="center">
        <Button
          variant="outlined"
          color="secondary"
          onClick={endGame}
          sx={{ fontSize: "1rem" }}
        >
          End Game Early
        </Button>
      </Box>

      {/* Game Over Dialog */}
      <Dialog open={showGameOver} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            textAlign: "center",
            backgroundColor: "#1a1a2e",
            color: "white",
          }}
        >
          <Typography variant="h4">🏆 Game Over! 🏆</Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", p: 4 }}>
          {gameMode === "multiplayer" ? (
            <>
              <Typography variant="h5" gutterBottom>
                {score.away > score.home
                  ? `${players[0]} Wins!`
                  : score.home > score.away
                  ? `${players[1]} Wins!`
                  : "It's a Tie!"}
              </Typography>
              <Typography variant="h4" sx={{ my: 2 }}>
                {score.away} - {score.home}
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h5" gutterBottom>
                Final Score
              </Typography>
              <Typography
                variant="h2"
                sx={{ color: "#0066cc", fontWeight: "bold", my: 2 }}
              >
                {score.home} RUNS
              </Typography>
            </>
          )}

          <Box
            sx={{ mt: 3, p: 2, backgroundColor: "#f5f5f5", borderRadius: 2 }}
          >
            <Typography variant="h6" gutterBottom>
              Game Stats
            </Typography>
            <Typography>
              Best Streak This Game: {Math.max(gameBestStreak, streak)}
            </Typography>
            {userStats && (
              <>
                <Typography sx={{ mt: 1, color: "#888" }}>
                  All-Time High Score: {userStats.highScore || 0}
                </Typography>
                <Typography sx={{ color: "#888" }}>
                  All-Time Best Streak: {userStats.bestStreak || 0}
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={resetGame}
            sx={{ px: 4 }}
          >
            Play Again
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BaseballGame;
