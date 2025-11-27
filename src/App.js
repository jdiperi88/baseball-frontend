// App.js
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Main from "./components/Main";
import Rewards from "./components/Rewards";
import Nav from "./components/Nav";
import AdminRewards from "./components/admin/AdminReward";
import AdminTasks from "./components/admin/AdminTasks";
import { UserProvider, useUser } from "./UserContext"; // Import the useUser hook as well
import ProfileSelection from "./components/ProfileSelection";
import HouseRules from "./components/Houserules";
import OKRs from "./components/OKRs";

function App() {
  // The useUser hook can only be used inside components that are children of UserProvider
  // We'll create a new component to handle conditional rendering
  return (
    <UserProvider>
      <Router>
        <RoutesWithProfileCheck />
      </Router>
    </UserProvider>
  );
}

// A new component that uses the useUser hook to conditionally render routes
function RoutesWithProfileCheck() {
  const { user } = useUser(); // useUser hook to access the user context

  return (
    <>
      {user ? ( // Check if a profile is selected based on the user context
        <>
          <Routes>
            <Route path="/baseball" element={<Main />} />
            <Route path="/baseball/admin" element={<AdminTasks />} />
            <Route path="/baseball/rewards" element={<Rewards />} />
            <Route path="/baseball/strikes" element={<HouseRules />} />
            <Route path="/baseball/admin/rewards" element={<AdminRewards />} />
            <Route path="/baseball/admin/tasks" element={<AdminTasks />} />
            <Route path="/baseball/okrs" element={<OKRs />} />
          </Routes>
          <Nav />
        </>
      ) : (
        // If no user is selected, redirect to a route that will render the ProfileSelection component
        <Routes>
          <Route path="*" element={<ProfileSelection />} />
        </Routes>
      )}
    </>
  );
}

export default App;
