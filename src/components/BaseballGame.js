import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Alert,
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Paper,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
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
  Stack,
  Tooltip,
} from "@mui/material";
import {
  Groups as GroupsIcon,
  PlayArrow as PlayArrowIcon,
  QueryStats as QueryStatsIcon,
  RestartAlt as RestartAltIcon,
  SportsBaseball as BaseballIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
} from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../UserContext";
import Confetti from "react-confetti";
import successSound from "../assets/sounds/success.mp3";
import failSound from "../assets/sounds/fail.mp3";
import victorySound from "../assets/sounds/victory.mp3";
import { getAppDbBase, getUsersDbBase } from "../config/couchdb";

const BaseballGame = () => {
  const COUCHDB_BASE = getAppDbBase();
  const USERS_BASE = getUsersDbBase();

  const { user } = useUser();
  const navigate = useNavigate();
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
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isRecordingPlay, setIsRecordingPlay] = useState(false);
  const [isEndingGame, setIsEndingGame] = useState(false);
  const [gameError, setGameError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [profilesError, setProfilesError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);

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
      setStatsError("");
      const statsResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "baseball_stats",
          user_id: userDocId,
        },
      });

      if (statsResp.data.docs.length > 0) {
        setUserStats(statsResp.data.docs[0]);
        setAllTimeBestStreak(statsResp.data.docs[0].bestStreak || 0);
      } else {
        setUserStats(null);
        setAllTimeBestStreak(0);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
      setStatsError("Could not load your baseball records.");
    }
  }, [COUCHDB_BASE, userDocId]);

  const fetchAvailableProfiles = useCallback(async () => {
    try {
      setProfilesError("");
      const resp = await axios.post(`${USERS_BASE}/_find`, {
        selector: { type: "user" },
        limit: 1000,
      });
      const otherProfiles = (resp.data.docs || [])
        .filter((p) => p._id !== userDocId)
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", undefined, {
            sensitivity: "base",
          })
        );
      setAvailableProfiles(otherProfiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      setProfilesError("Could not load opponents from the central user database.");
    }
  }, [USERS_BASE, userDocId]);

  useEffect(() => {
    if (userId) {
      setIsLoadingSetup(true);
      Promise.all([fetchUserStats(), fetchAvailableProfiles()]).finally(() => {
        setIsLoadingSetup(false);
      });
    }
  }, [userId, fetchUserStats, fetchAvailableProfiles]);

  const startGame = async (mode) => {
    if (isStartingGame) return;

    if (mode === "multiplayer" && !player2) {
      setGameError("Choose an opponent before starting multiplayer.");
      return;
    }

    setIsStartingGame(true);
    setGameError("");

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
      const resp = await axios.put(`${COUCHDB_BASE}/${gameId}`, newGame);
      const savedGame = { ...newGame, _rev: resp.data.rev };
      const nextTotalInnings =
        mode === "single-inning" ? 1 : Number(selectedInnings);

      setGameMode(mode);
      setCurrentGame(savedGame);
      setLastSavedAt(new Date());
      setShowModeSelect(false);
      setInnings(1);
      setTotalInnings(nextTotalInnings);
      setIsTopOfInning(true);
      setOuts(0);
      setScore({ home: 0, away: 0 });
      setRunners({ first: false, second: false, third: false });
      setStreak(0);
      setGameBestStreak(0);
      setLastHit(null);
      setRunsThisPlay(0);
      setShowGameOver(false);
    } catch (error) {
      console.error("Error starting game:", error);
      setGameError("Could not start the game. Check the baseball database and try again.");
    } finally {
      setIsStartingGame(false);
    }
  };

  const calculateRunnerAdvance = (currentRunners, bases) => {
    if (bases === 4) {
      const runnersOnBase = Object.values(currentRunners).filter(Boolean).length;
      return {
        runs: runnersOnBase + 1,
        newRunners: { first: false, second: false, third: false },
      };
    }

    let runs = 0;
    const newRunners = { ...currentRunners };

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

    if (bases === 1) {
      newRunners.first = true;
    } else if (bases === 2) {
      newRunners.second = true;
    } else if (bases === 3) {
      newRunners.third = true;
    }

    return { runs, newRunners };
  };

  const playSound = (audioRef) => {
    if (!isMuted && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Browser autoplay rules can reject sound until the first user gesture.
      });
    }
  };

  const recordPlay = async (play) => {
    setIsRecordingPlay(true);
    setGameError("");

    try {
      const gameResp = await axios.get(`${COUCHDB_BASE}/${currentGame._id}`);
      const gameDoc = gameResp.data;
      const updatedGame = {
        ...gameDoc,
        plays: [...(gameDoc.plays || []), play],
      };
      const saveResp = await axios.put(
        `${COUCHDB_BASE}/${currentGame._id}`,
        updatedGame
      );
      const savedGame = { ...updatedGame, _rev: saveResp.data.rev };

      setCurrentGame(savedGame);
      setLastSavedAt(new Date());
      return savedGame;
    } catch (error) {
      console.error("Error recording play:", error);
      setGameError("That play was not saved. Try again before continuing.");
      throw error;
    } finally {
      setIsRecordingPlay(false);
    }
  };

  const handleHit = async (hitType) => {
    if (!currentGame || isRecordingPlay || isEndingGame) return;

    const { runs, newRunners } = calculateRunnerAdvance(runners, hitType.bases);
    const newStreak = streak + 1;
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

    try {
      await recordPlay(play);
      setRunners(newRunners);
      setRunsThisPlay(runs);
      setLastHit(hitType);
      setStreak(newStreak);
      setGameBestStreak((prev) => Math.max(prev, newStreak));
      setScore(newScore);
    } catch {
      return;
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
    if (!currentGame || isRecordingPlay || isEndingGame) return;

    // Reset current streak (game best streak is already tracked)
    const newOuts = outs + 1;

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

    try {
      await recordPlay(play);
      playSound(failAudioRef);
      setStreak(0);
      setOuts(newOuts);
    } catch {
      return;
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
    if (!currentGame || isEndingGame) return;

    setIsEndingGame(true);
    setGameError("");

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

      const saveResp = await axios.put(`${COUCHDB_BASE}/${currentGame._id}`, gameDoc);
      const savedGame = { ...gameDoc, _rev: saveResp.data.rev };
      setCurrentGame(savedGame);
      setLastSavedAt(new Date());

      // Update game best streak state for display
      setGameBestStreak(finalGameBestStreak);

      try {
        // Update stats for the current user
        await updateUserStats(savedGame, userDocId, userId);

        // Update stats for player 2 in multiplayer
        if (gameMode === "multiplayer" && player2) {
          await updateUserStats(savedGame, `user:${player2}`, player2);
        }
      } catch (statsUpdateError) {
        console.error("Error updating baseball stats:", statsUpdateError);
        setGameError("Game saved, but career stats did not update. Refresh stats later.");
      }

      setShowGameOver(true);
      playSound(victoryAudioRef);
    } catch (error) {
      console.error("Error ending game:", error);
      setGameError("Could not finish and save the game. Try again before leaving.");
    } finally {
      setIsEndingGame(false);
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

      const saveResp = await axios.put(`${COUCHDB_BASE}/${statsDoc._id}`, statsDoc);
      const savedStatsDoc = { ...statsDoc, _rev: saveResp.data.rev };

      // Only update local state if this is the current user
      if (targetUserDocId === userDocId) {
        setUserStats(savedStatsDoc);
        setAllTimeBestStreak(savedStatsDoc.bestStreak || 0);
      }
    } catch (error) {
      console.error("Error updating user stats:", error);
      throw error;
    }
  };

  const resetGame = () => {
    setCurrentGame(null);
    setShowModeSelect(true);
    setShowGameOver(false);
    setGameMode(null);
    setGameError("");
    setLastSavedAt(null);
    fetchUserStats();
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

  const completedPlays = currentGame?.plays || [];
  const completedHits = completedPlays.filter((play) => play.type !== "out");
  const completedOuts = completedPlays.filter((play) => play.type === "out");
  const lastSavedLabel = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not saved yet";
  const controlsDisabled = isRecordingPlay || isEndingGame;
  const multiplayerBlocked = availableProfiles.length === 0 || Boolean(profilesError);

  // Mode selection dialog
  if (showModeSelect) {
    return (
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 3, sm: 4 }, overflowX: "hidden" }}
      >
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2,
                  bgcolor: "#0f3d5e",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <BaseballIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h3"
                  sx={{
                    color: "#0f172a",
                    fontWeight: 800,
                    lineHeight: 1.05,
                    overflowWrap: "anywhere",
                  }}
                >
                  Pro Pitch Baseball
                </Typography>
                <Typography color="text.secondary">
                  {user?.name ? `${user.name}'s game setup` : "Game setup"}
                </Typography>
              </Box>
            </Stack>

            <Chip
              icon={isLoadingSetup ? <CircularProgress size={14} /> : <QueryStatsIcon />}
              label={isLoadingSetup ? "Loading records" : "Ready"}
              color={isLoadingSetup ? "default" : "success"}
              variant={isLoadingSetup ? "outlined" : "filled"}
              sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
            />
          </Stack>

          {gameError && <Alert severity="error">{gameError}</Alert>}
          {statsError && (
            <Alert severity="warning" onClose={() => setStatsError("")}>
              {statsError}
            </Alert>
          )}
          {profilesError && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={fetchAvailableProfiles}
                >
                  Retry
                </Button>
              }
            >
              {profilesError}
            </Alert>
          )}

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", md: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Career Records
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  These are loaded from the baseball database before play starts.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`High Score: ${userStats?.highScore || 0}`} />
                <Chip label={`Best Streak: ${userStats?.bestStreak || 0}`} />
                <Chip
                  label={`Best Inning: ${userStats?.bestSingleInning || 0}`}
                />
                <Chip label={`Games: ${userStats?.totalGames || 0}`} />
              </Stack>
            </Stack>
          </Paper>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: "100%", borderRadius: 2 }}>
                <CardActionArea
                  disabled={isStartingGame}
                  onClick={() => startGame("single-inning")}
                  sx={{ height: "100%" }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: "#e8f1f7",
                            color: "#0f3d5e",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <PlayArrowIcon />
                        </Box>
                        <Box>
                          <Chip size="small" color="primary" label="Quick Play" />
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            Single Inning
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography color="text.secondary">
                        Score as many runs as you can before 3 outs. Best for a
                        fast round with minimal setup.
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: "100%", borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          bgcolor: "#ecfdf3",
                          color: "#166534",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <BaseballIcon />
                      </Box>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          Full Game
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Track runs across multiple innings.
                        </Typography>
                      </Box>
                    </Stack>
                    <FormControl fullWidth size="small">
                      <InputLabel>Number of Innings</InputLabel>
                      <Select
                        value={selectedInnings}
                        onChange={(e) => setSelectedInnings(Number(e.target.value))}
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
                      disabled={isStartingGame}
                      startIcon={
                        isStartingGame ? <CircularProgress size={16} /> : <PlayArrowIcon />
                      }
                      fullWidth
                    >
                      Start Full Game
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: "100%", borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          bgcolor: "#fdf2f8",
                          color: "#be185d",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <GroupsIcon />
                      </Box>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          Multiplayer
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Take turns batting with another player.
                        </Typography>
                      </Box>
                    </Stack>
                    {multiplayerBlocked ? (
                      <Alert severity="info" sx={{ alignItems: "center" }}>
                        Add another player before starting multiplayer.
                      </Alert>
                    ) : (
                      <FormControl fullWidth size="small">
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
                    )}
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => startGame("multiplayer")}
                      disabled={!player2 || isStartingGame || multiplayerBlocked}
                      startIcon={
                        isStartingGame ? <CircularProgress size={16} /> : <GroupsIcon />
                      }
                      fullWidth
                    >
                      Start Multiplayer
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="lg"
      sx={{
        py: { xs: 2.5, sm: 4 },
        pb: { xs: 10, sm: 4 },
        overflowX: "hidden",
      }}
    >
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

      <Stack spacing={2.5}>
        {/* Header with title and mute button */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h3"
              sx={{
                color: "#0f172a",
                fontWeight: 800,
                lineHeight: 1.05,
                overflowWrap: "anywhere",
              }}
            >
              Pro Pitch Baseball
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={
                  gameMode === "single-inning"
                    ? "Single Inning"
                    : gameMode === "multiplayer"
                    ? "Multiplayer"
                    : `${totalInnings} Inning Game`
                }
              />
              <Chip size="small" variant="outlined" label={`Saved: ${lastSavedLabel}`} />
              {isRecordingPlay && (
                <Chip
                  size="small"
                  icon={<CircularProgress size={12} />}
                  label="Saving play"
                />
              )}
            </Stack>
          </Box>
          <Tooltip title={isMuted ? "Unmute Sound" : "Mute Sound"}>
            <IconButton
              aria-label={isMuted ? "Unmute sound" : "Mute sound"}
              onClick={() => setIsMuted(!isMuted)}
              sx={{
                alignSelf: { xs: "flex-start", sm: "center" },
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
        </Stack>

        {gameError && (
          <Alert severity={showGameOver ? "warning" : "error"} onClose={() => setGameError("")}>
            {gameError}
          </Alert>
        )}

      {/* Scoreboard */}
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, backgroundColor: "#1a1a2e", borderRadius: 2 }}>
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
              disabled={controlsDisabled}
              aria-label={`Record ${hit.name}`}
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
                "&.Mui-disabled": {
                  backgroundColor: hit.color,
                  color: "white",
                  opacity: 0.45,
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
          disabled={controlsDisabled}
          aria-label="Record miss or out"
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
          disabled={controlsDisabled}
          sx={{ fontSize: "1rem" }}
        >
          {isEndingGame ? "Saving Game..." : "End Game Early"}
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
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Game Complete
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          {gameMode === "multiplayer" ? (
            <Box textAlign="center">
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 800 }}>
                {score.away > score.home
                  ? `${players[0]} Wins!`
                  : score.home > score.away
                  ? `${players[1]} Wins!`
                  : "It's a Tie!"}
              </Typography>
              <Typography variant="h4" sx={{ my: 2, fontWeight: 800 }}>
                {score.away} - {score.home}
              </Typography>
            </Box>
          ) : (
            <Box textAlign="center">
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 800 }}>
                Final Score
              </Typography>
              <Typography
                variant="h2"
                sx={{ color: "#0066cc", fontWeight: "bold", my: 2 }}
              >
                {score.home} RUNS
              </Typography>
            </Box>
          )}

          <Grid container spacing={1.5} sx={{ mt: 1 }}>
            {[
              {
                label: "Runs",
                value: gameMode === "multiplayer" ? score.home + score.away : score.home,
              },
              { label: "Hits", value: completedHits.length },
              { label: "Outs", value: completedOuts.length },
              { label: "Best Streak", value: Math.max(gameBestStreak, streak) },
            ].map((item) => (
              <Grid item xs={6} sm={3} key={item.label}>
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {item.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.label}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {userStats && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Career high score: {userStats.highScore || 0}. Career best streak:{" "}
              {userStats.bestStreak || 0}.
            </Alert>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: "center",
            gap: 1,
            flexWrap: "wrap",
            px: 3,
            pb: 3,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={resetGame}
            startIcon={<RestartAltIcon />}
          >
            Play Again
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate("/baseball/stats")}
            startIcon={<QueryStatsIcon />}
          >
            View Stats
          </Button>
        </DialogActions>
      </Dialog>
      </Stack>
    </Container>
  );
};

export default BaseballGame;
