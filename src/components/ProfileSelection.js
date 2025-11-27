import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../UserContext";
import {
  Box,
  Grid,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { blue, green, orange, pink, purple, red } from "@mui/material/colors";

const ProfileSelection = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL;
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const [profiles, setProfiles] = useState([]);
  const { saveUser } = useUser();
  const navigate = useNavigate();
  const colors = [blue, green, orange, pink, purple, red];

  // Modal states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfiles = useCallback(async () => {
    try {
      const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "user" },
      });
      setProfiles(resp.data.docs);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  }, [COUCHDB_BASE]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleSelectProfile = (profile) => {
    saveUser({
      id: profile._id.replace("user:", ""),
      name: profile.name,
    });
    navigate("/baseball");
  };

  // Create new player
  const handleCreatePlayer = async () => {
    if (!playerName.trim()) return;

    setIsLoading(true);
    try {
      const newPlayerId = `user:${playerName
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}`;
      const newPlayer = {
        _id: newPlayerId,
        type: "user",
        name: playerName.trim(),
        createdAt: new Date().toISOString(),
      };

      await axios.put(`${COUCHDB_BASE}/${newPlayerId}`, newPlayer);
      await fetchProfiles();
      setCreateDialogOpen(false);
      setPlayerName("");
    } catch (error) {
      console.error("Error creating player:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Edit player
  const handleEditClick = (e, profile) => {
    e.stopPropagation();
    setSelectedProfile(profile);
    setPlayerName(profile.name);
    setEditDialogOpen(true);
  };

  const handleUpdatePlayer = async () => {
    if (!playerName.trim() || !selectedProfile) return;

    setIsLoading(true);
    try {
      const updatedPlayer = {
        ...selectedProfile,
        name: playerName.trim(),
        updatedAt: new Date().toISOString(),
      };

      await axios.put(`${COUCHDB_BASE}/${selectedProfile._id}`, updatedPlayer);
      await fetchProfiles();
      setEditDialogOpen(false);
      setSelectedProfile(null);
      setPlayerName("");
    } catch (error) {
      console.error("Error updating player:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete player
  const handleDeleteClick = (e, profile) => {
    e.stopPropagation();
    setSelectedProfile(profile);
    setDeleteDialogOpen(true);
  };

  const handleDeletePlayer = async () => {
    if (!selectedProfile) return;

    setIsLoading(true);
    try {
      await axios.delete(
        `${COUCHDB_BASE}/${selectedProfile._id}?rev=${selectedProfile._rev}`
      );
      await fetchProfiles();
      setDeleteDialogOpen(false);
      setSelectedProfile(null);
    } catch (error) {
      console.error("Error deleting player:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseDialogs = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedProfile(null);
    setPlayerName("");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a2e",
        padding: 4,
      }}
    >
      <Typography
        variant="h2"
        sx={{
          color: "#FFD700",
          fontWeight: "bold",
          mb: 2,
          textAlign: "center",
        }}
      >
        ⚾ Pro Pitch Baseball ⚾
      </Typography>

      <Typography
        variant="h5"
        sx={{
          color: "#fff",
          mb: 4,
          textAlign: "center",
        }}
      >
        Select Your Player
      </Typography>

      <Grid
        container
        spacing={3}
        justifyContent="center"
        sx={{ maxWidth: 900 }}
      >
        {profiles.map((profile, index) => (
          <Grid item key={profile._id}>
            <Paper
              elevation={6}
              sx={{
                p: 3,
                cursor: "pointer",
                backgroundColor: colors[index % colors.length][500],
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-8px) scale(1.05)",
                  boxShadow: 12,
                },
                borderRadius: 3,
                minWidth: 150,
                textAlign: "center",
                position: "relative",
              }}
              onClick={() => handleSelectProfile(profile)}
            >
              {/* Edit/Delete buttons */}
              <Box
                sx={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  display: "flex",
                  gap: 0.5,
                }}
              >
                <Tooltip title="Edit Player">
                  <IconButton
                    size="small"
                    onClick={(e) => handleEditClick(e, profile)}
                    sx={{
                      backgroundColor: "rgba(255,255,255,0.3)",
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.5)" },
                    }}
                  >
                    <EditIcon fontSize="small" sx={{ color: "white" }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Player">
                  <IconButton
                    size="small"
                    onClick={(e) => handleDeleteClick(e, profile)}
                    sx={{
                      backgroundColor: "rgba(255,255,255,0.3)",
                      "&:hover": { backgroundColor: "rgba(255,0,0,0.5)" },
                    }}
                  >
                    <DeleteIcon fontSize="small" sx={{ color: "white" }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Typography variant="h3" sx={{ mb: 1, mt: 2 }}>
                ⚾
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  color: "white",
                  fontWeight: "bold",
                  textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {profile.name}
              </Typography>
            </Paper>
          </Grid>
        ))}

        {/* Add New Player Card */}
        <Grid item>
          <Paper
            elevation={6}
            sx={{
              p: 3,
              cursor: "pointer",
              backgroundColor: "#333",
              border: "3px dashed #666",
              transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
              "&:hover": {
                transform: "translateY(-8px) scale(1.05)",
                boxShadow: 12,
                borderColor: "#FFD700",
              },
              borderRadius: 3,
              minWidth: 150,
              minHeight: 140,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setCreateDialogOpen(true)}
          >
            <AddIcon sx={{ fontSize: 50, color: "#666", mb: 1 }} />
            <Typography
              variant="h6"
              sx={{
                color: "#888",
                fontWeight: "bold",
              }}
            >
              Add Player
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography
        variant="body1"
        sx={{
          color: "#888",
          mt: 4,
          textAlign: "center",
        }}
      >
        Use your pitching toy and track your hits!
      </Typography>

      {/* Create Player Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: "center" }}>
          <AddIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Create New Player
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Player Name"
            fullWidth
            variant="outlined"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleCreatePlayer()}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialogs} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleCreatePlayer}
            variant="contained"
            color="primary"
            disabled={!playerName.trim() || isLoading}
          >
            {isLoading ? "Creating..." : "Create Player"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Player Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: "center" }}>
          <EditIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Edit Player
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Player Name"
            fullWidth
            variant="outlined"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleUpdatePlayer()}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialogs} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleUpdatePlayer}
            variant="contained"
            color="primary"
            disabled={!playerName.trim() || isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          sx={{
            textAlign: "center",
            backgroundColor: "#ffebee",
            color: "#c62828",
          }}
        >
          <WarningIcon sx={{ mr: 1, verticalAlign: "middle", fontSize: 30 }} />
          Delete Player?
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" gutterBottom>
              Are you sure you want to delete
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: "bold", color: "#c62828", my: 2 }}
            >
              "{selectedProfile?.name}"?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ⚠️ This action cannot be undone!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              All game statistics and records for this player will be
              permanently lost.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: "center" }}>
          <Button
            onClick={handleCloseDialogs}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeletePlayer}
            variant="contained"
            color="error"
            disabled={isLoading}
            sx={{ minWidth: 100 }}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfileSelection;
