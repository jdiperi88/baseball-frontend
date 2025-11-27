// RuleRequirements.js
import React from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

function RuleRequirements({ rulesMet, rulesNotMet }) {
  return (
    <Box sx={{ mt: 1, p: 1, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
      <Typography variant="subtitle2" fontWeight="bold">
        Requirements:
      </Typography>
      <List dense>
        {rulesMet.map((rule, idx) => (
          <ListItem key={`met-${idx}`} dense>
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CheckCircleIcon color="success" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={rule} />
          </ListItem>
        ))}
        {rulesNotMet.map((rule, idx) => (
          <ListItem key={`notmet-${idx}`} dense>
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CancelIcon color="error" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={rule} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default RuleRequirements;
