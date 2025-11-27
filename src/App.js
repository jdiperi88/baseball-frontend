// App.js
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import BaseballGame from "./components/BaseballGame";
import GameStats from "./components/GameStats";
import Nav from "./components/Nav";
import { UserProvider, useUser } from "./UserContext";
import ProfileSelection from "./components/ProfileSelection";

function App() {
  return (
    <UserProvider>
      <Router>
        <RoutesWithProfileCheck />
      </Router>
    </UserProvider>
  );
}

function RoutesWithProfileCheck() {
  const { user } = useUser();

  return (
    <>
      {user ? (
        <>
          <Routes>
            <Route path="/baseball" element={<BaseballGame />} />
            <Route path="/baseball/stats" element={<GameStats />} />
          </Routes>
          <Nav />
        </>
      ) : (
        <Routes>
          <Route path="*" element={<ProfileSelection />} />
        </Routes>
      )}
    </>
  );
}

export default App;
