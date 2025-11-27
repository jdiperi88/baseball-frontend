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
} from "@mui/material";
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
        userMap[`user:${u._id.replace("user:", "")}`] = u.name;
      });

      const leaderboardData = allStatsResp.data.docs
        .map((stat) => ({
          ...stat,
          userName: userMap[stat.user_id] || "Unknown",
        }))
        .sort((a, b) => (b.highScore || 0) - (a.highScore || 0));

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  }, [COUCHDB_BASE]);

  const fetchGameHistory = useCallback(async () => {
    try {
      const gamesResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "baseball_game",
          user_id: userDocId,
          status: "completed",
        },
        limit: 50,
      });

      const gameData = gamesResp.data.docs || [];
      // Sort by date descending
      gameData.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      setGames(gameData);
    } catch (error) {
      console.error("Error fetching game history:", error);
    }
  }, [COUCHDB_BASE, userDocId]);

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

  const calculateBattingAverage = () => {
    if (!userStats) return ".000";
    const atBats = (userStats.totalHits || 0) + (userStats.totalOuts || 0);
    if (atBats === 0) return ".000";
    const avg = (userStats.totalHits || 0) / atBats;
    return avg.toFixed(3).replace("0.", ".");
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
                    {calculateBattingAverage()}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#FFD700" }}>
                    Batting Avg
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

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
            🏆 High Score Leaderboard 🏆
          </Typography>
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
                    <strong>High Score</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Best Streak</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Total Runs</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Home Runs</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboard.map((stat, index) => (
                  <TableRow
                    key={stat._id}
                    hover
                    sx={{
                      backgroundColor:
                        stat.user_id === userDocId ? "#e3f2fd" : "inherit",
                      fontWeight:
                        stat.user_id === userDocId ? "bold" : "normal",
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
                      {stat.userName}
                      {stat.user_id === userDocId && (
                        <Chip size="small" label="You" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">{stat.highScore || 0}</TableCell>
                    <TableCell align="right">{stat.bestStreak || 0}</TableCell>
                    <TableCell align="right">{stat.totalRuns || 0}</TableCell>
                    <TableCell align="right">{stat.homeRuns || 0}</TableCell>
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
                    <TableCell align="right">
                      <strong>Score</strong>
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
                    const plays = game.plays || [];
                    const hits = plays.filter((p) => p.type !== "out").length;
                    const homeRuns = plays.filter(
                      (p) => p.type === "home-run"
                    ).length;
                    const bestStreakInGame = Math.max(
                      ...plays.map((p) => p.streak || 0),
                      0
                    );
                    const totalRuns = plays.reduce(
                      (sum, p) => sum + (p.runs || 0),
                      0
                    );

                    return (
                      <TableRow key={game._id} hover>
                        <TableCell>{formatDate(game.started_at)}</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell align="right">
                          <strong>{totalRuns}</strong>
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
              <Typography variant="h6" color="text.secondary">
                No games played yet! Start your first game to see statistics
                here.
              </Typography>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default GameStats;
