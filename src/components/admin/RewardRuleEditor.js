// RewardRuleEditor.js
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Chip,
  Box,
  IconButton,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { useUser } from "../../UserContext"; // Add this import

const RewardRuleEditor = ({ open, handleClose, rewardId, existingRule }) => {
  const { user } = useUser(); // Add this to get the current user
  const userId = user?.id || "";
  const userDocId = `user:${userId}`;

  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL?.replace(/\/$/, "");
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const [ruleName, setRuleName] = useState("");
  const [templates, setTemplates] = useState([]);

  const [baseSettings, setBaseSettings] = useState({
    max_daily_redemptions: "",
    prerequisites: [],
  });
  const [daySpecificSettings, setDaySpecificSettings] = useState({});
  const [editingDay, setEditingDay] = useState(""); // Current day being edited

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  useEffect(() => {
    // Reset form when dialog opens
    if (open) {
      if (existingRule) {
        setRuleName(existingRule.rule_name || "");
        setBaseSettings(
          existingRule.base_settings || {
            max_daily_redemptions: "",
            prerequisites: [],
          }
        );
        setDaySpecificSettings(existingRule.day_specific_settings || {});
      } else {
        setRuleName("");
        setBaseSettings({
          max_daily_redemptions: "",
          prerequisites: [],
        });
        setDaySpecificSettings({});
      }
      setEditingDay(""); // Reset to base settings view

      // Define fetchTemplates inside useEffect
      const fetchTemplates = async () => {
        try {
          const response = await axios.post(`${COUCHDB_BASE}/_find`, {
            selector: { type: "task_template" },
            limit: 1000,
          });
          setTemplates(response.data.docs);
        } catch (error) {
          console.error("Error fetching templates:", error);
        }
      };

      // Call it
      fetchTemplates();
    }
  }, [open, existingRule, COUCHDB_BASE]); // Add COUCHDB_BASE to the dependencies

  // Handle day tab selection
  const handleDaySelect = (day) => {
    setEditingDay(day);
  };

  // Get current settings based on editing day
  const getCurrentSettings = () => {
    if (!editingDay) {
      return baseSettings;
    }

    // If we have day-specific settings, merge them with base settings
    if (daySpecificSettings[editingDay]) {
      // Start with base settings (to inherit prerequisites)
      const combinedSettings = {
        ...baseSettings,
        prerequisites: [...(baseSettings.prerequisites || [])],
      };

      // Apply day-specific settings on top (overriding as needed)
      const daySettings = daySpecificSettings[editingDay];

      // Override max_daily_redemptions if specified in day settings
      if (
        daySettings.max_daily_redemptions !== undefined &&
        daySettings.max_daily_redemptions !== ""
      ) {
        combinedSettings.max_daily_redemptions =
          daySettings.max_daily_redemptions;
      }

      // Combine prerequisites, giving precedence to day-specific ones
      // (removing duplicates based on task_template_id)
      const basePrereqIds = new Set(
        combinedSettings.prerequisites.map((p) => p.task_template_id)
      );

      // Add day-specific prerequisites that don't exist in base
      if (daySettings.prerequisites && daySettings.prerequisites.length > 0) {
        daySettings.prerequisites.forEach((prereq) => {
          if (
            !basePrereqIds.has(prereq.task_template_id) ||
            prereq.task_template_id === ""
          ) {
            combinedSettings.prerequisites.push(prereq);
          } else {
            // Replace the base prerequisite with the day-specific one
            const index = combinedSettings.prerequisites.findIndex(
              (p) => p.task_template_id === prereq.task_template_id
            );
            if (index !== -1) {
              combinedSettings.prerequisites[index] = prereq;
            }
          }
        });
      }

      // Mark which prerequisites come from base settings for UI display
      combinedSettings.prerequisites = combinedSettings.prerequisites.map(
        (prereq) => {
          const isFromBase = baseSettings.prerequisites.some(
            (p) => p.task_template_id === prereq.task_template_id
          );
          const isFromDay = daySettings.prerequisites?.some(
            (p) => p.task_template_id === prereq.task_template_id
          );

          return {
            ...prereq,
            fromBase: isFromBase && !isFromDay,
          };
        }
      );

      return combinedSettings;
    }

    // If no day-specific settings yet, return empty template
    return {
      max_daily_redemptions: "",
      prerequisites: [],
    };
  };

  // Update current settings
  const updateCurrentSettings = (newSettings) => {
    if (!editingDay) {
      setBaseSettings(newSettings);
    } else {
      // For day-specific settings, only store the differences from base
      const daySpecificOverrides = {
        max_daily_redemptions: newSettings.max_daily_redemptions,
        // Only include prerequisites that aren't in the base settings or have been modified
        prerequisites: newSettings.prerequisites
          .filter((prereq) => !prereq.fromBase)
          .map(({ fromBase, ...prereq }) => prereq), // Remove the fromBase property
      };

      setDaySpecificSettings({
        ...daySpecificSettings,
        [editingDay]: daySpecificOverrides,
      });
    }
  };

  // Add day-specific settings
  const addDaySpecificSettings = (day) => {
    setDaySpecificSettings({
      ...daySpecificSettings,
      [day]: { ...baseSettings },
    });
    setEditingDay(day);
  };

  // Remove day-specific settings
  const removeDaySpecificSettings = (day) => {
    const newSettings = { ...daySpecificSettings };
    delete newSettings[day];
    setDaySpecificSettings(newSettings);
    setEditingDay(""); // Return to base settings
  };

  const handleAddPrerequisite = () => {
    const newPrerequisites = [
      ...(getCurrentSettings().prerequisites || []),
      { temp_id: uuidv4(), task_template_id: "", description: "" },
    ];
    updateCurrentSettings({
      ...getCurrentSettings(),
      prerequisites: newPrerequisites,
    });
  };

  const handleRemovePrerequisite = (tempId) => {
    const newPrerequisites = getCurrentSettings().prerequisites.filter(
      (p) => p.temp_id !== tempId
    );
    updateCurrentSettings({
      ...getCurrentSettings(),
      prerequisites: newPrerequisites,
    });
  };

  const handlePrereqChange = (tempId, field, value) => {
    const newPrerequisites = getCurrentSettings().prerequisites.map((p) => {
      if (p.temp_id === tempId) {
        return { ...p, [field]: value };
      }
      return p;
    });
    updateCurrentSettings({
      ...getCurrentSettings(),
      prerequisites: newPrerequisites,
    });
  };

  const handleTemplateSelect = (tempId, templateId) => {
    const template = templates.find((t) => t._id === templateId);

    const newPrerequisites = getCurrentSettings().prerequisites.map((p) => {
      if (p.temp_id === tempId) {
        return {
          ...p,
          task_template_id: templateId,
          description: template ? template.name : "",
        };
      }
      return p;
    });
    updateCurrentSettings({
      ...getCurrentSettings(),
      prerequisites: newPrerequisites,
    });
  };

  // Handle save with new structure
  const handleSave = async () => {
    try {
      const ruleDoc = {
        _id: existingRule?._id || `reward_rule:${uuidv4()}`,
        _rev: existingRule?._rev,
        type: "reward_rule",
        user_id: userDocId, // Add this field to associate with current user
        reward_id: rewardId,
        rule_name: ruleName,
        base_settings: baseSettings,
        day_specific_settings: daySpecificSettings,
        active: true,
      };

      await axios.put(`${COUCHDB_BASE}/${ruleDoc._id}`, ruleDoc);
      handleClose(true);
    } catch (error) {
      console.error("Error saving rule:", error);
      alert("Error saving rule. Please try again.");
    }
  };

  // Current settings based on selected day
  const currentSettings = getCurrentSettings();

  return (
    <Dialog
      open={open}
      onClose={() => handleClose(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {existingRule ? "Edit Reward Rule" : "Create New Reward Rule"}
      </DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          label="Rule Name"
          fullWidth
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
        />

        {/* Day tabs */}
        <Box sx={{ display: "flex", flexWrap: "wrap", mt: 2, mb: 2 }}>
          <Chip
            label="Base Settings"
            color={!editingDay ? "primary" : "default"}
            onClick={() => handleDaySelect("")}
            sx={{ m: 0.5 }}
          />
          {days.map((day) => (
            <Chip
              key={day}
              label={day}
              color={editingDay === day ? "primary" : "default"}
              onClick={() => handleDaySelect(day)}
              onDelete={
                daySpecificSettings[day]
                  ? () => removeDaySpecificSettings(day)
                  : undefined
              }
              sx={{
                m: 0.5,
                bgcolor: daySpecificSettings[day] ? "#e3f2fd" : "default",
              }}
            />
          ))}
          {!editingDay && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const day = days.find((d) => !daySpecificSettings[d]);
                if (day) addDaySpecificSettings(day);
              }}
              sx={{ ml: 1, height: 32, mt: 0.5 }}
              disabled={Object.keys(daySpecificSettings).length === 7}
            >
              Add Day Rule
            </Button>
          )}
        </Box>

        {/* Settings for current day/base */}
        <Typography variant="subtitle1">
          {editingDay
            ? `${editingDay} Settings`
            : "Base Settings (Applied to all days without specific settings)"}
        </Typography>

        <TextField
          margin="dense"
          label="Max Daily Redemptions"
          type="number"
          fullWidth
          value={currentSettings.max_daily_redemptions}
          onChange={(e) =>
            updateCurrentSettings({
              ...currentSettings,
              max_daily_redemptions: e.target.value,
            })
          }
          helperText="Leave empty for unlimited"
        />

        <Typography variant="subtitle1" sx={{ mt: 2 }}>
          Prerequisites for {editingDay || "All Days"}:
        </Typography>

        {editingDay && (
          <Typography variant="caption" color="text.secondary">
            Prerequisites inherited from base settings will be combined with
            day-specific prerequisites
          </Typography>
        )}

        <Autocomplete
          multiple
          options={templates}
          getOptionLabel={(option) => option.name}
          value={templates.filter((t) =>
            (getCurrentSettings().prerequisites || []).some(
              (p) => p.task_template_id === t._id
            )
          )}
          onChange={(e, newValue) => {
            // Get the current settings
            const current = getCurrentSettings();

            // Determine which prerequisites are from base settings
            const basePrereqIds = new Set(
              baseSettings.prerequisites.map((p) => p.task_template_id)
            );

            // Create new prerequisites list from selected templates
            const updatedPrereqs = newValue.map((t) => {
              // Check if this was originally from base settings
              const isFromBase =
                basePrereqIds.has(t._id) &&
                (!editingDay ||
                  !daySpecificSettings[editingDay]?.prerequisites?.some(
                    (p) => p.task_template_id === t._id
                  ));

              // Find existing prerequisite for this template if it exists
              const existing = current.prerequisites.find(
                (p) => p.task_template_id === t._id
              );

              return {
                temp_id: existing?.temp_id || t._id,
                task_template_id: t._id,
                description: t.name,
                fromBase: isFromBase,
              };
            });

            updateCurrentSettings({
              ...current,
              prerequisites: updatedPrereqs,
            });
          }}
          renderOption={(props, option) => {
            // Check if this option is from base settings
            const isFromBase = baseSettings.prerequisites.some(
              (p) => p.task_template_id === option._id
            );

            return (
              <li {...props}>
                {option.name}
                {isFromBase && editingDay && (
                  <Chip
                    label="Base"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ ml: 1, height: 20 }}
                  />
                )}
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField {...params} label="Task Templates" variant="outlined" />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const tagProps = getTagProps({ index });
              // Check if this option is from base settings
              const isFromBase = baseSettings.prerequisites.some(
                (p) => p.task_template_id === option._id
              );

              return (
                <Chip
                  {...tagProps}
                  label={option.name}
                  variant={isFromBase && editingDay ? "outlined" : "default"}
                  color={isFromBase && editingDay ? "primary" : "default"}
                />
              );
            })
          }
        />

        {/* If we're on a day view and there are no day-specific settings yet */}
        {editingDay && !daySpecificSettings[editingDay] && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => addDaySpecificSettings(editingDay)}
            sx={{ mt: 2 }}
          >
            Create {editingDay} Specific Settings
          </Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose(false)}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save Rule
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RewardRuleEditor;
