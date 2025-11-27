// Nav.js
import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Box } from "@mui/material";
import { UserContext } from "../UserContext";

const Nav = () => {
  const navigate = useNavigate();
  const { saveUser } = useContext(UserContext);

  const handleSwitchUser = () => {
    localStorage.removeItem("selectedProfile");
    saveUser(null);
    navigate("/");
  };

  const navStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0066cc",
    padding: "10px",
    borderRadius: "10px",
    margin: "20px auto",
    maxWidth: "600px",
    flexWrap: "wrap",
    gap: "10px",
  };

  return (
    <Box style={navStyle}>
      <Link to="/baseball" style={{ textDecoration: "none" }}>
        <Button variant="contained" color="success" sx={{ fontWeight: "bold" }}>
          ⚾ Play Game
        </Button>
      </Link>

      <Link to="/baseball/stats" style={{ textDecoration: "none" }}>
        <Button variant="contained" color="info" sx={{ fontWeight: "bold" }}>
          📊 Statistics
        </Button>
      </Link>

      <Button
        onClick={handleSwitchUser}
        variant="contained"
        color="error"
        sx={{ fontWeight: "bold" }}
      >
        👤 Switch Player
      </Button>
    </Box>
  );
};

export default Nav;
