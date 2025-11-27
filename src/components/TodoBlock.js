import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  CardMedia,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import loadImage from "../util";

function TodoBlock({ todo, onComplete }) {
  // We'll interpret "todo.name" as the template name,
  // "todo.image_path" as the template image,
  // and "todo.coins" as the template’s coins.

  // Also note: the "done" field was not in your daily task doc,
  // so we can rely on "task_status === 'COMPLETED'" instead.

  const isCompleted = todo.task_status === "COMPLETED";

  return (
    <Grid item xs={12} sm={6} md={4} lg={3} key={todo._id}>
      <Card
        style={{
          maxWidth: 500,
          marginBottom: "1rem",
          backgroundColor: isCompleted ? "lightgreen" : "white",
          margin: "0 auto",
          position: "relative",
        }}
      >
        {todo.image_path && (
          <CardMedia
            component="img"
            alt={todo.name}
            image={loadImage(todo.image_path)}
            style={{
              width: "100%",
              maxHeight: 281,
              objectFit: "cover",
            }}
          />
        )}
        <CardContent>
          {/* Display the template name */}
          <Typography variant="h5">{todo.name}</Typography>

          <Grid container alignItems="center" justifyContent="space-between">
            {/* If not completed, show Mark as Done button */}
            {!isCompleted && (
              <Grid item>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => onComplete(todo._id.replace("task:", ""))}
                >
                  Mark as Done
                </Button>
              </Grid>
            )}

            {/* Show coins in a "coin" circle */}
            <Grid item>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: "#FFD700", // gold color for the coin
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                }}
              >
                {todo.coins || 0}
              </div>
            </Grid>
          </Grid>
        </CardContent>

        {/* Overlay if completed */}
        {isCompleted && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(144,238,144,0.5)", // light green w/ 50% opacity
            }}
          >
            <CheckCircleIcon style={{ fontSize: "8rem", color: "green" }} />
          </div>
        )}
      </Card>
    </Grid>
  );
}

export default TodoBlock;
