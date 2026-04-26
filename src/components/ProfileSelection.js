import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../UserContext";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  SportsBaseball as BaseballIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { getUsersDbBase } from "../config/couchdb";

const PROFILE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#db2777",
  "#7c3aed",
  "#dc2626",
];

const DEFAULT_USER_COLOR = "#4caf50";

const getShortId = (profile) => profile._id?.replace(/^user:/, "") || "";

const getPlayerInitial = (name) => {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
};

const buildUserId = (name) => {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "player";

  return `user:${slug}-${Date.now()}`;
};

const sortProfiles = (profiles) =>
  [...profiles].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    })
  );

const getProfileColor = (profile, index) => {
  const color = profile.color?.toLowerCase();

  if (!color || color === DEFAULT_USER_COLOR) {
    return PROFILE_COLORS[index % PROFILE_COLORS.length];
  }

  return profile.color;
};

const ProfileSelection = () => {
  const USERS_BASE = getUsersDbBase();

  const [profiles, setProfiles] = useState([]);
  const [isFetchingProfiles, setIsFetchingProfiles] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const { saveUser } = useUser();
  const navigate = useNavigate();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setIsFetchingProfiles(true);
    setLoadError("");

    try {
      const resp = await axios.post(`${USERS_BASE}/_find`, {
        selector: { type: "user" },
        limit: 1000,
      });
      setProfiles(sortProfiles(resp.data.docs || []));
    } catch (error) {
      console.error("Error fetching profiles:", error);
      setLoadError("Could not load players from the central user database.");
    } finally {
      setIsFetchingProfiles(false);
    }
  }, [USERS_BASE]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleSelectProfile = (profile) => {
    saveUser({
      ...profile,
      _id: profile._id,
      id: getShortId(profile),
    });
    navigate("/baseball");
  };

  const handleCreatePlayer = async () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) return;

    setIsSaving(true);
    setActionError("");

    try {
      const newPlayerId = buildUserId(trimmedName);
      const color = PROFILE_COLORS[profiles.length % PROFILE_COLORS.length];
      const newPlayer = {
        _id: newPlayerId,
        type: "user",
        name: trimmedName,
        color,
        createdAt: new Date().toISOString(),
        appData: {},
      };

      await axios.put(`${USERS_BASE}/${encodeURIComponent(newPlayerId)}`, newPlayer);
      await fetchProfiles();
      setCreateDialogOpen(false);
      setPlayerName("");
    } catch (error) {
      console.error("Error creating player:", error);
      setActionError("Could not create that player in the central user database.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (event, profile) => {
    event.stopPropagation();
    setActionError("");
    setSelectedProfile(profile);
    setPlayerName(profile.name || "");
    setEditDialogOpen(true);
  };

  const handleUpdatePlayer = async () => {
    const trimmedName = playerName.trim();
    if (!trimmedName || !selectedProfile) return;

    setIsSaving(true);
    setActionError("");

    try {
      const updatedPlayer = {
        ...selectedProfile,
        name: trimmedName,
        updatedAt: new Date().toISOString(),
      };

      await axios.put(
        `${USERS_BASE}/${encodeURIComponent(selectedProfile._id)}`,
        updatedPlayer
      );
      await fetchProfiles();
      setEditDialogOpen(false);
      setSelectedProfile(null);
      setPlayerName("");
    } catch (error) {
      console.error("Error updating player:", error);
      setActionError("Could not update that player.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (event, profile) => {
    event.stopPropagation();
    setActionError("");
    setSelectedProfile(profile);
    setDeleteDialogOpen(true);
  };

  const handleDeletePlayer = async () => {
    if (!selectedProfile) return;

    setIsSaving(true);
    setActionError("");

    try {
      await axios.delete(
        `${USERS_BASE}/${encodeURIComponent(selectedProfile._id)}?rev=${
          selectedProfile._rev
        }`
      );
      await fetchProfiles();
      setDeleteDialogOpen(false);
      setSelectedProfile(null);
    } catch (error) {
      console.error("Error deleting player:", error);
      setActionError("Could not delete that player.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialogs = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedProfile(null);
    setPlayerName("");
    setActionError("");
  };

  const handleNameKeyDown = (event, submit) => {
    if (event.key === "Enter") {
      submit();
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f6f8fb",
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 5 },
      }}
    >
      <Stack spacing={3} sx={{ maxWidth: 1040, mx: "auto" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: "#0f3d5e",
                  color: "#fff",
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                }}
              >
                <BaseballIcon />
              </Avatar>
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
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Choose a player
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={`${profiles.length} players`}
              sx={{ bgcolor: "#e8f1f7", color: "#0f3d5e", fontWeight: 700 }}
            />
            <Tooltip title="Refresh players">
              <span>
                <IconButton
                  aria-label="Refresh players"
                  onClick={fetchProfiles}
                  disabled={isFetchingProfiles}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {loadError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={fetchProfiles}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}

        {actionError && <Alert severity="error">{actionError}</Alert>}

        {isFetchingProfiles ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading players</Typography>
          </Stack>
        ) : (
          <>
            {profiles.length === 0 && !loadError && (
              <Alert severity="info">
                No players were found in the central user database.
              </Alert>
            )}

            <Grid container spacing={2}>
              {profiles.map((profile, index) => {
                const color = getProfileColor(profile, index);

                return (
                  <Grid item xs={12} sm={6} md={4} key={profile._id}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: "100%",
                        borderRadius: 2,
                        position: "relative",
                        overflow: "hidden",
                        borderColor: "rgba(15, 23, 42, 0.12)",
                        transition: "box-shadow 160ms ease, transform 160ms ease",
                        "&:hover": {
                          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleSelectProfile(profile)}
                        sx={{ height: "100%" }}
                      >
                        <CardContent sx={{ p: 2.5, pr: 9 }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar
                              sx={{
                                bgcolor: color,
                                color: "#fff",
                                width: 56,
                                height: 56,
                                fontWeight: 800,
                              }}
                            >
                              {getPlayerInitial(profile.name)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="h6"
                                sx={{
                                  fontWeight: 800,
                                  overflowWrap: "anywhere",
                                  lineHeight: 1.2,
                                }}
                              >
                                {profile.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ overflowWrap: "anywhere" }}
                              >
                                {profile._id}
                              </Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </CardActionArea>

                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ position: "absolute", top: 10, right: 10 }}
                      >
                        <Tooltip title="Edit player">
                          <IconButton
                            aria-label={`Edit ${profile.name}`}
                            size="small"
                            onClick={(event) => handleEditClick(event, profile)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete player">
                          <IconButton
                            aria-label={`Delete ${profile.name}`}
                            size="small"
                            color="error"
                            onClick={(event) => handleDeleteClick(event, profile)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Card>
                  </Grid>
                );
              })}

              <Grid item xs={12} sm={6} md={4}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    minHeight: 106,
                    borderRadius: 2,
                    borderStyle: "dashed",
                    borderColor: "#7a8da1",
                    bgcolor: "#fff",
                  }}
                >
                  <CardActionArea
                    onClick={() => {
                      setActionError("");
                      setCreateDialogOpen(true);
                    }}
                    sx={{ height: "100%" }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: "#eef4f8",
                            color: "#0f3d5e",
                            width: 56,
                            height: 56,
                          }}
                        >
                          <AddIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Add Player
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Create a central user
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </Stack>

      <Dialog
        open={createDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create Player</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Player name"
            fullWidth
            variant="outlined"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            onKeyDown={(event) => handleNameKeyDown(event, handleCreatePlayer)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialogs} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleCreatePlayer}
            variant="contained"
            disabled={!playerName.trim() || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <AddIcon />}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Player</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Player name"
            fullWidth
            variant="outlined"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            onKeyDown={(event) => handleNameKeyDown(event, handleUpdatePlayer)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialogs} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleUpdatePlayer}
            variant="contained"
            disabled={!playerName.trim() || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <EditIcon />}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <WarningIcon color="error" />
            <span>Delete Player?</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This removes the player from the central user database.
          </Alert>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            Delete <strong>{selectedProfile?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialogs} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleDeletePlayer}
            variant="contained"
            color="error"
            disabled={isSaving}
            startIcon={
              isSaving ? <CircularProgress color="inherit" size={16} /> : <DeleteIcon />
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfileSelection;
