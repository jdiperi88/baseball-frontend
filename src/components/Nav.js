// Nav.js
import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, TextField, Box } from "@mui/material";
// At the top of your Nav.js file
import { UserContext } from "../UserContext"; // Adjust the path as necessary

const Nav = () => {
  const navigate = useNavigate();
  const { saveUser } = useContext(UserContext); // Use the setUser function from your context to update the user state
  const [showChallenge, setShowChallenge] = useState(false);
  const [answer, setAnswer] = useState("");
  const [num1] = useState(Math.floor(Math.random() * 10));
  const [num2] = useState(Math.floor(Math.random() * 10));

  const handleAdminClick = (e) => {
    e.preventDefault();
    setShowChallenge(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parseInt(answer, 10) === num1 + num2) {
      setShowChallenge(false); // Hide the challenge after navigating
      navigate("/baseball/admin");
    } else {
      setShowChallenge(false); // Hide the challenge after getting the answer wrong
    }
  };

  const handleSwitchUser = () => {
    localStorage.removeItem("selectedProfile"); // Remove the profile from local storage
    saveUser(null); // Reset user state to null using saveUser
    navigate("/"); // Navigate to the root or a specific path to select a new profile
  };

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
      <Link to="/baseball" style={buttonStyle}>
        <Button variant="contained" color="primary">
          Main
        </Button>
      </Link>
      {showChallenge ? (
        <Box
          component="form"
          onSubmit={handleSubmit}
          style={{ display: "flex", alignItems: "center" }}
        >
          <span>{`${num1} + ${num2} = `}</span>
          <TextField
            type="number"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            variant="outlined"
            size="small"
            style={{ marginLeft: "10px", marginRight: "10px" }}
          />
          <Button type="submit" variant="contained" color="primary">
            Submit
          </Button>
        </Box>
      ) : (
        <Button
          onClick={handleAdminClick}
          variant="contained"
          color="primary"
          style={buttonStyle}
        >
          Admin
        </Button>
      )}
      <Link to="/baseball/rewards" style={buttonStyle}>
        <Button variant="contained" color="primary">
          Rewards
        </Button>
      </Link>
      <Link to="/baseball/okrs" style={buttonStyle}>
        <Button variant="contained" color="primary">
          OKRs
        </Button>
      </Link>
      <Link to="/baseball/strikes" style={buttonStyle}>
        <Button variant="contained" color="primary">
          3 Strikes
        </Button>
      </Link>
      <Button
        onClick={handleSwitchUser}
        variant="contained"
        color="secondary"
        style={buttonStyle}
      >
        Switch User
      </Button>
    </Box>
  );
};

export default Nav;
