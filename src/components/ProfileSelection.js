import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../UserContext";
import { Box, Button, Grid, Typography } from "@mui/material";
import { blue, green, orange, pink, purple, red } from "@mui/material/colors";

const ProfileSelection = () => {
  const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL; // e.g. "http://diperi.home/couchdb"
  const COUCHDB_DB = process.env.REACT_APP_COUCHDB_DB; // e.g. "local-task-tracker"
  const COUCHDB_BASE = `${COUCHDB_URL}/${COUCHDB_DB}`; // "http://diperi.home/couchdb/local-task-tracker"

  const [profiles, setProfiles] = useState([]);
  const { saveUser } = useUser();
  const navigate = useNavigate();
  const colors = [blue, green, orange, pink, purple, red];

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        // Now we properly do /_find on COUCHDB_BASE
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
    // Save user doc in context, then navigate
    saveUser({
      id: profile._id.replace("user:", ""),
      name: profile.name,
      coins: profile.coins,
      wallet: profile.wallet,
    });
    navigate("/baseball");
  };

  return (
    <Box sx={{ flexGrow: 1, marginTop: 4 }}>
      <Typography variant="h4" gutterBottom>
        Select a Profile
      </Typography>
      <Grid container spacing={2} justifyContent="center">
        {profiles.map((profile, index) => (
          <Grid item key={profile._id}>
            <Button
              variant="contained"
              size="large"
              onClick={() => handleSelectProfile(profile)}
              style={{ backgroundColor: colors[index % colors.length][500] }}
            >
              {profile.name}
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ProfileSelection;
