import React, { useState, useEffect } from "react";
import {
  Container,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
} from "@mui/material";
import CreateReward from "./CreateReward";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
import AdminNav from "./AdminNav";
import RuleIcon from "@mui/icons-material/Rule";
import RewardRuleEditor from "./RewardRuleEditor";
import { v4 as uuidv4 } from "uuid";
import { useUser } from "../../UserContext";

const AdminRewards = () => {
  const { user } = useUser();
  const userId = user?.id || "";
  const userDocId = `user:${userId}`;

  // 1) Construct the CouchDB base URL properly
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  // e.g. "http://diperi.home/couchdb" + "/" + "local-task-tracker"
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const [rewards, setRewards] = useState([]);
  const [editingReward, setEditingReward] = useState(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [rewardRules, setRewardRules] = useState({});
  const [selectedReward, setSelectedReward] = useState(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    cost: 0,
    image_path: "",
  });
  // Add state for the document revision
  const [rev, setRev] = useState(null);

  useEffect(() => {
    fetchRewards();
    fetchRewardRules();
    // eslint-disable-next-line
  }, []);

  // 2) Use "/_find"
  const fetchRewards = async () => {
    try {
      const response = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "reward" },
        limit: 1000, // Add a high limit to ensure all rewards are returned
      });
      setRewards(response.data.docs);
    } catch (error) {
      console.error("Error fetching rewards:", error);
    }
  };

  const fetchRewardRules = async () => {
    try {
      const response = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "reward_rule",
          user_id: userDocId, // Filter by current user
        },
        limit: 1000,
      });

      // Group rules by reward_id
      const rulesMap = {};
      response.data.docs.forEach((rule) => {
        if (!rulesMap[rule.reward_id]) rulesMap[rule.reward_id] = [];
        rulesMap[rule.reward_id].push(rule);
      });

      setRewardRules(rulesMap);
    } catch (error) {
      console.error("Error fetching reward rules:", error);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingReward(null);
    setOpenCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setOpenCreateModal(false);
    setEditingReward(null);
  };

  const handleEditReward = (reward) => {
    setEditingReward(reward);
    setOpenCreateModal(true);
  };

  // 3) Use "/<docId>?rev=..."
  const handleDeleteReward = async (reward) => {
    try {
      // Ensure a slash before the doc ID
      await axios.delete(
        `${COUCHDB_BASE}/${encodeURIComponent(reward._id)}?rev=${reward._rev}`
      );
      fetchRewards();
    } catch (error) {
      console.error("Error deleting reward:", error);
    }
  };

  const handleOpenRuleDialog = (reward, rule = null) => {
    setSelectedReward(reward);
    setEditingRule(rule);
    setRuleDialogOpen(true);
  };

  const handleCloseRuleDialog = (refreshData) => {
    setRuleDialogOpen(false);
    if (refreshData) {
      fetchRewardRules();
    }
  };

  const handleDeleteRule = async (rule) => {
    try {
      await axios.delete(
        `${COUCHDB_BASE}/${encodeURIComponent(rule._id)}?rev=${rule._rev}`
      );
      fetchRewardRules();
    } catch (error) {
      console.error("Error deleting rule:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let docId = formData._id;

      // If no _id, create a new one
      if (!docId) {
        docId = `reward:${uuidv4()}`;
      }

      // Create the base document
      const docToSave = {
        _id: docId,
        type: "reward",
        name: formData.name,
        cost: Number(formData.cost) || 0,
        image_path: formData.image_path,
      };

      // Only add _rev if we're updating an existing document
      if (editingReward && editingReward._rev) {
        docToSave._rev = editingReward._rev;
      }

      await axios.put(`${COUCHDB_BASE}/${docId}`, docToSave);
      fetchRewards(); // Refresh the rewards list
      setOpenCreateModal(false); // Close the modal
    } catch (error) {
      console.error("Error saving reward:", error);
    }
  };

  // Add these functions
  const handleClose = () => {
    setOpenCreateModal(false);
    setEditingReward(null);
  };

  const onRewardCreated = () => {
    fetchRewards();
  };

  return (
    <Container>
      <h2>Admin Rewards</h2>
      <AdminNav />
      <Button
        variant="contained"
        color="primary"
        onClick={handleOpenCreateModal}
      >
        Add New Reward
      </Button>
      <List>
        {rewards.map((reward) => (
          <React.Fragment key={reward._id}>
            <ListItem>
              <ListItemText
                primary={reward.name}
                secondary={`Cost: ${reward.cost} coins`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="add rule"
                  onClick={() => handleOpenRuleDialog(reward)}
                  title="Add Rule"
                >
                  <RuleIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="edit"
                  onClick={() => handleEditReward(reward)}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDeleteReward(reward)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>

            {/* Display any rules for this reward */}
            {rewardRules[reward._id]?.map((rule) => (
              <ListItem key={rule._id} sx={{ pl: 4, bgcolor: "#f5f5f5" }}>
                <ListItemText
                  primary={rule.rule_name}
                  secondary={
                    <Box component="span">
                      <Box component="span" display="block">
                        Base settings:{" "}
                        {rule.base_settings?.max_daily_redemptions || "No"}{" "}
                        daily limit,
                        {rule.base_settings?.prerequisites?.length || 0}{" "}
                        prerequisites
                      </Box>

                      {Object.keys(rule.day_specific_settings || {}).length >
                        0 && (
                        <Box component="span" display="block" sx={{ mt: 0.5 }}>
                          Day-specific rules:{" "}
                          {Object.keys(rule.day_specific_settings).join(", ")}
                        </Box>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="edit rule"
                    onClick={() => handleOpenRuleDialog(reward, rule)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete rule"
                    onClick={() => handleDeleteRule(rule)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </React.Fragment>
        ))}
      </List>

      <CreateReward
        open={openCreateModal}
        handleClose={handleCloseCreateModal}
        onRewardCreated={fetchRewards}
        editingReward={editingReward}
      />

      <RewardRuleEditor
        open={ruleDialogOpen}
        handleClose={handleCloseRuleDialog}
        rewardId={selectedReward?._id}
        existingRule={editingRule}
      />
    </Container>
  );
};

export default AdminRewards;
