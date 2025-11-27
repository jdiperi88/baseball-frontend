import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../UserContext";
import { Box, Grid, Typography, Paper } from "@mui/material";
import { blue, green, orange, pink, purple, red } from "@mui/material/colors";

const ProfileSelection = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL;
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB;
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`;

  const [profiles, setProfiles] = useState([]);
  const { saveUser } = useUser();
  const navigate = useNavigate();
  const colors = [blue, green, orange, pink, purple, red];

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const resp = await axios.post(`${COUCHDB_BASE}/_find`, {
          selector: { type: "user" },
        });
        setProfiles(resp.data.docs);
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
    };
    fetchProfiles();
  }, [COUCHDB_BASE]);

  const handleSelectProfile = (profile) => {
    saveUser({
      id: profile._id.replace("user:", ""),
      name: profile.name,
    });
    navigate("/baseball");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a2e",
        padding: 4,
      }}
    >
      <Typography
        variant="h2"
        sx={{
          color: "#FFD700",
          fontWeight: "bold",
          mb: 2,
          textAlign: "center",
        }}
      >
        ⚾ Pro Pitch Baseball ⚾
      </Typography>

      <Typography
        variant="h5"
        sx={{
          color: "#fff",
          mb: 4,
          textAlign: "center",
        }}
      >
        Select Your Player
      </Typography>

      <Grid
        container
        spacing={3}
        justifyContent="center"
        sx={{ maxWidth: 800 }}
      >
        {profiles.map((profile, index) => (
          <Grid item key={profile._id}>
            <Paper
              elevation={6}
              sx={{
                p: 3,
                cursor: "pointer",
                backgroundColor: colors[index % colors.length][500],
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-8px) scale(1.05)",
                  boxShadow: 12,
                },
                borderRadius: 3,
                minWidth: 150,
                textAlign: "center",
              }}
              onClick={() => handleSelectProfile(profile)}
            >
              <Typography variant="h3" sx={{ mb: 1 }}>
                ⚾
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  color: "white",
                  fontWeight: "bold",
                  textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {profile.name}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography
        variant="body1"
        sx={{
          color: "#888",
          mt: 4,
          textAlign: "center",
        }}
      >
        Use your pitching toy and track your hits!
      </Typography>
    </Box>
  );
};

export default ProfileSelection;
