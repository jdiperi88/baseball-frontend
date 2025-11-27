// KeyResultItem.js
import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  LinearProgress,
  Button,
  Box,
} from "@mui/material";
import { styled } from "@mui/system";
import InitiativeListItem from "./InitiativeListItem"; // or wherever it is
import { computeKRProgress, getProgressColor } from "./someUtils"; // your helpers

const KRCard = styled(Card)(() => ({
  backgroundColor: "#E1F5FE",
  marginBottom: "8px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
}));

function KeyResultItem({
  objectiveId,
  kr,
  templates,
  markKRDone,
  addInitiative,
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Example: computeKRProgress(kr) calls your API
    computeKRProgress(kr).then((prog) => {
      setProgress(prog);
    });
  }, [kr]);

  // Convert "pending" => "IN PROGRESS"
  const displayStatus = kr.status === "done" ? "DONE" : "IN PROGRESS";

  // Find the template name
  const template = templates.find((t) => t._id === kr.templateId);
  const templateName = template ? template.name : "(none)";

  const color = getProgressColor(progress, kr.thresholdPercent);

  return (
    <KRCard sx={{ p: 1, mb: 1 }}>
      <CardContent>
        <Typography variant="body1" sx={{ fontWeight: "bold" }}>
          {kr.title} ({kr.coins} coins) - {displayStatus}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Target: {kr.thresholdPercent}% <br />
          Template: {templateName} <br />
          Date Range: {kr.startDate} → {kr.endDate}
        </Typography>

        {/* Progress bar */}
        <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
          <Box sx={{ width: "100%", mr: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(progress, 100)}
              sx={{
                height: 12,
                borderRadius: 4,
                [`& .MuiLinearProgress-bar`]: {
                  backgroundColor: color,
                },
              }}
            />
          </Box>
          <Box sx={{ minWidth: 35 }}>
            <Typography variant="body2" color="text.secondary">
              {progress}%
            </Typography>
          </Box>
        </Box>

        {/* Initiatives */}
        <Typography variant="body2" sx={{ mt: 1 }}>
          Initiatives:
        </Typography>
        <Box sx={{ ml: 2 }}>
          {(kr.initiatives || []).map((init) => (
            <InitiativeListItem key={init.initId} initiative={init} />
          ))}
        </Box>
      </CardContent>
      <CardActions>
        {kr.status !== "done" && (
          <Button
            variant="outlined"
            onClick={() => markKRDone(objectiveId, kr.krId)}
          >
            Mark KR Done
          </Button>
        )}
        <Button
          variant="outlined"
          onClick={() => addInitiative(objectiveId, kr.krId)}
        >
          + Initiative
        </Button>
      </CardActions>
    </KRCard>
  );
}

export default KeyResultItem;
