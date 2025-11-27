import React from "react";

function Wallet({ amount }) {
  return (
    <div
      style={{
        width: "150px",
        height: "70px",
        backgroundColor: "#85bb65", // typical dollar bill color
        border: "2px solid #4a752c",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px",
        boxSizing: "border-box",
        color: "black",
        fontSize: "1.2rem",
        fontWeight: "bold",
      }}
    >
      <span style={{ fontSize: "1.5rem" }}>$</span>
      <span>{amount}</span>
      <span style={{ fontSize: "1.5rem" }}>USD</span>
    </div>
  );
}

export default Wallet;
