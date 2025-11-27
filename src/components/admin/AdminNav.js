// Nav.js
import React from "react";
import { Link } from "react-router-dom";
import { Button, Box } from "@mui/material";

const AdminNav = () => {
  const navStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const buttonStyle = {
    margin: "5px",
  };

  return (
    <Box style={navStyle}>
      <Link to="/baseball/admin/rewards" style={buttonStyle}>
        <Button variant="contained" color="primary">
          Rewards
        </Button>
      </Link>
      <Link to="/baseball/admin/tasks" style={buttonStyle}>
        <Button variant="contained" color="primary">
          Tasks
        </Button>
      </Link>
    </Box>
  );
};

export default AdminNav;
