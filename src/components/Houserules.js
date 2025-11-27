import React, { useState, useEffect } from "react";
import { Box, Typography, Button, List, ListItem, Avatar } from "@mui/material";
import { styled } from "@mui/system";
import axios from "axios";
import { useUser } from "../UserContext";
import failSound from "../assets/sounds/fail.mp3";

import FavoriteIcon from "@mui/icons-material/Favorite";
import HearingIcon from "@mui/icons-material/Hearing";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import ShareIcon from "@mui/icons-material/Share";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import SoapIcon from "@mui/icons-material/Soap";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import BedtimeIcon from "@mui/icons-material/Bedtime";

const StyledListItem = styled(ListItem)(() => ({
  backgroundColor: "#f0f8ff",
  borderRadius: "10px",
  marginBottom: "10px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
}));

const RuleText = styled(Typography)(() => ({
  fontSize: "1.2rem",
  color: "#333",
}));

const StrikeBox = ({ strike }) => (
  <Box
    sx={{
      width: 80,
      height: 80,
      border: "2px solid black",
      borderRadius: "8px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "4rem",
      fontWeight: "bold",
      color: strike ? "red" : "transparent",
      backgroundColor: "#fff",
    }}
  >
    {strike && "X"}
  </Box>
);

const HouseRules = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const rules = [
    {
      text: "Be kind to others.",
      icon: <FavoriteIcon style={{ color: "#e57373" }} />,
    },
    {
      text: "Listen to your parents and teachers.",
      icon: <HearingIcon style={{ color: "#64b5f6" }} />,
    },
    {
      text: 'Say "please" and "thank you."',
      icon: <EmojiEmotionsIcon style={{ color: "#ffd54f" }} />,
    },
    {
      text: "Share your toys with others.",
      icon: <ShareIcon style={{ color: "#81c784" }} />,
    },
    {
      text: "Always tell the truth.",
      icon: <VerifiedUserIcon style={{ color: "#4db6ac" }} />,
    },
    {
      text: "Clean up after playing.",
      icon: <CleaningServicesIcon style={{ color: "#ba68c8" }} />,
    },
    {
      text: "Wash your hands before meals.",
      icon: <SoapIcon style={{ color: "#9575cd" }} />,
    },
    {
      text: "Use polite words; no bad language.",
      icon: <ThumbUpIcon style={{ color: "#7986cb" }} />,
    },
    {
      text: "Respect others' personal space.",
      icon: <EmojiPeopleIcon style={{ color: "#ff8a65" }} />,
    },
    {
      text: "Follow bedtime routines.",
      icon: <BedtimeIcon style={{ color: "#a1887f" }} />,
    },
  ];

  const { user } = useUser();
  const userId = user.id;
  const docId = `user:${userId}`;

  const [brokenRules, setBrokenRules] = useState([]);
  const [strikes, setStrikes] = useState(0);
  const [coins, setcoins] = useState(0);
  const [docRev, setDocRev] = useState(null);

  const audio = new Audio(failSound);

  useEffect(() => {
    if (userId) {
      fetchUserDoc();
    }
    // eslint-disable-next-line
  }, [userId]);

  const fetchUserDoc = async () => {
    try {
      // GET => slash
      const response = await axios.get(`${COUCHDB_BASE}/${docId}`);
      const data = response.data;
      setBrokenRules(data.brokenRules || []);
      setStrikes(data.strikes || 0);
      setcoins(data.coins || 0);
      setDocRev(data._rev);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        createUserDoc();
      } else {
        console.error("Error fetching user doc from CouchDB:", error);
      }
    }
  };

  const createUserDoc = async () => {
    try {
      const newDoc = {
        _id: docId,
        type: "user",
        name: user?.name || "Unnamed",
        coins: 0,
        brokenRules: [],
        strikes: 0,
        wallet: 0, // Initialize wallet to 0
      };
      const putRes = await axios.put(`${COUCHDB_BASE}/${docId}`, newDoc);
      setDocRev(putRes.data.rev);
      setBrokenRules([]);
      setStrikes(0);
      setcoins(0);
    } catch (error) {
      console.error("Error creating user doc in CouchDB:", error);
    }
  };

  const saveUserDoc = async (
    updatedBrokenRules,
    updatedStrikes,
    updatedcoins
  ) => {
    try {
      // First, get the full user document to preserve all fields
      const userResponse = await axios.get(`${COUCHDB_BASE}/${docId}`);
      const existingUserDoc = userResponse.data;

      const docToSave = {
        ...existingUserDoc, // Preserve all existing fields
        _id: docId,
        _rev: docRev,
        type: "user",
        name: user?.name || "Unnamed",
        coins: updatedcoins,
        brokenRules: updatedBrokenRules,
        strikes: updatedStrikes,
        wallet: Number(existingUserDoc.wallet || 0), // Ensure wallet is preserved
      };
      const response = await axios.put(`${COUCHDB_BASE}/${docId}`, docToSave);
      setDocRev(response.data.rev);
      setBrokenRules(updatedBrokenRules);
      setStrikes(updatedStrikes);
      setcoins(updatedcoins);
    } catch (error) {
      console.error("Error saving user doc to CouchDB:", error);
    }
  };

  const handleRuleBroken = (ruleIndex) => {
    const updatedBrokenRules = [...brokenRules, ruleIndex];
    const updatedStrikes = strikes + 1;
    if (updatedStrikes <= 3) {
      audio.play();
    }

    let updatedcoins = coins;
    if (updatedStrikes === 3 && updatedcoins > 0) {
      updatedcoins -= 1;
      if (updatedcoins < 0) {
        updatedcoins = 0;
      }
    }

    saveUserDoc(updatedBrokenRules, updatedStrikes, updatedcoins);
  };

  const handleResetRules = () => {
    saveUserDoc([], 0, coins);
  };

  return (
    <Box
      sx={{
        padding: 2,
        backgroundColor: "#e0f7fa",
        minHeight: "100vh",
        backgroundImage: "url('/assets/backgrounds/kids-bg.png')",
        backgroundSize: "cover",
      }}
    >
      <Typography
        variant="h3"
        sx={{
          textAlign: "center",
          color: "#00796b",
          fontFamily: "Comic Sans MS",
        }}
      >
        🏠 House Rules 🏠
      </Typography>
      <Typography
        variant="h5"
        sx={{ textAlign: "center", color: "#004d40", mb: 2 }}
      >
        ⭐ coins: {coins} ⭐
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2 }}>
        {[...Array(3)].map((_, i) => (
          <StrikeBox key={i} strike={i < strikes} />
        ))}
      </Box>

      {brokenRules.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            sx={{ textAlign: "center", color: "#d32f2f" }}
          >
            Broken Rules:
          </Typography>
          <List>
            {brokenRules.map((ruleIndex, i) => {
              const rule = rules[ruleIndex];
              return (
                <ListItem key={i} sx={{ justifyContent: "center" }}>
                  <Avatar sx={{ bgcolor: "#fff", mr: 1 }}>{rule.icon}</Avatar>
                  <Typography>{rule.text}</Typography>
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}

      <List>
        {rules.map((rule, index) => (
          <StyledListItem key={index}>
            <Avatar sx={{ bgcolor: "#fff", mr: 2 }}>{rule.icon}</Avatar>
            <RuleText>{rule.text}</RuleText>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleRuleBroken(index)}
              disabled={strikes >= 3}
              sx={{ ml: "auto", backgroundColor: "#4caf50" }}
            >
              Mark as Broken
            </Button>
          </StyledListItem>
        ))}
      </List>

      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Button
          variant="contained"
          color="error"
          onClick={handleResetRules}
          sx={{ px: 3, py: 1, fontSize: "1rem", backgroundColor: "#f44336" }}
        >
          Reset Rules
        </Button>
      </Box>
    </Box>
  );
};

export default HouseRules;
