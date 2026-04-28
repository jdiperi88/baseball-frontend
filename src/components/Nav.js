// Nav.js
import React, { useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Paper, Stack } from "@mui/material";
import {
  Person as PersonIcon,
  QueryStats as QueryStatsIcon,
  SportsBaseball as BaseballIcon,
} from "@mui/icons-material";
import { UserContext } from "../UserContext";

const Nav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveUser } = useContext(UserContext);

  const handleSwitchUser = () => {
    localStorage.removeItem("selectedProfile");
    saveUser(null);
    navigate("/");
  };

  return (
    <Paper
      component="nav"
      elevation={3}
      sx={{
        width: "min(680px, calc(100% - 32px))",
        mx: "auto",
        my: 3,
        p: 1,
        borderRadius: 2,
        bgcolor: "rgba(255, 255, 255, 0.96)",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="center"
        alignItems="stretch"
      >
        <Link
          to="/baseball"
          style={{ textDecoration: "none", display: "flex" }}
        >
          <Button
            variant={
              location.pathname === "/baseball" ? "contained" : "outlined"
            }
            color="success"
            startIcon={<BaseballIcon />}
            sx={{ fontWeight: 800, width: { xs: "100%", sm: "auto" } }}
          >
            Play
          </Button>
        </Link>

        <Link
          to="/baseball/stats"
          style={{ textDecoration: "none", display: "flex" }}
        >
          <Button
            variant={
              location.pathname === "/baseball/stats" ? "contained" : "outlined"
            }
            color="info"
            startIcon={<QueryStatsIcon />}
            sx={{ fontWeight: 800, width: { xs: "100%", sm: "auto" } }}
          >
            Stats
          </Button>
        </Link>

        <Button
          onClick={handleSwitchUser}
          variant="outlined"
          color="error"
          startIcon={<PersonIcon />}
          sx={{ fontWeight: 800 }}
        >
          Switch Player
        </Button>
      </Stack>
    </Paper>
  );
};

export default Nav;
