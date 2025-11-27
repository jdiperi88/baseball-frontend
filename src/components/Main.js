import React, { useState, useEffect, useRef } from "react";
import { Container, Grid, Typography } from "@mui/material";
import TodoBlock from "./TodoBlock";
import Confetti from "react-confetti";
import celebrationSound from "../assets/sounds/victory.mp3";
import axios from "axios";
import { useUser } from "../UserContext";
import CoinsWalletWrapper from "./CoinsWalletWrapper";

function Main() {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const audioRef = useRef(null);
  const [todos, setTodos] = useState([]);
  const [coins, setCoins] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const { user } = useUser();

  const userId = user?.id || "";
  const userDocId = `user:${userId}`;

  useEffect(() => {
    if (userId) {
      fetchTodosAndCoins();
    }
    // eslint-disable-next-line
  }, [userId]);

  async function fetchTodosAndCoins() {
    try {
      // 1) Build a local date string in 'YYYY-MM-DD' format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const today = `${year}-${month}-${day}`;

      // 2) Load today's tasks
      const tasksResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "task",
          user_id: userDocId,
          date_assigned: today,
        },
        limit: 1000, // Add a high limit to ensure all tasks are returned
      });
      const tasks = tasksResp.data.docs || [];

      // 3) Load user doc for coins/wallet
      const userResp = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      setCoins(userResp.data.coins || 0);
      setWalletAmount(userResp.data.wallet || 0);

      // 4) Build a list of unique template IDs
      const templateIds = [...new Set(tasks.map((t) => t.task_template_id))];

      if (templateIds.length > 0) {
        // 5) _find all templates in one request
        const templateResp = await axios.post(`${COUCHDB_BASE}/_find`, {
          selector: {
            type: "task_template",
            _id: { $in: templateIds },
          },
          limit: 9999, // Ensure we get all results (no pagination shortfall)
        });
        const templateDocs = templateResp.data.docs || [];

        // Build a quick map for lookup
        const templateMap = {};
        templateDocs.forEach((tmpl) => {
          templateMap[tmpl._id] = tmpl;
        });

        // 6) "Enrich" each task with the template's name, coins, image_path, etc.
        const enrichedTasks = tasks.map((task) => {
          const tmpl = templateMap[task.task_template_id] || {};
          return {
            ...task,
            name: tmpl.name || "Unnamed Task",
            coins: tmpl.coins || 0, // store the template’s coin value
            image_path: tmpl.image_path || "",
          };
        });
        setTodos(enrichedTasks);
      } else {
        // No templates needed => just set the tasks as is
        setTodos(tasks);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  async function handleTaskCompletion(taskId) {
    try {
      // 1) Fetch the task doc by ID
      const taskResp = await axios.get(`${COUCHDB_BASE}/task:${taskId}`);
      const taskDoc = taskResp.data;
      if (taskDoc.task_status === "COMPLETED") return;

      // 2) Fetch the user doc
      const userResp = await axios.get(`${COUCHDB_BASE}/${userDocId}`);
      const userDoc = userResp.data;

      // 3) Also fetch the template doc to find how many coins to award
      const tmplId = taskDoc.task_template_id;
      const templateResp = await axios.get(`${COUCHDB_BASE}/${tmplId}`);
      const templateDoc = templateResp.data;
      const coinValue = templateDoc.coins || 0;

      // 4) Mark the task doc as completed
      taskDoc.task_status = "COMPLETED";
      taskDoc.time_completed = new Date().toISOString();

      // 5) Award coins based on the template's coin value
      userDoc.coins = (userDoc.coins || 0) + coinValue;

      // 6) PUT updated docs
      await axios.put(`${COUCHDB_BASE}/task:${taskId}`, taskDoc);
      await axios.put(`${COUCHDB_BASE}/${userDocId}`, userDoc);

      // 7) Reflect changes in UI
      setCoins(userDoc.coins);
      setTodos((prev) =>
        prev.map((t) =>
          t._id === `task:${taskId}` ? { ...t, task_status: "COMPLETED" } : t
        )
      );

      // 8) Play celebration, show confetti
      audioRef.current.play();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 10000);
    } catch (error) {
      console.error("Error completing task:", error);
    }
  }

  return (
    <Container>
      <audio ref={audioRef} src={celebrationSound} />
      {showConfetti && (
        <div className="fullscreen-confetti">
          <Confetti width={window.innerWidth} height={window.innerHeight} />
        </div>
      )}
      <Typography variant="h4" gutterBottom>
        Tasks
      </Typography>
      <CoinsWalletWrapper coins={coins} walletAmount={walletAmount} />

      <Grid container spacing={3}>
        {todos.map((todo) => (
          <TodoBlock
            key={todo._id}
            todo={todo}
            onComplete={() =>
              handleTaskCompletion(todo._id.replace("task:", ""))
            }
          />
        ))}
      </Grid>
    </Container>
  );
}

export default Main;
