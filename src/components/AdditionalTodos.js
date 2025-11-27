import React from "react";
import { Paper, Typography, Grid } from "@mui/material";
import { Droppable, Draggable } from "react-beautiful-dnd";

function AdditionalTodos() {
  const additionalTodos = [
    { id: "101", task: "Exercise" },
    { id: "102", task: "Read a book" },
    // ... more todos
  ];

  return (
    <Droppable droppableId="additionalTodos">
      {(provided) => (
        <Grid
          container
          spacing={3}
          {...provided.droppableProps}
          ref={provided.innerRef}
        >
          {additionalTodos.map((todo, index) => (
            <Draggable key={todo.id} draggableId={todo.id} index={index}>
              {(provided) => (
                <Grid
                  item
                  xs={12}
                  md={4}
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                >
                  <Paper elevation={3} style={{ padding: "16px" }}>
                    <Typography>{todo.task}</Typography>
                  </Paper>
                </Grid>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </Grid>
      )}
    </Droppable>
  );
}

export default AdditionalTodos;
