import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Paper,
  Dialog,
  DialogContent,
} from "@mui/material";
import axios from "axios";
import { useUser } from "../UserContext";
import Confetti from "react-confetti";
import CoinsWalletWrapper from "./CoinsWalletWrapper";
import successSound from "../assets/sounds/success.mp3";
import failSound from "../assets/sounds/fail.mp3";
import victorySound from "../assets/sounds/victory.mp3";

const PitchingGame = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const { user } = useUser();
  const userId = user?.id;
  const userDocId = `user:${userId}`;

  const [coins, setCoins] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [currentGame, setCurrentGame] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameStats, setGameStats] = useState({ hits: 0, total: 0 });

  const successAudioRef = useRef(null);
  const failAudioRef = useRef(null);
  const victoryAudioRef = useRef(null);

  // Target zones based on Pro Pitch Challenge
  const targetZones = [
    {
      id: "home-run",
      name: "HOME RUN",
      points: 100,
      color: "#ff4444",
      position: { top: "15%", left: "15%" },
    },
    {
      id: "triple",
      name: "TRIPLE",
      points: 75,
      color: "#ff8800",
      position: { top: "15%", right: "15%" },
    },
    {
      id: "double-1",
      name: "DOUBLE",
      points: 50,
      color: "#ffaa00",
      position: { top: "45%", left: "15%" },
    },
    {
      id: "double-2",
      name: "DOUBLE",
      points: 50,
      color: "#ffaa00",
      position: { top: "45%", right: "15%" },
    },
    {
      id: "single-1",
      name: "SINGLE",
      points: 25,
      color: "#88cc00",
      position: { bottom: "15%", left: "15%" },
    },
    {
      id: "single-2",
      name: "SINGLE",
      points: 25,
      color: "#88cc00",
      position: { bottom: "15%", right: "15%" },
    },
    {
      id: "strikes",
      name: "STRIKES",
      points: 10,
      color: "#0088cc",
      position: { bottom: "45%", left: "50%", transform: "translateX(-50%)" },
    },
  ];

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const fetchUserData = async () => {
    try {
      const userResp = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      setCoins(userResp.data.coins || 0);
      setWalletAmount(userResp.data.wallet || 0);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const startNewGame = async () => {
    try {
      const gameId = `game:${Date.now()}`;
      const newGame = {
        _id: gameId,
        type: "pitching_game",
        user_id: userDocId,
        started_at: new Date().toISOString(),
        pitches: [],
        total_score: 0,
        status: "active",
      };

      await axios.put(`${COUCHDB_BASE}/${gameId}`, newGame);
      setCurrentGame(newGame);
      setGameStats({ hits: 0, total: 0 });
      setShowGameOver(false);
    } catch (error) {
      console.error("Error starting new game:", error);
    }
  };

  const handleZoneHit = async (zone) => {
    if (!currentGame) return;

    try {
      // Update game document
      const gameResp = await axios.get(`${COUCHDB_BASE}/${currentGame._id}`);
      const gameDoc = gameResp.data;

      const pitch = {
        timestamp: new Date().toISOString(),
        zone: zone.id,
        points: zone.points,
      };

      gameDoc.pitches.push(pitch);
      gameDoc.total_score += zone.points;

      await axios.put(`${COUCHDB_BASE}/${currentGame._id}`, gameDoc);

      // Update local state
      setCurrentGame(gameDoc);
      setGameStats((prev) => ({
        hits: prev.hits + 1,
        total: prev.total + 1,
      }));

      // Award coins based on zone
      const coinsEarned = Math.floor(zone.points / 10);
      if (coinsEarned > 0) {
        await awardCoins(coinsEarned);
      }

      // Play success sound and show confetti for good hits
      if (zone.points >= 50) {
        successAudioRef.current?.play();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } catch (error) {
      console.error("Error recording pitch:", error);
    }
  };

  const handleMiss = async () => {
    if (!currentGame) return;

    try {
      const gameResp = await axios.get(`${COUCHDB_BASE}/${currentGame._id}`);
      const gameDoc = gameResp.data;

      const pitch = {
        timestamp: new Date().toISOString(),
        zone: "miss",
        points: 0,
      };

      gameDoc.pitches.push(pitch);
      await axios.put(`${COUCHDB_BASE}/${currentGame._id}`, gameDoc);

      setCurrentGame(gameDoc);
      setGameStats((prev) => ({
        hits: prev.hits,
        total: prev.total + 1,
      }));

      failAudioRef.current?.play();
    } catch (error) {
      console.error("Error recording miss:", error);
    }
  };

  const endGame = async () => {
    if (!currentGame) return;

    try {
      const gameResp = await axios.get(`${COUCHDB_BASE}/${currentGame._id}`);
      const gameDoc = gameResp.data;

      gameDoc.status = "completed";
      gameDoc.ended_at = new Date().toISOString();
      gameDoc.accuracy =
        gameStats.total > 0
          ? ((gameStats.hits / gameStats.total) * 100).toFixed(1)
          : 0;

      await axios.put(`${COUCHDB_BASE}/${currentGame._id}`, gameDoc);

      setCurrentGame(null);
      setShowGameOver(true);
      victoryAudioRef.current?.play();
    } catch (error) {
      console.error("Error ending game:", error);
    }
  };

  const awardCoins = async (amount) => {
    try {
      const userResp = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      const userDoc = userResp.data;

      userDoc.coins = (userDoc.coins || 0) + amount;
      await axios.put(`${COUCHDB_BASE}/${userDocId}`, userDoc);

      setCoins(userDoc.coins);
    } catch (error) {
      console.error("Error awarding coins:", error);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <audio ref={successAudioRef} src={successSound} />
      <audio ref={failAudioRef} src={failSound} />
      <audio ref={victoryAudioRef} src={victorySound} />

      {showConfetti && (
        <Confetti width={window.innerWidth} height={window.innerHeight} />
      )}

      <Typography
        variant="h3"
        align="center"
        gutterBottom
        sx={{ color: "#0066cc", fontWeight: "bold" }}
      >
        ⚾ Pro Pitch Challenge ⚾
      </Typography>

      <Box display="flex" justifyContent="center" mb={3}>
        <CoinsWalletWrapper coins={coins} walletAmount={walletAmount} />
      </Box>

      {currentGame && (
        <Box textAlign="center" mb={3}>
          <Typography variant="h6">
            Score: {currentGame.total_score} | Accuracy:{" "}
            {gameStats.total > 0
              ? ((gameStats.hits / gameStats.total) * 100).toFixed(1)
              : 0}
            %
          </Typography>
          <Typography variant="body1">
            Hits: {gameStats.hits}/{gameStats.total}
          </Typography>
        </Box>
      )}

      {/* Baseball Diamond with Target Zones */}
      <Box
        sx={{
          position: "relative",
          width: "600px",
          height: "600px",
          margin: "0 auto",
          backgroundColor: "#2d5016",
          borderRadius: "50%",
          border: "8px solid #8B4513",
        }}
      >
        {/* Infield diamond */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "300px",
            height: "300px",
            transform: "translate(-50%, -50%) rotate(45deg)",
            backgroundColor: "#8B4513",
            border: "4px solid #654321",
          }}
        />

        {/* Target Zones */}
        {targetZones.map((zone) => (
          <Button
            key={zone.id}
            onClick={() => handleZoneHit(zone)}
            disabled={!currentGame}
            sx={{
              position: "absolute",
              ...zone.position,
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: zone.color,
              color: "white",
              fontSize: "10px",
              fontWeight: "bold",
              "&:hover": {
                backgroundColor: zone.color,
                opacity: 0.8,
              },
              "&:disabled": {
                backgroundColor: "#ccc",
              },
            }}
          >
            {zone.name}
            <br />
            {zone.points}
          </Button>
        ))}

        {/* Miss area (clicking on background) */}
        <Box
          onClick={handleMiss}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: -1,
            cursor: currentGame ? "crosshair" : "default",
          }}
        />
      </Box>

      <Box textAlign="center" mt={4}>
        {!currentGame ? (
          <Button
            variant="contained"
            size="large"
            onClick={startNewGame}
            sx={{ backgroundColor: "#0066cc", fontSize: "1.2rem", px: 4 }}
          >
            Start New Game
          </Button>
        ) : (
          <Button
            variant="contained"
            color="secondary"
            onClick={endGame}
            sx={{ fontSize: "1.2rem", px: 4 }}
          >
            End Game
          </Button>
        )}
      </Box>

      {/* Game Over Dialog */}
      <Dialog open={showGameOver} onClose={() => setShowGameOver(false)}>
        <DialogContent sx={{ textAlign: "center", p: 4 }}>
          <Typography variant="h4" gutterBottom>
            🏆 Game Over! 🏆
          </Typography>
          <Typography variant="h6">
            Final Score: {currentGame?.total_score || 0}
          </Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            Accuracy:{" "}
            {gameStats.total > 0
              ? ((gameStats.hits / gameStats.total) * 100).toFixed(1)
              : 0}
            %
          </Typography>
          <Button
            variant="contained"
            onClick={() => setShowGameOver(false)}
            sx={{ mt: 3 }}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default PitchingGame;
