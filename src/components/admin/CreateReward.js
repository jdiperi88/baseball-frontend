import React, { useState, useEffect } from "react";
import { Modal, Box, Typography, TextField, Button } from "@mui/material";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

const CreateReward = ({
  open,
  handleClose,
  onRewardCreated,
  editingReward,
}) => {
  // Combine URL & DB
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    cost: "",
    image_path: "",
  });
  const [rev, setRev] = useState(null);

  useEffect(() => {
    if (editingReward) {
      setFormData({
        _id: editingReward._id,
        name: editingReward.name,
        cost: editingReward.cost,
        image_path: editingReward.image_path,
      });
      setRev(editingReward._rev);
    } else {
      setFormData({
        _id: "",
        name: "",
        cost: "",
        image_path: "",
      });
      setRev(null);
    }
  }, [editingReward]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let docId = formData._id;
      let docRev = rev;

      // If no _id, create a new one
      if (!docId) {
        docId = `reward:${uuidv4()}`;
      }

      const docToSave = {
        _id: docId,
        _rev: docRev,
        type: "reward",
        name: formData.name,
        cost: Number(formData.cost) || 0,
        image_path: formData.image_path,
      };

      // Put doc => slash
      await axios.put(`${COUCHDB_BASE}/${docId}`, docToSave);
      onRewardCreated(); // Refresh the rewards list
      handleClose(); // Close the modal
    } catch (error) {
      console.error("Error saving reward:", error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="reward-modal"
      aria-describedby="reward-modal-form"
    >
      <Box sx={style} component="form" onSubmit={handleSubmit}>
        <Typography variant="h6" component="h2">
          {editingReward ? "Edit Reward" : "Create a New Reward"}
        </Typography>
        <TextField
          margin="normal"
          required
          fullWidth
          label="Reward Name"
          name="name"
          autoFocus
          value={formData.name}
          onChange={handleChange}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          label="Cost"
          name="cost"
          type="number"
          value={formData.cost}
          onChange={handleChange}
        />
        <TextField
          margin="normal"
          fullWidth
          label="Image Path"
          name="image_path"
          value={formData.image_path}
          onChange={handleChange}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          {editingReward ? "Update Reward" : "Create Reward"}
        </Button>
        <Button
          onClick={handleClose}
          fullWidth
          variant="outlined"
          sx={{ mt: 1 }}
        >
          Cancel
        </Button>
      </Box>
    </Modal>
  );
};

export default CreateReward;
