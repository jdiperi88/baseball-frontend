import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Button,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Switch,
  FormControlLabel,
  IconButton,
  ListItemSecondaryAction,
  Checkbox,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import ArchiveIcon from "@mui/icons-material/Archive";
import { v4 as uuidv4 } from "uuid";
import AdminNav from "./AdminNav";
import { useUser } from "../../UserContext";

const TaskTemplatesAdmin = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  // Current logged-in user from context
  const { user } = useUser();
  const userId = user?.id || "";
  const userDocId = userId ? `user:${userId}` : "";

  // State for all "task_template" docs (global for all users).
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "",
    coins: "",
    image_path: "",
  });

  // State for schedules that belong *only* to the current user
  const [taskSchedules, setTaskSchedules] = useState([]);

  // For indicating which templates are "active" today (based on tasks for today)
  const [activeTodaySet, setActiveTodaySet] = useState(new Set());

  // Schedules dialog (multi-select of templates + day-of-week)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [bulkTemplateIds, setBulkTemplateIds] = useState([]); // chosen templates in multi-select
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([]);
  const dayOptions = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // ---------------------------------------
  // Fetch data on mount
  // ---------------------------------------
  useEffect(() => {
    fetchAllTemplates();
    fetchSchedulesForUser();
    fetchTodaysActiveTemplates();
    // eslint-disable-next-line
  }, []);

  // ---------------------------------------
  // 1) Fetch all "task_template" docs
  // ---------------------------------------
  const fetchAllTemplates = async () => {
    try {
      const response = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "task_template" },
        limit: 1000, // Add a high limit to ensure all templates are returned
      });
      setTaskTemplates(response.data.docs);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  // ---------------------------------------
  // 2) Fetch schedules for the current user
  // ---------------------------------------
  const fetchSchedulesForUser = async () => {
    if (!userDocId) return;
    try {
      const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: { type: "task_schedule" },
        limit: 9999,
      });
      const allSchedules = resp.data.docs || [];
      // Filter to only schedules that match userDocId
      const userSchedules = allSchedules.filter(
        (sch) => sch.user_id === userDocId
      );
      setTaskSchedules(userSchedules);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    }
  };

  // ---------------------------------------
  // 3) For "active today" – find any tasks assigned today
  // ---------------------------------------
  const fetchTodaysActiveTemplates = async () => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "task",
          date_assigned: todayStr,
        },
        fields: ["task_template_id"],
        limit: 9999,
      });
      const tasks = resp.data.docs || [];
      const ids = new Set(tasks.map((t) => t.task_template_id));
      setActiveTodaySet(ids);
    } catch (error) {
      console.error("Error fetching today's tasks:", error);
    }
  };

  // ---------------------------------------
  // Template CRUD
  // ---------------------------------------
  const openTemplateDialog = (template) => {
    setTemplateDialogOpen(true);
    if (template) {
      // Editing existing
      setEditTemplate(template);
      setTemplateForm({
        name: template.name,
        category: template.category,
        coins: template.coins,
        image_path: template.image_path,
      });
    } else {
      // Creating new
      setEditTemplate(null);
      setTemplateForm({
        name: "",
        category: "",
        coins: "",
        image_path: "",
      });
    }
  };

  const closeTemplateDialog = () => {
    setTemplateDialogOpen(false);
    setEditTemplate(null);
  };

  const saveTemplate = async () => {
    try {
      let docId, rev;
      if (editTemplate) {
        docId = editTemplate._id;
        rev = editTemplate._rev;
      } else {
        docId = `task_template:${uuidv4()}`;
      }

      const docToSave = {
        _id: docId,
        _rev: rev,
        type: "task_template",
        name: templateForm.name,
        category: templateForm.category,
        coins: Number(templateForm.coins) || 0,
        image_path: templateForm.image_path || "",
        is_archived: editTemplate ? editTemplate.is_archived : false,
      };
      await axios.put(`${COUCHDB_BASE}/${docId}`, docToSave);

      closeTemplateDialog();
      fetchAllTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
    }
  };

  const archiveTemplate = async (templateId) => {
    try {
      const resp = await axios.get(`${COUCHDB_BASE}/${templateId}`);
      const doc = resp.data;
      doc.is_archived = true;
      await axios.put(`${COUCHDB_BASE}/${templateId}`, doc);
      fetchAllTemplates();
    } catch (error) {
      console.error("Error archiving template:", error);
    }
  };

  // Utility: get template's name by ID
  function getTemplateName(templateId) {
    const tmpl = taskTemplates.find((t) => t._id === templateId);
    return tmpl ? tmpl.name : templateId;
  }

  // ---------------------------------------
  // Schedules for the current user
  // ---------------------------------------
  const deleteSchedule = async (sch) => {
    try {
      await axios.delete(`${COUCHDB_BASE}/${sch._id}?rev=${sch._rev}`);
      fetchSchedulesForUser();
      fetchTodaysActiveTemplates();
    } catch (error) {
      console.error("Error deleting schedule:", error);
    }
  };

  // Create or update a schedule doc for a user+template
  const createOrUpdateScheduleDoc = async (
    theUserDocId,
    templateId,
    daysOfWeek
  ) => {
    // 1) check if there's an existing doc
    const findResp = await axios.post(`${COUCHDB_BASE}/_find`, {
      selector: {
        type: "task_schedule",
        user_id: theUserDocId,
        task_template_id: templateId,
      },
      limit: 9999,
    });
    const existing = findResp.data.docs || [];
    let docId, rev;
    if (existing.length > 0) {
      docId = existing[0]._id;
      rev = existing[0]._rev;
    } else {
      docId = `task_schedule:${uuidv4()}`;
    }

    const docToSave = {
      _id: docId,
      _rev: rev,
      type: "task_schedule",
      user_id: theUserDocId,
      task_template_id: templateId,
      days_of_week: daysOfWeek.join(","),
    };

    await axios.put(`${COUCHDB_BASE}/${docId}`, docToSave);
    return docId;
  };

  // If the new schedule includes "today" -> create a task doc if none exist
  const createTaskIfToday = async (theUserDocId, templateId, daysOfWeek) => {
    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    if (daysOfWeek.includes(dayName)) {
      const dateStr = today.toISOString().split("T")[0];
      const findResp = await axios.post(`${COUCHDB_BASE}/_find`, {
        selector: {
          type: "task",
          user_id: theUserDocId,
          task_template_id: templateId,
          date_assigned: dateStr,
        },
        limit: 9999,
      });
      if (findResp.data.docs.length === 0) {
        const newTaskId = `task:${uuidv4()}`;
        await axios.put(`${COUCHDB_BASE}/${newTaskId}`, {
          _id: newTaskId,
          type: "task",
          user_id: theUserDocId,
          task_template_id: templateId,
          date_assigned: dateStr,
          task_status: "PENDING",
        });
      }
    }
  };

  // ---------------------------------------
  // Single Bulk Add/Update Schedules
  // ---------------------------------------
  const openScheduleDialog = () => {
    setBulkTemplateIds([]);
    setSelectedDaysOfWeek([]);
    setScheduleDialogOpen(true);
  };

  const closeScheduleDialog = () => {
    setScheduleDialogOpen(false);
  };

  const handleDayCheck = (day) => {
    setSelectedDaysOfWeek((prev) => {
      const hasDay = prev.includes(day);
      if (hasDay) {
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  const saveSchedules = async () => {
    try {
      if (!userDocId) {
        alert("No userDocId (please pick a user profile).");
        return;
      }
      if (bulkTemplateIds.length === 0) {
        alert("Pick at least one template for your schedule!");
        return;
      }
      if (selectedDaysOfWeek.length === 0) {
        alert("Pick at least one day of the week!");
        return;
      }

      // For each selected template => create/update schedule + create today's task if needed
      for (const tmplId of bulkTemplateIds) {
        await createOrUpdateScheduleDoc(userDocId, tmplId, selectedDaysOfWeek);
        await createTaskIfToday(userDocId, tmplId, selectedDaysOfWeek);
      }
      closeScheduleDialog();
      fetchSchedulesForUser();
      fetchTodaysActiveTemplates();
    } catch (error) {
      console.error("Error saving schedules:", error);
    }
  };

  // ---------------------------------------
  // Render
  // ---------------------------------------
  return (
    <Container>
      <AdminNav />

      {/* TEMPLATES SECTION */}
      <h2>All Task Templates (Global)</h2>
      <Button
        variant="contained"
        startIcon={<AddCircleOutlineIcon />}
        onClick={() => openTemplateDialog(null)}
      >
        Add New Template
      </Button>

      <List>
        {taskTemplates.map((tmpl) => (
          <ListItem key={tmpl._id}>
            <ListItemText
              primary={tmpl.name}
              secondary={`Category: ${tmpl.category}, coins: ${tmpl.coins}`}
            />
            <ListItemSecondaryAction>
              <IconButton onClick={() => openTemplateDialog(tmpl)}>
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => archiveTemplate(tmpl._id)}>
                <ArchiveIcon />
              </IconButton>

              {/* Active Today is read-only; just checks if a "task" doc for today exists */}
              <FormControlLabel
                control={
                  <Switch checked={activeTodaySet.has(tmpl._id)} disabled />
                }
                label="Active Today"
              />
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <hr style={{ margin: "2rem 0" }} />

      {/* SCHEDULES SECTION (for the current user) */}
      <h2>
        My Schedules for {user?.name} (docId: {userDocId})
      </h2>
      <p style={{ maxWidth: 600 }}>
        Below are the <b>task_schedule</b> docs for the logged-in user. Each
        schedule ties one template to certain days of the week. If "today" is
        included, a new "task" doc is auto-created (if none exists).
      </p>
      <Button
        variant="contained"
        startIcon={<AddCircleOutlineIcon />}
        onClick={openScheduleDialog}
      >
        Add/Update Schedules
      </Button>

      <List>
        {taskSchedules.map((sch) => (
          <ListItem key={sch._id}>
            <ListItemText
              primary={`Template: ${getTemplateName(sch.task_template_id)}`}
              secondary={`Days: ${sch.days_of_week}`}
            />
            <ListItemSecondaryAction>
              <IconButton onClick={() => deleteSchedule(sch)}>
                <ArchiveIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      {/* Template Dialog (Add/Edit) */}
      <Dialog open={templateDialogOpen} onClose={closeTemplateDialog}>
        <DialogTitle>
          {editTemplate ? "Edit Template" : "Add Template"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            margin="dense"
            value={templateForm.name}
            onChange={(e) =>
              setTemplateForm({ ...templateForm, name: e.target.value })
            }
          />
          <TextField
            label="Category"
            fullWidth
            margin="dense"
            value={templateForm.category}
            onChange={(e) =>
              setTemplateForm({ ...templateForm, category: e.target.value })
            }
          />
          <TextField
            label="Coins"
            type="number"
            fullWidth
            margin="dense"
            value={templateForm.coins}
            onChange={(e) =>
              setTemplateForm({ ...templateForm, coins: e.target.value })
            }
          />
          <TextField
            label="Image Path"
            fullWidth
            margin="dense"
            value={templateForm.image_path}
            onChange={(e) =>
              setTemplateForm({ ...templateForm, image_path: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTemplateDialog}>Cancel</Button>
          <Button onClick={saveTemplate}>
            {editTemplate ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedules Dialog (Add/Update) */}
      <Dialog open={scheduleDialogOpen} onClose={closeScheduleDialog}>
        <DialogTitle>Add/Update Schedules</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Select Template(s)</InputLabel>
            <Select
              multiple
              value={bulkTemplateIds}
              onChange={(e) => setBulkTemplateIds(e.target.value)}
              renderValue={(selected) => {
                // show comma-separated names
                return selected
                  .map((tmplId) => {
                    const tmpl = taskTemplates.find((t) => t._id === tmplId);
                    return tmpl ? tmpl.name : tmplId;
                  })
                  .join(", ");
              }}
            >
              {taskTemplates.map((tmpl) => (
                <MenuItem key={tmpl._id} value={tmpl._id}>
                  <Checkbox checked={bulkTemplateIds.includes(tmpl._id)} />
                  {tmpl.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <p>Days of Week:</p>
          {dayOptions.map((day) => (
            <FormControlLabel
              key={day}
              control={
                <Checkbox
                  checked={selectedDaysOfWeek.includes(day)}
                  onChange={() => handleDayCheck(day)}
                />
              }
              label={day}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedDaysOfWeek(dayOptions)}>
            Everyday
          </Button>
          <Button
            onClick={() =>
              setSelectedDaysOfWeek([
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
              ])
            }
          >
            Weekdays
          </Button>
          <Button onClick={() => setSelectedDaysOfWeek(["Saturday", "Sunday"])}>
            Weekends
          </Button>
          <Button onClick={closeScheduleDialog}>Cancel</Button>
          <Button onClick={saveSchedules}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TaskTemplatesAdmin;
