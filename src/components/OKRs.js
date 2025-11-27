import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  MenuItem,
  Select,
  LinearProgress,
  Grid,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import SentimentVerySatisfiedIcon from "@mui/icons-material/SentimentVerySatisfied";
import { styled } from "@mui/system";
import axios from "axios";
import { useUser } from "../UserContext";
import loadImage from "../util";

//
// COUCHDB CONFIG
//
const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

//
// STYLES
//
const RainbowBackground = styled(Box)(() => ({
  background: `
    linear-gradient(
      135deg,
      #f8bbd0 0%,
      #ffe0b2 20%,
      #fff9c4 40%,
      #c8e6c9 60%,
      #b2ebf2 80%,
      #d1c4e9 100%
    )
  `,
  minHeight: "100vh",
  padding: "2rem",
  fontFamily: "'Comic Sans MS', sans-serif",
}));

const ObjectiveAccordion = styled(Accordion)(() => ({
  backgroundColor: "rgba(255, 245, 238, 0.9)",
  borderRadius: "10px",
  marginBottom: "12px",
  boxShadow: "0 5px 10px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.1)",
}));

const KRAccordion = styled(Accordion)(() => ({
  backgroundColor: "rgba(240, 248, 255, 0.7)",
  marginBottom: "8px",
  boxShadow: "0 4px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.05)",
}));

const StripedLinearProgress = styled(LinearProgress)(() => ({
  height: 16,
  borderRadius: 8,
  backgroundColor: "rgba(255,255,255,0.3)",
  "& .MuiLinearProgress-bar": {
    backgroundSize: "20px 20px",
    backgroundImage: `
      repeating-linear-gradient(
        45deg,
        rgba(255,255,255,0.6),
        rgba(255,255,255,0.6) 10px,
        transparent 10px,
        transparent 20px
      )`,
  },
}));

//
// A coin circle for visual
//
function CoinCircle({ coins }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        backgroundColor: "#FFD700",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.3rem",
        fontWeight: "bold",
        marginLeft: 10,
      }}
    >
      {coins || 0}
    </div>
  );
}

//
// Helpers for color styling
//
function getProgressColor(progress, threshold) {
  if (progress >= threshold) return "green";
  if (progress >= threshold - 10) return "gold";
  return "red";
}
function getKRBackgroundColor(progress, threshold) {
  const color = getProgressColor(progress, threshold);
  if (color === "green") return "rgba(144,238,144,0.4)";
  if (color === "gold") return "rgba(255,255,0,0.3)";
  return "rgba(255,192,203,0.3)";
}

//
// MAIN COMPONENT
//
export default function OKRsKidFriendly() {
  const { user, saveUser } = useUser();
  const userId = user?.id;
  const userDocId = userId ? `user:${userId}` : null;

  // ============= State =============
  const [objectives, setObjectives] = useState([]);

  // For Objectives
  const [showObjDialog, setShowObjDialog] = useState(false);
  const [editingObjDocId, setEditingObjDocId] = useState(null);
  const [objTitle, setObjTitle] = useState("");
  const [objDesc, setObjDesc] = useState("");
  const [objCoins, setObjCoins] = useState("");
  const [objStatus, setObjStatus] = useState("in-progress");

  // For Key Results
  const [showKRDialog, setShowKRDialog] = useState(false);
  const [editingKRDocId, setEditingKRDocId] = useState(null);
  const [editingKRId, setEditingKRId] = useState(null);
  const [krTitle, setKrTitle] = useState("");
  const [krCoins, setKrCoins] = useState("");
  const [krThreshold, setKrThreshold] = useState("90");
  const [krTemplateId, setKrTemplateId] = useState("");
  const [krStartDate, setKrStartDate] = useState("");
  const [krEndDate, setKrEndDate] = useState("");
  const [krStatus, setKrStatus] = useState("pending");

  // KR progress map
  const [krProgressMap, setKrProgressMap] = useState({});

  // Templates
  const [templates, setTemplates] = useState([]);

  // ============= Effects =============
  useEffect(() => {
    if (userId) {
      fetchObjectives();
      fetchTemplates();
    }
    // eslint-disable-next-line
  }, [userId]);

  const computeKRProgress = useCallback(
    async (kr) => {
      if (!userDocId || !kr.templateId) return 0;
      try {
        const sel = {
          type: "task",
          user_id: userDocId,
          task_template_id: kr.templateId,
          date_assigned: { $gte: kr.startDate, $lte: kr.endDate },
        };
        const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
          selector: sel,
        });
        const tasks = resp.data.docs || [];
        if (!tasks.length) return 0;
        const completed = tasks.filter(
          (t) => t.task_status === "COMPLETED"
        ).length;

        // Convert ratio to percentage (0-100)
        return (completed / tasks.length) * 100;
      } catch (error) {
        console.error("Error computing KR progress:", error);
        return 0;
      }
    },
    [userDocId]
  );

  const updateAllKRProgress = useCallback(async () => {
    const map = {};
    for (const obj of objectives) {
      for (const kr of obj.keyResults || []) {
        const ratio = await computeKRProgress(kr);
        map[kr.krId] = ratio;
      }
    }
    setKrProgressMap(map);
  }, [objectives, computeKRProgress]);

  useEffect(() => {
    updateAllKRProgress();
  }, [objectives, updateAllKRProgress]);

  // ============= Fetching =============
  async function fetchObjectives() {
    if (!userDocId) return;
    try {
      const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "okrObjective", userId: userDocId },
      });
      setObjectives(resp.data.docs);
    } catch (error) {
      console.error("Error fetching objectives:", error);
    }
  }

  async function fetchTemplates() {
    try {
      const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "task_template", is_archived: { $ne: true } },
        limit: 9999,
        fields: ["_id", "name", "image_path"],
      });
      setTemplates(resp.data.docs);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  }

  // ============= Progress =============

  // ============= Objective CRUD =============
  function openObjDialogForCreate() {
    setEditingObjDocId(null);
    setObjTitle("");
    setObjDesc("");
    setObjCoins("");
    setObjStatus("in-progress");
    setShowObjDialog(true);
  }

  function openObjDialogForEdit(objDoc) {
    setEditingObjDocId(objDoc._id);
    setObjTitle(objDoc.title);
    setObjDesc(objDoc.description);
    setObjCoins(objDoc.coins?.toString() || "");
    setObjStatus(objDoc.status || "in-progress");
    setShowObjDialog(true);
  }

  function closeObjDialog() {
    setShowObjDialog(false);
  }

  async function handleSaveObj() {
    if (!objTitle) {
      alert("Enter a Goal Title!");
      return;
    }
    const coinsNum = Number(objCoins);
    if (isNaN(coinsNum) || coinsNum < 1) {
      alert("Objective coins must be ≥ 1");
      return;
    }

    try {
      if (!editingObjDocId) {
        // CREATE
        const newId = `okrObjective:${Date.now()}`;
        const newObj = {
          _id: newId,
          type: "okrObjective",
          userId: userDocId,
          title: objTitle,
          description: objDesc,
          coins: coinsNum,
          status: objStatus,
          keyResults: [],
        };
        if (objStatus === "done") {
          // If 0 KRs => automatically award
          if (newObj.keyResults.length === 0) {
            await addObjectiveCoinsIfNotAwarded(newObj);
          }
        }
        await axios.put(`${COUCHDB_BASE}/${newId}`, newObj);
      } else {
        // UPDATE
        const resp = await axios.get(`${COUCHDB_BASE}/${editingObjDocId}`);
        const doc = resp.data;
        const oldStatus = doc.status;

        doc.title = objTitle;
        doc.description = objDesc;
        doc.coins = coinsNum;
        doc.status = objStatus;

        // If user sets "done" => confirm all KRs are done & meet threshold
        if (objStatus === "done") {
          const allKRsDone = (doc.keyResults || []).every(
            (k) => k.status === "done"
          );
          if (!allKRsDone) {
            alert(
              "Cannot mark Objective done when some Key Results are not done. Reverting to in-progress."
            );
            doc.status = "in-progress";
          } else {
            // Check if all meet threshold
            let allMeet = true;
            for (const k of doc.keyResults) {
              const ratio = await computeKRProgress(k);
              if (ratio < (k.thresholdPercent || 0)) {
                allMeet = false;
                break;
              }
            }
            if (!allMeet) {
              alert(
                "Cannot mark Objective done because some Key Results are below threshold."
              );
              doc.status = "in-progress";
            }
          }
        }

        // If old=done & new=in-progress => remove objective coins
        if (oldStatus === "done" && doc.status !== "done") {
          await removeObjectiveCoinsIfAwarded(doc);
        }
        // If old!=done & new=done => award
        if (oldStatus !== "done" && doc.status === "done") {
          await addObjectiveCoinsIfNotAwarded(doc);
        }

        await axios.put(`${COUCHDB_BASE}/${editingObjDocId}`, doc);
      }
      closeObjDialog();
      fetchObjectives();
    } catch (err) {
      console.error("Error saving objective:", err);
    }
  }

  async function deleteObjective(objDoc) {
    if (!window.confirm(`Delete objective "${objDoc.title}"?`)) return;
    try {
      // if objective is done => remove coins
      if (objDoc.status === "done") {
        await removeObjectiveCoinsIfAwarded(objDoc);
      }
      await axios.delete(`${COUCHDB_BASE}/${objDoc._id}?rev=${objDoc._rev}`);
      fetchObjectives();
    } catch (err) {
      console.error("Error deleting objective doc:", err);
    }
  }

  // ============= Key Result CRUD =============
  function openKRDialogCreate(objDocId) {
    setEditingKRDocId(objDocId);
    setEditingKRId(null);
    setKrTitle("");
    setKrCoins("");
    setKrThreshold("90");
    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];
    today.setMonth(today.getMonth() + 4);
    const plus4ISO = today.toISOString().split("T")[0];
    setKrStartDate(todayISO);
    setKrEndDate(plus4ISO);
    setKrStatus("pending");
    setKrTemplateId("");
    setShowKRDialog(true);
  }

  function openKRDialogEdit(objDocId, kr) {
    setEditingKRDocId(objDocId);
    setEditingKRId(kr.krId);
    setKrTitle(kr.title);
    setKrCoins(kr.coins?.toString() || "");
    setKrThreshold(kr.thresholdPercent?.toString() || "90");
    setKrTemplateId(kr.templateId || "");
    setKrStartDate(kr.startDate);
    setKrEndDate(kr.endDate);
    setKrStatus(kr.status);
    setShowKRDialog(true);
  }

  function closeKRDialog() {
    setShowKRDialog(false);
  }

  async function handleSaveKR() {
    if (!krTitle) {
      alert("Enter a Key Result title!");
      return;
    }
    const coinsNum = Number(krCoins);
    if (isNaN(coinsNum) || coinsNum < 1) {
      alert("KR coins must be ≥ 1");
      return;
    }
    const thresholdNum = Number(krThreshold);
    if (isNaN(thresholdNum) || thresholdNum < 1 || thresholdNum > 100) {
      alert("Threshold must be 1..100");
      return;
    }
    if (!krTemplateId) {
      alert("Pick a Task Template for this KR!");
      return;
    }
    if (!krStartDate || !krEndDate || krStartDate > krEndDate) {
      alert("Invalid start/end date range for KR!");
      return;
    }

    try {
      const r = await axios.get(`${COUCHDB_BASE}/${editingKRDocId}`);
      const doc = r.data;
      doc.keyResults = doc.keyResults || [];

      let oldStatus = null;
      let oldCoins = 0;
      let oldThreshold = 0;

      let krIndex = -1;
      if (editingKRId) {
        krIndex = doc.keyResults.findIndex((k) => k.krId === editingKRId);
        if (krIndex >= 0) {
          oldStatus = doc.keyResults[krIndex].status;
          oldCoins = doc.keyResults[krIndex].coins || 0;
          oldThreshold = doc.keyResults[krIndex].thresholdPercent || 0;
        }
      }

      let newKRId = editingKRId;
      if (krIndex < 0) {
        newKRId = `kr-${Date.now()}`;
        doc.keyResults.push({
          krId: newKRId,
          title: krTitle,
          coins: coinsNum,
          thresholdPercent: thresholdNum,
          templateId: krTemplateId,
          startDate: krStartDate,
          endDate: krEndDate,
          status: krStatus,
        });
      } else {
        const existing = doc.keyResults[krIndex];
        existing.title = krTitle;
        existing.coins = coinsNum;
        existing.thresholdPercent = thresholdNum;
        existing.templateId = krTemplateId;
        existing.startDate = krStartDate;
        existing.endDate = krEndDate;
        existing.status = krStatus;
      }

      await axios.put(`${COUCHDB_BASE}/${editingKRDocId}`, doc);

      // re-load to get final
      const updatedResp = await axios.get(`${COUCHDB_BASE}/${editingKRDocId}`);
      const updatedDoc = updatedResp.data;
      const finalKR = updatedDoc.keyResults.find((k) => k.krId === newKRId);
      if (!finalKR) {
        closeKRDialog();
        fetchObjectives();
        return;
      }

      const finalStatus = finalKR.status;
      const finalCoins = finalKR.coins;
      const finalThreshold = finalKR.thresholdPercent;

      // compute progress for final KR
      const progress = await computeKRProgress(finalKR);
      const meetsThreshold = progress >= finalThreshold;

      // handle transitions
      // done => not-done => remove coins if threshold was met
      if (oldStatus === "done" && finalStatus !== "done") {
        if (progress >= oldThreshold) {
          await adjustUserCoins(-oldCoins);
        }
      }
      // not-done => done => add coins if threshold is met
      if (oldStatus !== "done" && finalStatus === "done") {
        if (meetsThreshold) {
          await adjustUserCoins(finalCoins);
        }
      }

      // if objective was "done" but we now have a KR => not done, revert objective
      await fixObjectiveIfContradiction(editingKRDocId);

      closeKRDialog();
      fetchObjectives();
    } catch (err) {
      console.error("Error saving KR:", err);
    }
  }

  async function fixObjectiveIfContradiction(objId) {
    // if objective doc => done but has a KR => not done or below threshold => revert
    try {
      const r = await axios.get(`${COUCHDB_BASE}/${objId}`);
      const doc = r.data;
      if (doc.status !== "done") return;

      // Check if *all* KRs are "done" and meet threshold
      const allKRsDone = (doc.keyResults || []).every(
        (k) => k.status === "done"
      );
      if (!allKRsDone) {
        // revert objective => remove coins
        await removeObjectiveCoinsIfAwarded(doc);
        doc.status = "in-progress";
        await axios.put(`${COUCHDB_BASE}/${objId}`, doc);
        return;
      }
      // else if all are done => check threshold
      let allMeet = true;
      for (const k of doc.keyResults) {
        const ratio = await computeKRProgress(k);
        if (ratio < (k.thresholdPercent || 0)) {
          allMeet = false;
          break;
        }
      }
      if (!allMeet) {
        // revert objective => remove coins
        await removeObjectiveCoinsIfAwarded(doc);
        doc.status = "in-progress";
        await axios.put(`${COUCHDB_BASE}/${objId}`, doc);
      }
    } catch (err) {
      console.error("Error in fixObjectiveIfContradiction:", err);
    }
  }

  async function deleteKeyResult(objectiveDocId, krId) {
    if (!window.confirm("Delete this Key Result?")) return;
    try {
      const r = await axios.get(`${COUCHDB_BASE}/${objectiveDocId}`);
      const doc = r.data;
      const idx = doc.keyResults.findIndex((k) => k.krId === krId);
      if (idx < 0) return;
      const kr = doc.keyResults[idx];
      // if was done => revert coins
      const progress = await computeKRProgress(kr);
      if (kr.status === "done" && progress >= (kr.thresholdPercent || 0)) {
        await adjustUserCoins(-kr.coins);
      }
      doc.keyResults.splice(idx, 1);
      await axios.put(`${COUCHDB_BASE}/${objectiveDocId}`, doc);

      // ensure objective is consistent
      await fixObjectiveIfContradiction(objectiveDocId);

      fetchObjectives();
    } catch (err) {
      console.error("Error deleting Key Result:", err);
    }
  }

  //
  // Award/Revert entire Objective coins
  //
  async function addObjectiveCoinsIfNotAwarded(objDoc) {
    const objCoins = objDoc.coins || 0;
    if (!userDocId || objCoins <= 0) return;
    try {
      const r = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      const userDoc = r.data;
      userDoc.coins = (userDoc.coins || 0) + objCoins;
      // Ensure wallet is explicitly preserved as a number
      userDoc.wallet = Number(userDoc.wallet || 0);
      await axios.put(`${COUCHDB_BASE}/${userDocId}`, userDoc);

      // Include wallet in the context update
      const updatedUser = {
        ...user,
        coins: userDoc.coins,
        wallet: userDoc.wallet,
      };
      saveUser(updatedUser);
      console.log(`Objective done => +${objCoins} coins.`);
    } catch (error) {
      console.error("Error awarding objective coins:", error);
    }
  }

  async function removeObjectiveCoinsIfAwarded(objDoc) {
    const objCoins = objDoc.coins || 0;
    if (!userDocId || objCoins <= 0) return;
    try {
      const r = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      const userDoc = r.data;
      userDoc.coins = (userDoc.coins || 0) - objCoins;
      if (userDoc.coins < 0) userDoc.coins = 0;
      // Ensure wallet is explicitly preserved as a number
      userDoc.wallet = Number(userDoc.wallet || 0);
      await axios.put(`${COUCHDB_BASE}/${userDocId}`, userDoc);

      // Include wallet in the context update
      const updatedUser = {
        ...user,
        coins: userDoc.coins,
        wallet: userDoc.wallet,
      };
      saveUser(updatedUser);
      console.log(`Objective undone => -${objCoins} coins.`);
    } catch (error) {
      console.error("Error removing objective coins:", error);
    }
  }

  async function adjustUserCoins(delta) {
    if (!userDocId || delta === 0) return;
    try {
      const r = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      const userDoc = r.data;
      userDoc.coins = (userDoc.coins || 0) + delta;
      if (userDoc.coins < 0) userDoc.coins = 0;
      // Ensure wallet is explicitly preserved as a number
      userDoc.wallet = Number(userDoc.wallet || 0);
      await axios.put(`${COUCHDB_BASE}/${userDocId}`, userDoc);

      // Include wallet in the context update
      const updatedUser = {
        ...user,
        coins: userDoc.coins,
        wallet: userDoc.wallet,
      };
      saveUser(updatedUser);
      console.log(`KR coin shift: ${delta}, new total: ${userDoc.coins}`);
    } catch (err) {
      console.error("Error adjusting user coins:", err);
    }
  }

  //
  // RENDER
  //
  return (
    <RainbowBackground>
      <Typography
        sx={{
          textAlign: "center",
          marginBottom: "1rem",
          fontSize: "2.5rem",
          fontFamily: "'Comic Sans MS', sans-serif",
          fontWeight: "bold",
          color: "#9c27b0",
          textShadow: "2px 2px 3px rgba(0,0,0,0.3)",
        }}
      >
        {user?.name}'s Friendly OKRs
      </Typography>

      <Button
        variant="contained"
        sx={{
          mb: 3,
          backgroundColor: "#ffca28",
          fontWeight: "bold",
          "&:hover": { backgroundColor: "#ffc107" },
        }}
        onClick={openObjDialogForCreate}
      >
        <ChildCareIcon sx={{ mr: 1 }} />
        New Goal
      </Button>

      <Grid container spacing={3}>
        {objectives.map((obj) => {
          const statusText = obj.status === "done" ? "DONE" : "IN PROGRESS";
          return (
            <Grid item xs={12} key={obj._id}>
              <ObjectiveAccordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box
                    sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}
                  >
                    <Typography
                      variant="h5"
                      sx={{
                        color: "#d32f2f",
                        fontWeight: "bold",
                        mr: 2,
                      }}
                    >
                      <SentimentVerySatisfiedIcon
                        sx={{ mr: 1, color: "#ffa726" }}
                      />
                      {obj.title} - {statusText}
                    </Typography>
                    <CoinCircle coins={obj.coins} />
                  </Box>

                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      openObjDialogForEdit(obj);
                    }}
                    sx={{ mr: 1 }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteObjective(obj);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ mb: 2, color: "#5d4037" }}>
                    {obj.description}
                  </Typography>

                  <Typography
                    variant="subtitle1"
                    sx={{ color: "#00796b", fontWeight: "bold" }}
                  >
                    Key Results:
                  </Typography>
                  {(!obj.keyResults || obj.keyResults.length === 0) && (
                    <Typography sx={{ fontStyle: "italic", mb: 2 }}>
                      No key results yet. Add one!
                    </Typography>
                  )}

                  <Grid container spacing={2}>
                    {(obj.keyResults || []).map((kr) => {
                      const progress = krProgressMap[kr.krId] || 0;
                      const color = getProgressColor(
                        progress,
                        kr.thresholdPercent || 0
                      );
                      const bgColor = getKRBackgroundColor(
                        progress,
                        kr.thresholdPercent || 0
                      );

                      let displayStatus = kr.status?.toUpperCase();
                      if (!displayStatus) displayStatus = "PENDING";

                      const tmpl = templates.find(
                        (t) => t._id === kr.templateId
                      );
                      const imageSrc = tmpl?.image_path
                        ? loadImage(tmpl.image_path)
                        : null;

                      return (
                        <Grid item xs={12} sm={6} md={4} key={kr.krId}>
                          <KRAccordion sx={{ backgroundColor: bgColor, mb: 1 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  flexGrow: 1,
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontWeight: "bold",
                                    color: "#006064",
                                    mr: 1,
                                  }}
                                >
                                  {kr.title} - {displayStatus}
                                </Typography>
                                <CoinCircle coins={kr.coins} />
                              </Box>

                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openKRDialogEdit(obj._id, kr);
                                }}
                                sx={{ ml: 1 }}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteKeyResult(obj._id, kr.krId);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </AccordionSummary>
                            <AccordionDetails>
                              {imageSrc && (
                                <Box sx={{ mb: 1, textAlign: "center" }}>
                                  <img
                                    src={imageSrc}
                                    alt={tmpl?.name || "Template"}
                                    style={{
                                      maxWidth: "70%",
                                      height: "auto",
                                      borderRadius: "8px",
                                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                    }}
                                  />
                                </Box>
                              )}

                              <Typography sx={{ mb: 1, color: "#5d4037" }}>
                                Threshold: {kr.thresholdPercent}% <br />
                                Start-End: {kr.startDate} → {kr.endDate}
                              </Typography>
                              <StripedLinearProgress
                                variant="determinate"
                                value={Math.min(Math.floor(progress), 100)}
                                sx={{
                                  "& .MuiLinearProgress-bar": {
                                    backgroundColor: color,
                                  },
                                }}
                              />
                              <Typography
                                sx={{
                                  mt: 1,
                                  fontWeight: "bold",
                                  color: "#4e342e",
                                }}
                              >
                                {Math.floor(progress)}%
                              </Typography>
                            </AccordionDetails>
                          </KRAccordion>
                        </Grid>
                      );
                    })}
                  </Grid>

                  {/* Only allow new KR if objective not done */}
                  {obj.status !== "done" && (
                    <Button
                      variant="contained"
                      sx={{
                        mt: 2,
                        backgroundColor: "#80cbc4",
                        fontWeight: "bold",
                      }}
                      onClick={() => openKRDialogCreate(obj._id)}
                    >
                      + Key Result
                    </Button>
                  )}
                </AccordionDetails>
              </ObjectiveAccordion>
            </Grid>
          );
        })}
      </Grid>

      {/* Objective Dialog */}
      <Dialog open={showObjDialog} onClose={closeObjDialog}>
        <DialogTitle>{editingObjDocId ? "Edit" : "New"} Goal</DialogTitle>
        <DialogContent>
          <TextField
            label="Goal Title"
            fullWidth
            margin="normal"
            value={objTitle}
            onChange={(e) => setObjTitle(e.target.value)}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            value={objDesc}
            onChange={(e) => setObjDesc(e.target.value)}
          />
          <TextField
            label="Coins (≥ 1)"
            type="number"
            fullWidth
            margin="normal"
            value={objCoins}
            onChange={(e) => setObjCoins(e.target.value)}
          />
          <Typography sx={{ mt: 2 }}>Status</Typography>
          <Select
            value={objStatus}
            onChange={(e) => setObjStatus(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <MenuItem value="in-progress">In Progress</MenuItem>
            <MenuItem value="done">Done</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeObjDialog}>Cancel</Button>
          <Button
            variant="contained"
            sx={{
              backgroundColor: "#4db6ac",
              fontWeight: "bold",
              "&:hover": { backgroundColor: "#26a69a" },
            }}
            onClick={handleSaveObj}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Key Result Dialog */}
      <Dialog open={showKRDialog} onClose={closeKRDialog}>
        <DialogTitle>
          {editingKRId ? "Edit Key Result" : "New Key Result"}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="KR Title"
            fullWidth
            margin="normal"
            value={krTitle}
            onChange={(e) => setKrTitle(e.target.value)}
          />
          <TextField
            label="Coins (≥ 1)"
            type="number"
            fullWidth
            margin="normal"
            value={krCoins}
            onChange={(e) => setKrCoins(e.target.value)}
          />
          <TextField
            label="Threshold % (1..100)"
            type="number"
            fullWidth
            margin="normal"
            value={krThreshold}
            onChange={(e) => setKrThreshold(e.target.value)}
          />
          <TextField
            label="Start Date"
            type="date"
            fullWidth
            margin="normal"
            value={krStartDate}
            onChange={(e) => setKrStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End Date"
            type="date"
            fullWidth
            margin="normal"
            value={krEndDate}
            onChange={(e) => setKrEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Typography sx={{ mt: 2 }}>Task Template (Required)</Typography>
          <Select
            value={krTemplateId}
            onChange={(e) => setKrTemplateId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            displayEmpty
          >
            <MenuItem value="">
              <em>-- Select Template --</em>
            </MenuItem>
            {templates.map((tmpl) => (
              <MenuItem key={tmpl._id} value={tmpl._id}>
                {tmpl.name}
              </MenuItem>
            ))}
          </Select>

          <Typography sx={{ mt: 2 }}>Status</Typography>
          <Select
            value={krStatus}
            onChange={(e) => setKrStatus(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in-progress">In Progress</MenuItem>
            <MenuItem value="done">Done</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeKRDialog}>Cancel</Button>
          <Button
            variant="contained"
            sx={{
              backgroundColor: "#80cbc4",
              fontWeight: "bold",
              "&:hover": { backgroundColor: "#4db6ac" },
            }}
            onClick={handleSaveKR}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </RainbowBackground>
  );
}
