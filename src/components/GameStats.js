import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Chip,
  Divider,
  Avatar,
  LinearProgress,
} from "@mui/material";
import {
  EmojiEvents as TrophyIcon,
  SportsBaseball as BaseballIcon,
} from "@mui/icons-material";
import axios from "axios";
import { useUser } from "../UserContext";

const GameStats = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const { user } = useUser();
  const userId = user?.id;
  const userDocId = `user:${userId}`;

  const [games, setGames] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [leaderboardCategory, setLeaderboardCategory] = useState("highScore");
  const [headToHead, setHeadToHead] = useState([]);

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
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  }, [COUCHDB_BASE, userDocId]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const allStatsResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "baseball_stats",
        },
      });

      // Get user names
      const usersResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "user" },
      });

      const userMap = {};
      usersResp.data.docs.forEach((u) => {
        userMap[u._id] = u.name;
      });

      const leaderboardData = allStatsResp.data.docs.map((stat) => ({
        ...stat,
        userName: userMap[stat.user_id] || "Unknown",
      }));

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  }, [COUCHDB_BASE]);

  const calculateHeadToHead = useCallback(
    (games) => {
      const h2hMap = {};

      games.forEach((game) => {
        if (game.mode !== "multiplayer") return;

        let opponentId, opponentName;
        const isPlayer1 = game.user_id === userDocId;

        if (isPlayer1) {
          opponentId = game.player2_id;
          opponentName = game.player2_name;
        } else {
          opponentId = game.user_id;
          opponentName = game.player1_name;
        }

        if (!opponentId) return;

        if (!h2hMap[opponentId]) {
          h2hMap[opponentId] = {
            opponentId,
            opponentName,
            wins: 0,
            losses: 0,
            ties: 0,
            totalGames: 0,
            runsFor: 0,
            runsAgainst: 0,
          };
        }

        h2hMap[opponentId].totalGames++;

        // Calculate runs for/against this user
        const userPlays = (game.plays || []).filter(
          (p) => p.player_id === userDocId
        );
        const opponentPlays = (game.plays || []).filter(
          (p) => p.player_id === opponentId
        );

        const userRuns = userPlays.reduce((sum, p) => sum + (p.runs || 0), 0);
        const opponentRuns = opponentPlays.reduce(
          (sum, p) => sum + (p.runs || 0),
          0
        );

        h2hMap[opponentId].runsFor += userRuns;
        h2hMap[opponentId].runsAgainst += opponentRuns;

        // Determine winner
        if (game.winner_id === userDocId) {
          h2hMap[opponentId].wins++;
        } else if (game.winner_id === null) {
          h2hMap[opponentId].ties++;
        } else {
          h2hMap[opponentId].losses++;
        }
      });

      setHeadToHead(Object.values(h2hMap));
    },
    [userDocId]
  );

  const fetchGameHistory = useCallback(async () => {
    try {
      // Fetch games where user was player 1 (started the game)
      const gamesAsPlayer1Resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "baseball_game",
          user_id: userDocId,
          status: "completed",
        },
        limit: 100,
      });

      // Fetch games where user was player 2
      const gamesAsPlayer2Resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "baseball_game",
          player2_id: userDocId,
          status: "completed",
        },
        limit: 100,
      });

      // Combine and deduplicate games
      const allGames = [
        ...gamesAsPlayer1Resp.data.docs,
        ...gamesAsPlayer2Resp.data.docs,
      ];

      // Remove duplicates based on _id
      const uniqueGames = allGames.filter(
        (game, index, self) =>
          index === self.findIndex((g) => g._id === game._id)
      );

      // Sort by date descending
      uniqueGames.sort(
        (a, b) => new Date(b.started_at) - new Date(a.started_at)
      );
      setGames(uniqueGames);

      // Calculate head-to-head records
      calculateHeadToHead(uniqueGames);
    } catch (error) {
      console.error("Error fetching game history:", error);
    }
  }, [COUCHDB_BASE, userDocId, calculateHeadToHead]);

  useEffect(() => {
    if (userId) {
      fetchGameHistory();
      fetchUserStats();
      fetchLeaderboard();
    }
  }, [userId, fetchGameHistory, fetchUserStats, fetchLeaderboard]);

  const formatDate = (isoString) => {
    return (
      new Date(isoString).toLocaleDateString() +
      " " +
      new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const calculateBattingAverage = (stats) => {
    if (!stats) return ".000";
    const atBats = (stats.totalHits || 0) + (stats.totalOuts || 0);
    if (atBats === 0) return ".000";
    const avg = (stats.totalHits || 0) / atBats;
    return avg.toFixed(3).replace("0.", ".");
  };

  const getWinPercentage = (stats) => {
    if (!stats || !stats.multiplayerGames) return 0;
    return Math.round(
      ((stats.multiplayerWins || 0) / stats.multiplayerGames) * 100
    );
  };

  const getSortedLeaderboard = () => {
    const sorted = [...leaderboard].sort((a, b) => {
      switch (leaderboardCategory) {
        case "highScore":
          return (b.highScore || 0) - (a.highScore || 0);
        case "totalRuns":
          return (b.totalRuns || 0) - (a.totalRuns || 0);
        case "homeRuns":
          return (b.homeRuns || 0) - (a.homeRuns || 0);
        case "bestStreak":
          return (b.bestStreak || 0) - (a.bestStreak || 0);
        case "battingAvg":
          const avgA =
            (a.totalHits || 0) / ((a.totalHits || 0) + (a.totalOuts || 0)) || 0;
          const avgB =
            (b.totalHits || 0) / ((b.totalHits || 0) + (b.totalOuts || 0)) || 0;
          return avgB - avgA;
        case "multiplayerWins":
          return (b.multiplayerWins || 0) - (a.multiplayerWins || 0);
        case "gamesPlayed":
          return (b.totalGames || 0) - (a.totalGames || 0);
        default:
          return (b.highScore || 0) - (a.highScore || 0);
      }
    });
    return sorted;
  };

  const getLeaderboardValue = (stat) => {
    switch (leaderboardCategory) {
      case "highScore":
        return stat.highScore || 0;
      case "totalRuns":
        return stat.totalRuns || 0;
      case "homeRuns":
        return stat.homeRuns || 0;
      case "bestStreak":
        return stat.bestStreak || 0;
      case "battingAvg":
        return calculateBattingAverage(stat);
      case "multiplayerWins":
        return stat.multiplayerWins || 0;
      case "gamesPlayed":
        return stat.totalGames || 0;
      default:
        return stat.highScore || 0;
    }
  };

  const leaderboardCategories = [
    { value: "highScore", label: "High Score" },
    { value: "totalRuns", label: "Total Runs" },
    { value: "homeRuns", label: "Home Runs" },
    { value: "bestStreak", label: "Best Streak" },
    { value: "battingAvg", label: "Batting Avg" },
    { value: "multiplayerWins", label: "MP Wins" },
    { value: "gamesPlayed", label: "Games Played" },
  ];

  // Get user's game-specific stats from plays
  const getUserGameStats = (game) => {
    const plays = game.plays || [];
    const isMultiplayer = game.mode === "multiplayer";

    // For multiplayer, get only this user's plays
    const userPlays = isMultiplayer
      ? plays.filter((p) => p.player_id === userDocId)
      : plays;

    const hits = userPlays.filter((p) => p.type !== "out").length;
    const homeRuns = userPlays.filter((p) => p.type === "home-run").length;
    const bestStreakInGame = Math.max(
      ...userPlays.map((p) => p.streak || 0),
      0
    );
    const runsScored = userPlays.reduce((sum, p) => sum + (p.runs || 0), 0);

    return { hits, homeRuns, bestStreakInGame, runsScored };
  };

  // Determine if user won/lost/tied a multiplayer game
  const getGameResult = (game) => {
    if (game.mode !== "multiplayer") return null;
    if (game.winner_id === userDocId) return "win";
    if (game.winner_id === null) return "tie";
    return "loss";
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography
        variant="h3"
        align="center"
        gutterBottom
        sx={{ color: "#0066cc", fontWeight: "bold" }}
      >
        📊 Baseball Statistics 📊
      </Typography>

      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        centered
        sx={{ mb: 3 }}
      >
        <Tab label="My Stats" />
        <Tab label="Leaderboard" />
        <Tab label="Game History" />
        <Tab label="Head-to-Head" />
      </Tabs>

      {/* My Stats Tab */}
      {tabValue === 0 && (
        <>
          {/* Career Records */}
          <Paper sx={{ p: 3, mb: 4, backgroundColor: "#1a1a2e" }}>
            <Typography
              variant="h5"
              align="center"
              sx={{ color: "#FFD700", mb: 3 }}
            >
              🏆 Career Records 🏆
            </Typography>
            <Grid container spacing={3} justifyContent="center">
              <Grid item xs={6} sm={4} md={2}>
                <Box textAlign="center">
                  <Typography
                    variant="h3"
                    sx={{ color: "#fff", fontWeight: "bold" }}
                  >
                    {userStats?.highScore || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#FFD700" }}>
                    High Score
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Box textAlign="center">
                  <Typography
                    variant="h3"
                    sx={{ color: "#fff", fontWeight: "bold" }}
                  >
                    {userStats?.bestStreak || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#FFD700" }}>
                    Best Streak
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Box textAlign="center">
                  <Typography
                    variant="h3"
                    sx={{ color: "#fff", fontWeight: "bold" }}
                  >
                    {userStats?.bestSingleInning || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#FFD700" }}>
                    Best Inning
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Box textAlign="center">
                  <Typography
                    variant="h3"
                    sx={{ color: "#fff", fontWeight: "bold" }}
                  >
                    {calculateBattingAverage(userStats)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#FFD700" }}>
                    Batting Avg
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Multiplayer Record */}
          {(userStats?.multiplayerGames || 0) > 0 && (
            <Paper sx={{ p: 3, mb: 4, backgroundColor: "#fce4ec" }}>
              <Typography
                variant="h5"
                align="center"
                sx={{ color: "#c2185b", mb: 3 }}
              >
                👥 Multiplayer Record 👥
              </Typography>
              <Grid
                container
                spacing={3}
                justifyContent="center"
                alignItems="center"
              >
                <Grid item xs={12} sm={6} md={4}>
                  <Box textAlign="center">
                    <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                      <span style={{ color: "#4caf50" }}>
                        {userStats?.multiplayerWins || 0}
                      </span>
                      {" - "}
                      <span style={{ color: "#f44336" }}>
                        {userStats?.multiplayerLosses || 0}
                      </span>
                      {(userStats?.multiplayerTies || 0) > 0 && (
                        <>
                          {" - "}
                          <span style={{ color: "#ff9800" }}>
                            {userStats?.multiplayerTies || 0}
                          </span>
                        </>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Wins - Losses
                      {(userStats?.multiplayerTies || 0) > 0 ? " - Ties" : ""}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box textAlign="center">
                    <Typography
                      variant="h4"
                      sx={{ fontWeight: "bold", color: "#1976d2" }}
                    >
                      {getWinPercentage(userStats)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Win Rate
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={getWinPercentage(userStats)}
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box textAlign="center">
                    <Typography
                      variant="h4"
                      sx={{ fontWeight: "bold", color: "#7b1fa2" }}
                    >
                      {userStats?.multiplayerGames || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total MP Games
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Career Totals */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: "center", bgcolor: "#e3f2fd" }}>
                <CardContent>
                  <Typography
                    variant="h4"
                    sx={{ color: "#1976d2", fontWeight: "bold" }}
                  >
                    {userStats?.totalGames || 0}
                  </Typography>
                  <Typography variant="body2">Games Played</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: "center", bgcolor: "#f3e5f5" }}>
                <CardContent>
                  <Typography
                    variant="h4"
                    sx={{ color: "#7b1fa2", fontWeight: "bold" }}
                  >
                    {userStats?.totalRuns || 0}
                  </Typography>
                  <Typography variant="body2">Total Runs</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: "center", bgcolor: "#ffebee" }}>
                <CardContent>
                  <Typography
                    variant="h4"
                    sx={{ color: "#c62828", fontWeight: "bold" }}
                  >
                    {userStats?.homeRuns || 0}
                  </Typography>
                  <Typography variant="body2">Home Runs 💥</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: "center", bgcolor: "#fff3e0" }}>
                <CardContent>
                  <Typography
                    variant="h4"
                    sx={{ color: "#f57c00", fontWeight: "bold" }}
                  >
                    {userStats?.triples || 0}
                  </Typography>
                  <Typography variant="body2">Triples 🔥</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: "center", bgcolor: "#fffde7" }}>
                <CardContent>
                  <Typography
                    variant="h4"
                    sx={{ color: "#f9a825", fontWeight: "bold" }}
                  >
                    {userStats?.doubles || 0}
                  </Typography>
                  <Typography variant="body2">Doubles ⚡</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: "center", bgcolor: "#e8f5e9" }}>
                <CardContent>
                  <Typography
                    variant="h4"
                    sx={{ color: "#388e3c", fontWeight: "bold" }}
                  >
                    {userStats?.singles || 0}
                  </Typography>
                  <Typography variant="body2">Singles ✓</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Hit Distribution */}
          {userStats && (userStats.totalHits || 0) > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Hit Distribution
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  height: "40px",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {userStats.homeRuns > 0 && (
                  <Box
                    sx={{
                      flex: userStats.homeRuns,
                      backgroundColor: "#ff4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                    }}
                  >
                    HR: {userStats.homeRuns}
                  </Box>
                )}
                {userStats.triples > 0 && (
                  <Box
                    sx={{
                      flex: userStats.triples,
                      backgroundColor: "#ff8800",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                    }}
                  >
                    3B: {userStats.triples}
                  </Box>
                )}
                {userStats.doubles > 0 && (
                  <Box
                    sx={{
                      flex: userStats.doubles,
                      backgroundColor: "#ffaa00",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                    }}
                  >
                    2B: {userStats.doubles}
                  </Box>
                )}
                {userStats.singles > 0 && (
                  <Box
                    sx={{
                      flex: userStats.singles,
                      backgroundColor: "#88cc00",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                    }}
                  >
                    1B: {userStats.singles}
                  </Box>
                )}
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* Leaderboard Tab */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom align="center">
            🏆 Leaderboard 🏆
          </Typography>

          {/* Category selector */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              justifyContent: "center",
              mb: 3,
            }}
          >
            {leaderboardCategories.map((cat) => (
              <Chip
                key={cat.value}
                label={cat.label}
                onClick={() => setLeaderboardCategory(cat.value)}
                color={
                  leaderboardCategory === cat.value ? "primary" : "default"
                }
                variant={
                  leaderboardCategory === cat.value ? "filled" : "outlined"
                }
              />
            ))}
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                  <TableCell>
                    <strong>Rank</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Player</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>
                      {
                        leaderboardCategories.find(
                          (c) => c.value === leaderboardCategory
                        )?.label
                      }
                    </strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Games</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Batting Avg</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getSortedLeaderboard().map((stat, index) => (
                  <TableRow
                    key={stat._id}
                    hover
                    sx={{
                      backgroundColor:
                        stat.user_id === userDocId ? "#e3f2fd" : "inherit",
                    }}
                  >
                    <TableCell>
                      {index === 0
                        ? "🥇"
                        : index === 1
                        ? "🥈"
                        : index === 2
                        ? "🥉"
                        : index + 1}
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Avatar
                          sx={{ width: 28, height: 28, bgcolor: "#1976d2" }}
                        >
                          {stat.userName?.[0]?.toUpperCase() || "?"}
                        </Avatar>
                        {stat.userName}
                        {stat.user_id === userDocId && (
                          <Chip size="small" label="You" color="primary" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{getLeaderboardValue(stat)}</strong>
                    </TableCell>
                    <TableCell align="right">{stat.totalGames || 0}</TableCell>
                    <TableCell align="right">
                      {calculateBattingAverage(stat)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {leaderboard.length === 0 && (
            <Box textAlign="center" sx={{ py: 4 }}>
              <Typography color="text.secondary">
                No players on the leaderboard yet!
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Game History Tab */}
      {tabValue === 2 && (
        <>
          <Typography variant="h5" gutterBottom sx={{ mt: 2 }}>
            Recent Games
          </Typography>

          {games.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    <TableCell>
                      <strong>Date</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Mode</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Result</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Your Runs</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Hits</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Home Runs</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Best Streak</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {games.map((game) => {
                    const { hits, homeRuns, bestStreakInGame, runsScored } =
                      getUserGameStats(game);
                    const result = getGameResult(game);
                    const isMultiplayer = game.mode === "multiplayer";
                    const isPlayer1 = game.user_id === userDocId;
                    const opponent = isPlayer1
                      ? game.player2_name
                      : game.player1_name;

                    return (
                      <TableRow key={game._id} hover>
                        <TableCell>{formatDate(game.started_at)}</TableCell>
                        <TableCell>
                          <Box>
                            <Chip
                              size="small"
                              label={
                                game.mode === "single-inning"
                                  ? "Single Inning"
                                  : game.mode === "multiplayer"
                                  ? "Multiplayer"
                                  : "Full Game"
                              }
                              color={
                                game.mode === "single-inning"
                                  ? "primary"
                                  : game.mode === "multiplayer"
                                  ? "secondary"
                                  : "success"
                              }
                            />
                            {isMultiplayer && (
                              <Typography
                                variant="caption"
                                display="block"
                                sx={{ mt: 0.5 }}
                              >
                                vs {opponent}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {isMultiplayer ? (
                            <Chip
                              size="small"
                              label={
                                result === "win"
                                  ? "Win"
                                  : result === "loss"
                                  ? "Loss"
                                  : "Tie"
                              }
                              color={
                                result === "win"
                                  ? "success"
                                  : result === "loss"
                                  ? "error"
                                  : "warning"
                              }
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <strong>{runsScored}</strong>
                        </TableCell>
                        <TableCell align="right">{hits}</TableCell>
                        <TableCell align="right">{homeRuns}</TableCell>
                        <TableCell align="right">{bestStreakInGame}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box textAlign="center" sx={{ py: 8 }}>
              <BaseballIcon sx={{ fontSize: 60, color: "#ccc", mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No games played yet! Start your first game to see statistics
                here.
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Head-to-Head Tab */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom align="center">
            👥 Head-to-Head Records 👥
          </Typography>

          {headToHead.length > 0 ? (
            <Grid container spacing={3}>
              {headToHead.map((h2h) => (
                <Grid item xs={12} sm={6} md={4} key={h2h.opponentId}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 2,
                        }}
                      >
                        <Avatar sx={{ bgcolor: "#7b1fa2" }}>
                          {h2h.opponentName?.[0]?.toUpperCase() || "?"}
                        </Avatar>
                        <Typography variant="h6">
                          vs {h2h.opponentName}
                        </Typography>
                      </Box>

                      <Divider sx={{ mb: 2 }} />

                      <Box textAlign="center" sx={{ mb: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                          <span style={{ color: "#4caf50" }}>{h2h.wins}</span>
                          {" - "}
                          <span style={{ color: "#f44336" }}>{h2h.losses}</span>
                          {h2h.ties > 0 && (
                            <>
                              {" - "}
                              <span style={{ color: "#ff9800" }}>
                                {h2h.ties}
                              </span>
                            </>
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {h2h.totalGames} games played
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box textAlign="center">
                          <Typography variant="h6" color="primary">
                            {h2h.runsFor}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Runs For
                          </Typography>
                        </Box>
                        <Box textAlign="center">
                          <Typography variant="h6" color="error">
                            {h2h.runsAgainst}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Runs Against
                          </Typography>
                        </Box>
                        <Box textAlign="center">
                          <Typography
                            variant="h6"
                            sx={{
                              color:
                                h2h.runsFor > h2h.runsAgainst
                                  ? "#4caf50"
                                  : h2h.runsFor < h2h.runsAgainst
                                  ? "#f44336"
                                  : "#ff9800",
                            }}
                          >
                            {h2h.runsFor - h2h.runsAgainst > 0 ? "+" : ""}
                            {h2h.runsFor - h2h.runsAgainst}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Run Diff
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box textAlign="center" sx={{ py: 8 }}>
              <TrophyIcon sx={{ fontSize: 60, color: "#ccc", mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No multiplayer games played yet!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Play some multiplayer games to see your head-to-head records
                here.
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
};

export default GameStats;
