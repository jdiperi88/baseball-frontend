import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Grid,
  Typography,
  Button,
  Modal,
  Box,
  ImageList,
  ImageListItem,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Confetti from "react-confetti";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { format } from "date-fns";

import RewardCard from "./RewardCard";
import celebrationSound from "../assets/sounds/success.mp3";
import loadImage from "../util";
import CoinsWalletWrapper from "./CoinsWalletWrapper";
import { useUser } from "../UserContext";

function Rewards() {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const [coins, setCoins] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [redeemedReward, setRedeemedReward] = useState(null);
  const [rewardRules, setRewardRules] = useState({});
  const [todayRedemptions, setTodayRedemptions] = useState({});
  const [completedTasks, setCompletedTasks] = useState([]);

  const audioRef = useRef(null);

  const { user } = useUser();
  const userId = user?.id || "";
  const userDocId = `user:${userId}`;

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        // 1) Fetch all reward docs
        const rewardsResp = await axios.post(`${COUCHDB_BASE}/_find`, {
          selector: { type: "reward" },
          limit: 1000, // Add a high limit to ensure all rewards are returned
        });
        setRewards(rewardsResp.data.docs);

        // 2) Fetch user doc for coins / wallet
        const userResp = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
        const userDoc = userResp.data;
        setCoins(Number(userDoc.coins || 0));
        setWalletAmount(Number(userDoc.wallet || 0));

        // Fetch reward rules for this specific user
        const rulesResp = await axios.post(`${COUCHDB_BASE}/_find`, {
          selector: {
            type: "reward_rule",
            user_id: userDocId, // Filter by current user
          },
          limit: 1000,
        });

        // Index rules by reward_id for easy lookup
        const rulesMap = {};
        rulesResp.data.docs.forEach((rule) => {
          if (!rulesMap[rule.reward_id]) rulesMap[rule.reward_id] = [];
          rulesMap[rule.reward_id].push(rule);
        });
        setRewardRules(rulesMap);

        // Fetch today's redemptions
        const today = format(new Date(), "yyyy-MM-dd");
        const redemptionsResp = await axios.post(`${COUCHDB_BASE}/_find`, {
          selector: {
            type: "reward_redemption",
            user_id: userDocId,
            redeemed_on: {
              $regex: `^${today}`,
            },
          },
          limit: 1000,
        });

        // Count redemptions by reward_id
        const redemptionsCount = {};
        redemptionsResp.data.docs.forEach((redemption) => {
          redemptionsCount[redemption.reward_id] =
            (redemptionsCount[redemption.reward_id] || 0) + 1;
        });
        setTodayRedemptions(redemptionsCount);

        // Fetch completed tasks for prerequisites - ADD USER FILTER HERE
        const tasksResp = await axios.post(`${COUCHDB_BASE}/_find`, {
          selector: {
            type: "task",
            user_id: userDocId, // Add this filter to only get current user's tasks
            task_status: "COMPLETED",
          },
          limit: 1000,
        });
        setCompletedTasks(tasksResp.data.docs);
      } catch (error) {
        console.error("Error details:", error.response?.data || error.message);
        // Consider showing user-friendly error messages
      }
    };

    fetchData();
  }, [userId, COUCHDB_BASE, userDocId]);

  const checkRewardRules = (reward) => {
    // If no rules for this reward, it's always redeemable
    if (!rewardRules[reward._id] || rewardRules[reward._id].length === 0) {
      return { canRedeem: true, rulesMet: [], rulesNotMet: [] };
    }

    const rulesMet = [];
    const rulesNotMet = [];
    let canRedeem = true;

    // Get today's date in YYYY-MM-DD format for filtering
    const today = format(new Date(), "yyyy-MM-dd");

    // Get today's day name (Monday, Tuesday, etc.)
    const todayName = new Date().toLocaleString("en-us", { weekday: "long" });

    // Filter completed tasks to only include those from today
    const todaysCompletedTasks = completedTasks.filter(
      (task) =>
        task.date_assigned === today ||
        (task.time_completed && task.time_completed.startsWith(today))
    );

    // Get template IDs for tasks completed TODAY
    const todaysCompletedTemplateIds = todaysCompletedTasks.map(
      (task) => task.task_template_id
    );

    // Check each rule
    rewardRules[reward._id].forEach((rule) => {
      if (!rule.active) return;

      // Get base settings
      const baseSettings = rule.base_settings || {};

      // Get day-specific settings if available
      const daySettings = rule.day_specific_settings?.[todayName];

      // Combine prerequisites uniquely
      const combinedPrereqsMap = {};
      (baseSettings.prerequisites || []).forEach((prereq) => {
        combinedPrereqsMap[prereq.task_template_id] = prereq;
      });
      (daySettings?.prerequisites || []).forEach((prereq) => {
        // Override base prerequisite with day-specific one
        combinedPrereqsMap[prereq.task_template_id] = prereq;
      });
      const combinedPrereqs = Object.values(combinedPrereqsMap);

      const todaySettings = {
        ...baseSettings,
        ...(daySettings?.max_daily_redemptions !== undefined && {
          max_daily_redemptions: daySettings.max_daily_redemptions,
        }),
        prerequisites: combinedPrereqs,
      };

      // Check max daily redemptions
      if (todaySettings.max_daily_redemptions) {
        const currentCount = todayRedemptions[reward._id] || 0;
        const limit = parseInt(todaySettings.max_daily_redemptions);
        if (currentCount < limit) {
          rulesMet.push(`${currentCount}/${limit} used today (${todayName})`);
        } else {
          rulesNotMet.push(`Daily limit reached (${limit}) for ${todayName}`);
          canRedeem = false;
        }
      }

      // Check prerequisites using TODAY's completed tasks only
      if (
        todaySettings.prerequisites &&
        todaySettings.prerequisites.length > 0
      ) {
        todaySettings.prerequisites.forEach((prereq) => {
          if (todaysCompletedTemplateIds.includes(prereq.task_template_id)) {
            rulesMet.push(`Complete: ${prereq.description}`);
          } else {
            rulesNotMet.push(`Pending: ${prereq.description}`);
            canRedeem = false;
          }
        });
      }
    });

    return { canRedeem, rulesMet, rulesNotMet };
  };

  const handleRedeem = async (reward) => {
    try {
      // 1) Load user doc
      const userResp = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      const userDoc = userResp.data;

      // 2) Ensure userDoc.wallet is always defined and is a number
      userDoc.wallet = Number(userDoc.wallet || 0);

      // 3) Check user has enough coins
      if (Number(userDoc.coins || 0) < reward.cost) {
        alert("Not enough coins to redeem this reward!");
        return;
      }

      // 4) Subtract cost from userDoc.coins - ensure it's a number
      userDoc.coins = Number(userDoc.coins || 0) - reward.cost;

      // 5) If the reward name includes "money", we add 1 to the wallet
      if (reward.name.toLowerCase().includes("money")) {
        userDoc.wallet = userDoc.wallet + 1; // wallet is now guaranteed to be a number
      }

      // 6) Create a redemption doc to track
      const redemptionId = `reward_redemption:${uuidv4()}`;
      const redemptionDoc = {
        _id: redemptionId,
        type: "reward_redemption",
        user_id: userDocId,
        reward_id: reward._id,
        redeemed_on: new Date().toISOString(),
      };

      // 7) Save updated user doc & redemption doc
      await axios.put(`${COUCHDB_BASE}/${userDocId}`, userDoc);
      await axios.put(`${COUCHDB_BASE}/${redemptionId}`, redemptionDoc);

      // 8) Update local state - ensure we're using the correct values
      setCoins(userDoc.coins);
      setWalletAmount(userDoc.wallet);
      setRedeemedReward(reward);

      // Update the redemption counter in realtime:
      setTodayRedemptions((prev) => ({
        ...prev,
        [reward._id]: (prev[reward._id] || 0) + 1,
      }));

      // 9) Show success / confetti
      setShowSuccessModal(true);
      audioRef.current?.play();
    } catch (error) {
      console.error("Error details:", error.response?.data || error.message);
      // Consider showing user-friendly error messages
    }
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Rewards Shop
      </Typography>
      <CoinsWalletWrapper coins={coins} walletAmount={walletAmount} />

      <Grid container spacing={3}>
        {rewards.map((reward) => {
          const ruleStatus = checkRewardRules(reward);

          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={reward._id}>
              <RewardCard
                reward={reward}
                coins={coins}
                onRedeem={() => handleRedeem(reward)}
                ruleStatus={ruleStatus}
              />
            </Grid>
          );
        })}
      </Grid>

      {/* Success Modal */}
      <Modal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        aria-labelledby="success-modal"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            p: 3,
            backgroundColor: "#FFD700",
            borderRadius: 2,
            textAlign: "center",
            boxShadow: "0 3px 10px rgba(0,0,0,0.2)",
          }}
        >
          <CheckCircleIcon style={{ fontSize: 75, color: "green" }} />
          {redeemedReward && (
            <ImageList
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                width: "100%",
                height: "100%",
              }}
            >
              <ImageListItem sx={{ border: 0 }}>
                <img
                  src={loadImage(redeemedReward.image_path)}
                  alt={redeemedReward.name}
                  loading="lazy"
                  style={{
                    width: "60%",
                    height: "60%",
                    objectFit: "cover",
                    border: "2px solid #333",
                    borderRadius: 10,
                  }}
                />
              </ImageListItem>
            </ImageList>
          )}
          <Typography variant="h6" gutterBottom>
            Reward redeemed successfully!
          </Typography>
          <Button onClick={() => setShowSuccessModal(false)} color="primary">
            Close
          </Button>
        </Box>
      </Modal>

      {/* Confetti */}
      {showSuccessModal && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          <Confetti width={window.innerWidth} height={window.innerHeight} />
        </div>
      )}

      <audio ref={audioRef} src={celebrationSound} />
    </Container>
  );
}

export default Rewards;
